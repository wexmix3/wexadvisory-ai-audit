// Dev helper: render an audit's PDF locally and rasterize each page to PNG.
// Usage: npx tsx scripts/render-pages.mjs <auditId|report.json> <outDir>
import { createClient } from '@supabase/supabase-js';
import { generateSnapshotPDF } from '../lib/pdf/snapshot-pdf.tsx';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const [src, outDir] = process.argv.slice(2);
if (!src || !outDir) { console.error('usage: <auditId|report.json> <outDir>'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

let company_name, company_url, report_data;
if (src.endsWith('.json')) {
  ({ company_name, company_url, report_data } = JSON.parse(fs.readFileSync(src, 'utf8')));
} else {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await db.from('audits').select('company_name, company_url, report_data').eq('id', src).single();
  if (error || !data) { console.error('No audit found:', error); process.exit(1); }
  ({ company_name, company_url, report_data } = data);
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ company_name, company_url, report_data }, null, 2));
}

const buf = await generateSnapshotPDF(company_name, company_url, report_data);
fs.writeFileSync(path.join(outDir, 'out.pdf'), buf);

const fontsDir = path.join(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts');
const doc = await getDocument({ data: new Uint8Array(buf), standardFontDataUrl: `${pathToFileURL(fontsDir).href}/` }).promise;
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = createCanvas(viewport.width, viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport, canvas }).promise;
  fs.writeFileSync(path.join(outDir, `page-${i}.png`), canvas.toBuffer('image/png'));
}
console.log(`pages=${doc.numPages} pdfBytes=${buf.length} -> ${outDir}`);
