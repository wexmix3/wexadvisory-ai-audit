import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { runAuditPipeline } from '@/lib/pipeline/audit-pipeline';
import { sendSnapshotEmail, sendAdminNotification } from '@/lib/email/resend';
import { runProposalPipeline } from '@/lib/proposal/proposal-pipeline';
import type { SnapshotIntake } from '@/types/audit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const intake: SnapshotIntake = {
      companyUrl: (body.companyUrl || '').trim().replace(/\/$/, ''),
      companyName: (body.companyName || '').trim(),
      industry: (body.industry || '').trim(),
      employeeRange: body.employeeRange || '11-50',
      biggestChallenge: (body.biggestChallenge || '').trim(),
      contactName: (body.contactName || '').trim(),
      contactEmail: (body.contactEmail || '').trim().toLowerCase(),
    };

    if (!intake.companyUrl || !intake.contactEmail) {
      return NextResponse.json({ error: 'companyUrl and contactEmail are required' }, { status: 400 });
    }

    if (!intake.companyUrl.startsWith('http')) {
      intake.companyUrl = `https://${intake.companyUrl}`;
    }

    const db = getSupabase();
    const { data: audit, error } = await db
      .from('audits')
      .insert({
        audit_type: 'snapshot',
        status: 'pending',
        company_url: intake.companyUrl,
        company_name: intake.companyName,
        industry: intake.industry,
        employee_count_estimate: intake.employeeRange,
        contact_name: intake.contactName,
        contact_email: intake.contactEmail,
        intake_data: intake,
      })
      .select('id')
      .single();

    if (error || !audit) {
      console.error('Failed to create audit record:', error);
      return NextResponse.json({ error: 'Failed to create audit', detail: error?.message, code: error?.code }, { status: 500 });
    }

    const auditId = audit.id;

    // after() keeps the serverless function alive until the promise resolves,
    // even after the response has been sent to the client.
    after(async () => {
      await runAuditPipelineAsync(auditId, intake);
    });

    return NextResponse.json({ auditId });
  } catch (err) {
    console.error('[snapshot] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function runAuditPipelineAsync(auditId: string, intake: SnapshotIntake) {
  try {
    const { reportData } = await runAuditPipeline(auditId, intake);

    const resultsUrl = `${process.env.NEXT_PUBLIC_APP_URL}/results/${auditId}`;

    await Promise.allSettled([
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
  }
}
