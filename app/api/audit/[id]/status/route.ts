import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data: raw, error } = await getSupabase()
    .from('audits')
    .select('id, status, company_name, error_message, scores, report_data')
    .eq('id', id)
    .single();

  if (error || !raw) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  }

  const data = raw as {
    id: string;
    status: string;
    company_name: string | null;
    error_message: string | null;
    scores: Record<string, { score: number; percentile: number; verdict: string; topFactors: string[] }> | null;
    report_data: { executiveSummary?: { totalAnnualSavings?: number; headline?: string } } | null;
  };

  return NextResponse.json({
    auditId: data.id,
    status: data.status,
    companyName: data.company_name,
    errorMessage: data.error_message,
    summary: data.status === 'complete' && data.report_data
      ? {
          totalAnnualSavings: data.report_data.executiveSummary?.totalAnnualSavings ?? 0,
          headline: data.report_data.executiveSummary?.headline ?? '',
          scores: data.scores,
        }
      : null,
  });
}
