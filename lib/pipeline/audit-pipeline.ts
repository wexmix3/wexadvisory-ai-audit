import { getSupabase } from '@/lib/supabase';
import { scrapeMultiplePages, consolidateWebContent } from '@/lib/research/firecrawl';
import { gatherCompanySignals, formatSearchResults } from '@/lib/research/tavily';
import { getDomainTraffic } from '@/lib/research/dataforseo';
import {
  detectTechFromContent,
  inferDepartmentsFromJobSignals,
  extractManualProcessSignals,
} from '@/lib/research/tech-detector';
import { classifyBusiness } from '@/lib/ai/classify';
import { synthesizeAudit, checkAuditQuality, scoreAuditQualityLLM } from '@/lib/ai/synthesize';
import { getBenchmark, formatBenchmarkForPrompt } from '@/lib/benchmarks/industry-data';
import { computeScores } from '@/lib/scoring/score-engine';
import type { SnapshotIntake } from '@/types/audit';

async function setStatus(auditId: string, status: string, extra?: Record<string, unknown>) {
  await getSupabase()
    .from('audits')
    .update({ status, ...extra })
    .eq('id', auditId);
}

export async function runAuditPipeline(auditId: string, intake: SnapshotIntake) {
  const db = getSupabase();

  try {
    // Phase 1: Research
    await setStatus(auditId, 'researching');

    const domain = intake.companyUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];

    const [pages, signals, traffic] = await Promise.all([
      scrapeMultiplePages(intake.companyUrl),
      gatherCompanySignals(intake.companyName, domain),
      getDomainTraffic(intake.companyUrl).catch(() => null),
    ]);

    const webContent = consolidateWebContent(pages);
    const jobContent = formatSearchResults(signals.jobs);
    const reviewContent = formatSearchResults(signals.reviews);
    const allSignalContent = `${jobContent}\n\n${reviewContent}`;

    const techSignals = detectTechFromContent(webContent + allSignalContent);
    const inferredDepartments = inferDepartmentsFromJobSignals(jobContent);
    const manualProcessSignals = extractManualProcessSignals(jobContent + webContent);

    await db.from('audits').update({
      web_content: pages,
      search_results: [...signals.jobs, ...signals.reviews, ...signals.news],
      tech_signals: techSignals,
      job_signals: inferredDepartments,
      traffic_data: traffic,
    }).eq('id', auditId);

    // Phase 2: Classify
    await setStatus(auditId, 'analyzing');

    const classification = await classifyBusiness({
      webContent,
      jobSignals: allSignalContent,
      techSignals,
      intake: {
        companyName: intake.companyName,
        industry: intake.industry,
        employeeRange: intake.employeeRange,
      },
    });

    await db.from('audits').update({
      business_classification: classification,
      industry: classification.businessModel,
    }).eq('id', auditId);

    // Phase 3: Synthesize
    await setStatus(auditId, 'generating');

    const benchmark = getBenchmark(intake.industry || classification.businessModel);
    const benchmarkContext = formatBenchmarkForPrompt(benchmark);

    const trafficSummary = traffic
      ? `Monthly organic traffic: ~${traffic.monthlyTraffic?.toLocaleString() ?? 'unknown'} visits, ${traffic.organicKeywords?.toLocaleString() ?? 'unknown'} keywords ranked`
      : '';

    const reportData = await synthesizeAudit({
      intake,
      classification,
      webContent,
      jobSignals: allSignalContent,
      manualProcessSignals,
      techSignalsDetected: techSignals,
      trafficSummary,
      benchmarkContext,
    });

    // Evaluate quality in parallel — never throws, never blocks audit delivery
    const [llmQualityResult] = await Promise.allSettled([
      scoreAuditQualityLLM(reportData, intake.companyName),
    ]);
    const gateResult = checkAuditQuality(reportData);
    const llmQuality = llmQualityResult.status === 'fulfilled' ? llmQualityResult.value : null;

    const evalQuality = {
      scored_at: new Date().toISOString(),
      gate_passed: gateResult.passed,
      gate_issues: gateResult.issues,
      llm_score: llmQuality?.score ?? null,
      llm_reasoning: llmQuality?.reasoning ?? null,
      opportunity_count: reportData.opportunities?.length ?? 0,
      total_annual_savings: reportData.executiveSummary?.totalAnnualSavings ?? 0,
      has_quick_wins: (reportData.opportunities ?? []).some(o => o.quickWin),
    };

    // Override Claude's scores with the deterministic score engine for consistency
    const deterministicScores = computeScores({
      classification,
      benchmark,
      techSignalsDetected: techSignals,
      manualProcessSignals,
      employeeRange: intake.employeeRange,
      hasTrafficData: !!traffic,
    });
    reportData.scores = deterministicScores;

    // Store results
    await db.from('audits').update({
      scores: reportData.scores,
      opportunities: reportData.opportunities,
      report_data: reportData,
      eval_quality: evalQuality,
      status: 'generating', // still generating PDF
    }).eq('id', auditId);

    return { reportData, classification, benchmark };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setStatus(auditId, 'failed', { error_message: msg });
    throw err;
  }
}
