import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import type { SnapshotIntake } from '@/types/audit';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

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

    // Hand off to /api/audit/process, a separate function invocation with its own
    // fresh maxDuration budget — this is the trampoline that lets the full pipeline
    // run longer than any single function's duration cap without a Vercel plan change.
    // /api/audit/process responds 202 immediately, so this await is fast (network
    // latency only, not pipeline duration).
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/audit/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
        },
        body: JSON.stringify({ auditId, intake }),
      });
    } catch (triggerErr) {
      console.error('[snapshot] failed to trigger process job:', triggerErr);
      await db
        .from('audits')
        .update({ status: 'failed', error_message: 'Failed to start audit pipeline' })
        .eq('id', auditId);
      return NextResponse.json({ error: 'Failed to start audit pipeline' }, { status: 500 });
    }

    return NextResponse.json({ auditId });
  } catch (err) {
    console.error('[snapshot] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
