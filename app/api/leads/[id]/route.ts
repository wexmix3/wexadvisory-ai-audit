import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'wexadmin2025';

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('x-admin-token');
  return auth === ADMIN_PASSWORD;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const allowedFields = ['lead_status', 'lead_notes', 'follow_up_at', 'outreach_added'];
  const updates: Record<string, unknown> = {};
  for (const f of allowedFields) {
    if (body[f] !== undefined) updates[f] = body[f];
  }

  const { error } = await getSupabase()
    .from('audits')
    .update(updates)
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
