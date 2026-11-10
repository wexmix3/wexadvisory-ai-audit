// Re-runs synthesis on a stored audit's research, so a prompt or math change
// can be checked against a real company without new scraping. Reads the
// audits row only: no database writes, no emails, no proposal.
//
// Cost: one synthesis call on AUDIT_MODEL (plus a quality retry when the gate
// fails) and one Haiku score, on the ANTHROPIC_API_KEY in .env.local.
//
// Run: npx tsx scripts/replay-audit.mts <auditId> [outDir]
// Writes <outDir>/replay-<auditId>.json and .pdf (outDir defaults to scripts/).
//
// Not byte-identical to the pipeline: stored search_results mixes jobs,
// reviews and news, so all three go in as one signals block.

import fs from 'node:fs';
import path from 'node:path';

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
}

const auditId = process.argv[2];
const outDir = process.argv[3] ?? 'scripts';
if (!auditId) throw new Error('usage: npx tsx scripts/replay-audit.mts <auditId> [outDir]');

const { getSupabase } = await import('../lib/supabase');
const { consolidateWebContent } = await import('../lib/research/firecrawl');
const { formatSearchResults } = await import('../lib/research/tavily');
const { detectTechFromContent, extractManualProcessSignals } = await import('../lib/research/tech-detector');
const { synthesizeAudit, scoreAuditQualityLLM } = await import('../lib/ai/synthesize');
const { getBenchmark, formatBenchmarkForPrompt } = await import('../lib/benchmarks/industry-data');
const { computeScores } = await import('../lib/scoring/score-engine');
const { generateSnapshotPDF } = await import('../lib/pdf/snapshot-pdf');

const { data: row, error } = await getSupabase()
  .from('audits')
  .select('company_name, company_url, intake_data, web_content, search_results, traffic_data, business_classification')
  .eq('id', auditId)
  .single();
if (error || !row) throw new Error(`audit ${auditId} not found: ${error?.message}`);
if (!row.web_content || !row.business_classification) throw new Error('audit has no stored research to replay');

const intake = row.intake_data;
const classification = row.business_classification;
const webContent = consolidateWebContent(row.web_content);
const signals = formatSearchResults(row.search_results ?? []);
const techSignals = detectTechFromContent(webContent + signals);
const manualProcessSignals = extractManualProcessSignals(signals + webContent + ' ' + intake.biggestChallenge);
const benchmark = getBenchmark(intake.industry || classification.businessModel);
const traffic = row.traffic_data && !row.traffic_data.error ? row.traffic_data : null;
const trafficSummary = traffic
  ? `Monthly organic traffic: ~${traffic.monthlyTraffic?.toLocaleString() ?? 'unknown'} visits, ${traffic.organicKeywords?.toLocaleString() ?? 'unknown'} keywords ranked`
  : '';

const started = Date.now();
const result = await synthesizeAudit({
  intake,
  classification,
  webContent,
  jobSignals: signals,
  manualProcessSignals,
  techSignalsDetected: techSignals,
  trafficSummary,
  benchmarkContext: formatBenchmarkForPrompt(benchmark),
});
const report = result.data;
report.scores = computeScores({
  classification,
  benchmark,
  techSignalsDetected: techSignals,
  manualProcessSignals,
  employeeRange: intake.employeeRange,
  hasTrafficData: !!traffic,
});
const llm = await scoreAuditQualityLLM(report, intake.companyName);

fs.mkdirSync(outDir, { recursive: true });
const base = path.join(outDir, `replay-${auditId}`);
fs.writeFileSync(`${base}.json`, JSON.stringify({ report, gate: result, llm }, null, 2));
fs.writeFileSync(`${base}.pdf`, await generateSnapshotPDF(row.company_name, row.company_url, report));

console.log(JSON.stringify({
  seconds: Math.round((Date.now() - started) / 1000),
  qualityRetryUsed: result.qualityRetryUsed,
  finalIssues: result.finalIssues,
  finalNotes: result.finalNotes,
  llmScore: llm?.score ?? null,
  total: report.executiveSummary.totalAnnualSavings,
  conservative: report.executiveSummary.totalAnnualSavingsConservative,
  wrote: [`${base}.json`, `${base}.pdf`],
}, null, 2));
