import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { runAuditPipeline } from '@/lib/pipeline/audit-pipeline';
import { sendSnapshotEmail, sendAdminNotification } from '@/lib/email/resend';
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
      }),
    ]);

    // Visual QA: fire and forget — rasterizes the same PDF buffer just emailed and
    // scores layout/whitespace via a vision model. Observability only: logs the
    // result for human review, never retries or blocks delivery. Layout issues are
    // code bugs in snapshot-pdf.tsx, not LLM-content issues a retry could fix.
    if (snapshotEmailResult.status === 'fulfilled' && snapshotEmailResult.value.pdfBuffer) {
      const pdfBuffer = snapshotEmailResult.value.pdfBuffer;
      scoreVisualQuality(pdfBuffer)
        .then((result) =>
          getSupabase()
            .from('audits')
            .update({
              visual_qa_score: result.score,
              visual_qa_issues: result.issues,
              visual_qa_verdict: result.verdict,
            })
            .eq('id', auditId)
        )
        .catch((err) => {
          console.error('[visual qa] scoring failed:', err);
        });
    }

    const db = getSupabase();
    await db.from('leads').insert({
      audit_id: auditId,
      email: intake.contactEmail,
      company: intake.companyName,
      contact_name: intake.contactName,
      industry: intake.industry,
      annual_savings_estimate: reportData.executiveSummary.totalAnnualSavings,
      lead_score: reportData.scores.overallMaturity.score,
      status: 'new',
      source: 'audit',
    });

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
