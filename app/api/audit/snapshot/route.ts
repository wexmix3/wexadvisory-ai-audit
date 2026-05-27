import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { runAuditPipeline } from '@/lib/pipeline/audit-pipeline';
import { sendSnapshotEmail, sendAdminNotification } from '@/lib/email/resend';
import type { SnapshotIntake } from '@/types/audit';

export const dynamic = 'force-dynamic';

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

    // Normalize URL
    if (!intake.companyUrl.startsWith('http')) {
      intake.companyUrl = `https://${intake.companyUrl}`;
    }

    // Create audit record
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
      return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 });
    }

    const auditId = audit.id;

    // Run pipeline asynchronously (don't await — return immediately)
    runAuditPipelineAsync(auditId, intake);

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

    // Send emails
    await Promise.allSettled([
      sendSnapshotEmail({
        toEmail: intake.contactEmail,
        toName: intake.contactName,
        companyName: intake.companyName,
        auditId,
        totalAnnualSavings: reportData.executiveSummary.totalAnnualSavings,
        resultsUrl,
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

    // Create lead record
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

    // Mark complete
    await getSupabase()
      .from('audits')
      .update({ status: 'complete', lead_status: 'emailed' })
      .eq('id', auditId);

  } catch (err) {
    console.error('[pipeline async] failed:', err);
    // Status already set to 'failed' by the pipeline
  }
}
