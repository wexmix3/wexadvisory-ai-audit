import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { runAuditPipeline } from '@/lib/pipeline/audit-pipeline';
import { sendSnapshotEmail, sendAdminNotification } from '@/lib/email/brevo';
import { runProposalPipeline } from '@/lib/proposal/proposal-pipeline';
import { scoreVisualQuality } from '@/lib/pdf/visual-qa';
import type { SnapshotIntake } from '@/types/audit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Internal-only trampoline: invoked by /api/audit/snapshot via fetch, not by clients.
// Responds 202 immediately, then runs the actual pipeline in after() — this gives the
// pipeline a fresh maxDuration budget independent of the request that triggered it,
// without needing a queue service or a Vercel plan change.
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret');
  const expected = (process.env.INTERNAL_API_SECRET || '').trim();
  if (!secret || !expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { auditId, intake } = (await req.json()) as { auditId: string; intake: SnapshotIntake };

  if (!auditId || !intake) {
    return NextResponse.json({ error: 'auditId and intake are required' }, { status: 400 });
  }

  after(async () => {
    await runAuditPipelineAsync(auditId, intake);
  });

  return NextResponse.json({ ok: true }, { status: 202 });
}

async function runAuditPipelineAsync(auditId: string, intake: SnapshotIntake) {
  try {
    const { reportData } = await runAuditPipeline(auditId, intake);

    const resultsUrl = `${process.env.NEXT_PUBLIC_APP_URL}/results/${auditId}`;

    const [snapshotEmailResult] = await Promise.allSettled([
      sendSnapshotEmail({
        toEmail: intake.contactEmail,
        toName: intake.contactName,
        companyName: intake.companyName,
        companyUrl: intake.companyUrl,
        auditId,
        totalAnnualSavings: reportData.executiveSummary.totalAnnualSavings,
        resultsUrl,
        reportData,
      }),
      sendAdminNotification({
        companyName: intake.companyName,
        contactName: intake.contactName,
        contactEmail: intake.contactEmail,
        industry: intake.industry,
        employeeRange: intake.employeeRange,
        totalAnnualSavings: reportData.executiveSummary.totalAnnualSavings,
        aiReadinessScore: reportData.scores.aiReadiness.score,
        topOpportunity: reportData.executiveSummary.topOpportunity,
        auditId,
        resultsUrl,
        source: intake.utmSource || undefined,
      }),
    ]);

    // Visual QA: runs after email delivery so it never blocks or delays the send —
    // but it IS awaited (not detached) because after()'s waitUntil only extends the
    // invocation's lifetime for the promise this whole function returns. A detached
    // .then()/.catch() chain here is not part of that promise, so Vercel can freeze
    // the container the instant runAuditPipelineAsync resolves, killing this mid-flight
    // (this is exactly what silently broke visual QA on every audit — confirmed via
    // live logs 2026-09-02: the rasterizer's own console warnings would fire, but the
    // Anthropic call + DB update never got to run). Observability only: never retries,
    // and a failure here must never throw out of runAuditPipelineAsync — layout issues
    // are code bugs in snapshot-pdf.tsx, not LLM-content issues a retry could fix.
    if (snapshotEmailResult.status === 'fulfilled' && snapshotEmailResult.value.pdfBuffer) {
      const pdfBuffer = snapshotEmailResult.value.pdfBuffer;
      try {
        const result = await scoreVisualQuality(pdfBuffer);
        const { error: visualQaErr } = await getSupabase()
          .from('audits')
          .update({
            visual_qa_score: result.score,
            visual_qa_issues: result.issues,
            visual_qa_verdict: result.verdict,
          })
          .eq('id', auditId);
        if (visualQaErr) {
          console.error('[visual qa] failed to persist result:', visualQaErr);
        }
      } catch (err) {
        console.error('[visual qa] scoring failed:', err);
      }
    }

    const db = getSupabase();
    // prospect_id is a uuid column with an FK to prospects(id). An empty string
    // or malformed token would fail the insert outright — shape-check before
    // trusting it. A well-formed but stale/nonexistent id (deleted prospect,
    // hand-typed pid) still trips the FK constraint at insert time, so the
    // insert itself falls back to dropping prospect_id rather than losing the
    // whole lead over an attribution field. Either way lead capture — the
    // business-critical part — must not go down over a tracking token.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const prospectId = intake.prospectId && UUID_RE.test(intake.prospectId) ? intake.prospectId : null;
    const leadBase = {
      audit_id: auditId,
      email: intake.contactEmail,
      company: intake.companyName,
      contact_name: intake.contactName,
      industry: intake.industry,
      annual_savings_estimate: reportData.executiveSummary.totalAnnualSavings,
      lead_score: reportData.scores.overallMaturity.score,
      status: 'new',
      // Falls back to 'audit' for organic/direct traffic — utmSource is only set
      // when the visitor arrived via a tracked link (e.g. 'coldoutreach').
      source: intake.utmSource || 'audit',
    };
    const { error: leadInsertErr } = await db
      .from('leads')
      .insert({ ...leadBase, prospect_id: prospectId });
    if (leadInsertErr) {
      console.error('[leads] insert with prospect_id failed, retrying without it:', leadInsertErr);
      const { error: retryErr } = await db.from('leads').insert(leadBase);
      if (retryErr) console.error('[leads] insert failed even without prospect_id:', retryErr);
    }

    await getSupabase()
      .from('audits')
      .update({ status: 'complete', lead_status: 'emailed' })
      .eq('id', auditId);

    // Auto-proposal: fire and forget — silent fail, never affects audit delivery
    const { data: auditRecord } = await db.from('audits').select('traffic_data').eq('id', auditId).single();
    const traffic = auditRecord?.traffic_data as { monthlyTraffic?: number; organicKeywords?: number } | null;
    const trafficSummary = traffic
      ? `Monthly organic traffic: ~${traffic.monthlyTraffic?.toLocaleString() ?? 'unknown'} visits, ${traffic.organicKeywords?.toLocaleString() ?? 'unknown'} keywords ranked`
      : '';
    runProposalPipeline(auditId, intake, reportData, trafficSummary).catch((err) => {
      console.error('[proposal pipeline] unhandled error:', err);
    });

    // Sync to outreach prospects table — skips if email already exists
    await getSupabase()
      .from('prospects')
      .upsert(
        {
          business_name: intake.companyName,
          contact_name: intake.contactName,
          email: intake.contactEmail,
          website: intake.companyUrl,
          industry: intake.industry,
          status: 'audit_lead',
        },
        { onConflict: 'email', ignoreDuplicates: true }
      );
  } catch (err) {
    console.error('[pipeline async] failed:', err);
    await getSupabase()
      .from('audits')
      .update({ status: 'failed', error_message: err instanceof Error ? err.message : String(err) })
      .eq('id', auditId);
  }
}
