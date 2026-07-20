import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function verifyCalendlySignature(rawBody: string, signatureHeader: string | null): boolean {
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
  if (!signingKey || !signatureHeader) return false;

  // Header format: "t=<timestamp>,v1=<signature>"
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p): [string, string] => {
      const idx = p.indexOf('=');
      return [p.slice(0, idx), p.slice(idx + 1)];
    })
  );
  const timestamp = parts['t'];
  const receivedSig = parts['v1'];
  if (!timestamp || !receivedSig) return false;

  const expected = createHmac('sha256', signingKey)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  return expected === receivedSig;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get('Calendly-Webhook-Signature');

  // Validate signature — reject if invalid
  if (!verifyCalendlySignature(rawBody, signatureHeader)) {
    console.warn('[calendly-webhook] invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Only process booking creation events
  if (payload['event'] !== 'invitee.created') {
    return NextResponse.json({ received: true, action: 'ignored' });
  }

  const invitee = payload['payload'] as Record<string, unknown> | undefined;
  const email = (invitee?.['email'] as string | undefined)?.toLowerCase().trim();
  const eventUri = (invitee?.['scheduled_event'] as Record<string, unknown> | undefined)?.['uri'] as string | undefined;
  const bookedAt = payload['created_at'] as string | undefined;

  const db = getSupabase();

  async function logFailure(errorMessage: string) {
    await db.from('webhook_failures').insert({
      source: 'calendly',
      event_type: payload['event'] as string | undefined,
      payload,
      error_message: errorMessage,
    });
  }

  if (!email) {
    console.warn('[calendly-webhook] no email in payload');
    await logFailure('no email in invitee.created payload');
    return NextResponse.json({ received: true, action: 'no_email' });
  }

  // Find the most recent completed audit for this email
  const { data: audit, error } = await db
    .from('audits')
    .select('id, lead_status, calendly_event_uri')
    .eq('contact_email', email)
    .eq('status', 'complete')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !audit) {
    // No matching audit — still return 200 so Calendly doesn't retry
    console.warn(`[calendly-webhook] no completed audit found for ${email}`);
    await logFailure(`no completed audit found for ${email}: ${error?.message ?? 'not found'}`);
    return NextResponse.json({ received: true, action: 'no_audit_match' });
  }

  // Deduplicate — skip if already marked booked for this event
  if (audit.calendly_event_uri === eventUri) {
    return NextResponse.json({ received: true, action: 'duplicate' });
  }

  const { error: updateError } = await db
    .from('audits')
    .update({
      lead_status: 'booked_call',
      booked_call_at: bookedAt ?? new Date().toISOString(),
      calendly_event_uri: eventUri ?? null,
    })
    .eq('id', audit.id);

  if (updateError) {
    console.error('[calendly-webhook] update failed:', updateError.message);
    // Return 200 anyway — Calendly retries are unhelpful if this is a DB issue
    await logFailure(`booked_call update failed for audit ${audit.id}: ${updateError.message}`);
    return NextResponse.json({ received: true, action: 'update_failed' });
  }

  console.warn(`[calendly-webhook] booked_call marked for audit ${audit.id} (${email})`);
  return NextResponse.json({ received: true, action: 'booked_call_marked', auditId: audit.id });
}
