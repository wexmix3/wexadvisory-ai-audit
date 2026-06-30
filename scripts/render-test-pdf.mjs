import { createClient } from '@supabase/supabase-js';
import { generateSnapshotPDF } from '../lib/pdf/snapshot-pdf.tsx';
import fs from 'fs';

for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await db
  .from('audits')
  .select('company_name, company_url, report_data, created_at')
  .ilike('company_name', '%25N%')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

if (error || !data) {
  console.error('No audit found:', error);
  process.exit(1);
}

const buf = await generateSnapshotPDF(data.company_name, data.company_url, data.report_data);
fs.writeFileSync('scripts/25n-test-output.pdf', buf);
console.log('Wrote scripts/25n-test-output.pdf, size:', buf.length);
