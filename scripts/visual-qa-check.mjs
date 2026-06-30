import { scoreVisualQuality } from '../lib/pdf/visual-qa.ts';
import fs from 'fs';

for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const buf = fs.readFileSync('scripts/25n-test-output.pdf');
const result = await scoreVisualQuality(buf);
console.log(JSON.stringify(result, null, 2));
