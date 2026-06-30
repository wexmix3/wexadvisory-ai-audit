import Anthropic from '@anthropic-ai/sdk';
import type { AuditReportData, BusinessClassification, SnapshotIntake } from '@/types/audit';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    client = new Anthropic({ apiKey });
  }
  return client;
}

const SYSTEM_PROMPT = `You are a senior McKinsey operations consultant and AI automation architect. You produce quantified AI opportunity analyses — NOT generic advice.

CRITICAL RULES — violate these and the report is worthless:
1. Every opportunity must name a SPECIFIC workflow, not a category ("Invoice creation and approval routing" not "Finance automation")
2. Every savings estimate must show the math (hours_per_month × hourly_rate × fte_count × automation_ceiling_pct × 12)
3. Only recommend tools that exist today and are implementable in <6 months (e.g., Make.com, Zapier, n8n, Claude API, Intercom, Gong, HubSpot, Notion AI, ChatGPT, custom GPT, Airtable, etc.)
4. Never say "use AI" — say "use [specific tool] to automate [specific step of specific workflow]"
5. Opportunities MUST be ranked by annual_savings descending
6. quick_win = true ONLY if: complexity = 'low', implementation_weeks ≤ 4, implementation_cost_high ≤ 5000
7. Only include opportunities where confidence_level is 'high' or 'medium' — never 'low' by itself
8. The urgency_note MUST name a specific competitor type or market pressure, not generic urgency
9. Scores must reflect reality: a company with no CRM cannot score above 45 on ai_readiness
10. dashboard_recommendations must name specific KPIs the business doesn't currently see, not generic metrics
11. LIMIT opportunities array to EXACTLY 5 items maximum — quality over quantity
12. LIMIT dashboardRecommendations to EXACTLY 2 items maximum
13. LIMIT competitiveInsights to EXACTLY 2 items maximum
14. Keep all string fields concise — workflowDescription and opportunityDescription max 2 sentences each
15. confidenceStatement MUST explicitly bridge the client's own words to what you found — format: "You told us [paraphrase of their stated biggest challenge]. We found [specific corroborating or clarifying finding from the research]." Do not write a generic confidence statement that ignores their stated challenge.

Output ONLY valid JSON matching this exact schema. No markdown fences, no preamble:

{
  "executiveSummary": {
    "headline": "string — e.g. 'Acme Co could save $287K/year by automating 4 high-volume manual workflows'",
    "totalAnnualSavings": 287000,
    "quickWinSavings": 45000,
    "topOpportunity": "string — one specific sentence naming the #1 opportunity and its savings",
    "urgencyNote": "string — specific competitive pressure or cost of delay (name competitor type or market trend)",
    "confidenceStatement": "string — MUST follow the 'You told us X. We found Y.' bridge format from rule 15, e.g. 'You told us scheduling and client follow-up eat your team's time. We found no CRM or scheduling automation in place, consistent with that — confirmed against website content, job signals, and industry benchmarks for 25-person professional services firms.'"
  },
  "companySnapshot": {
    "inferredModel": "string",
    "inferredSize": "string",
    "keyStrengths": ["string", "string", "string"],
    "keyGaps": ["string", "string", "string"],
    "techStackDetected": ["string"],
    "dataMaturityAssessment": "string — one sentence assessment of their current data/reporting situation"
  },
  "scores": {
    "aiReadiness": {
      "score": 42,
      "percentile": 35,
      "verdict": "string — one sentence verdict",
      "topFactors": ["Factor driving score up or down", "Factor 2", "Factor 3"]
    },
    "automationOpportunity": {
      "score": 68,
      "percentile": 65,
      "verdict": "string",
      "topFactors": ["string", "string", "string"]
    },
    "dataVisibility": {
      "score": 30,
      "percentile": 28,
      "verdict": "string",
      "topFactors": ["string", "string", "string"]
    },
    "revenueAcceleration": {
      "score": 55,
      "percentile": 48,
      "verdict": "string",
      "topFactors": ["string", "string", "string"]
    },
    "overallMaturity": {
      "score": 45,
      "percentile": 38,
      "verdict": "string — one sentence overall verdict comparing to industry peers",
      "topFactors": ["string", "string", "string"]
    }
  },
  "opportunities": [
    {
      "id": "opp-001",
      "department": "Sales",
      "title": "Specific opportunity title",
      "workflowDescription": "What the current manual process looks like step-by-step",
      "opportunityDescription": "What the automated version looks like and which specific tools power it",
      "frequency": "Daily",
      "hoursPerMonth": 32,
      "fteCountAffected": 3,
      "fullyLoadedHourlyRate": 45,
      "annualLaborCost": 86400,
      "automationCeilingPct": 75,
      "annualSavings": 64800,
      "confidenceLevel": "high",
      "complexity": "low",
      "implementationWeeks": 3,
      "implementationCostLow": 1500,
      "implementationCostHigh": 4000,
      "roiMonths": 1,
      "recommendedTools": [
        { "name": "HubSpot Sequences", "purpose": "Automate follow-up email cadences", "pricing": "Included in Sales Hub $45/mo" }
      ],
      "quickWin": true
    }
  ],
  "implementationRoadmap": {
    "phase1": {
      "name": "Quick Wins",
      "durationWeeks": 4,
      "items": [
        { "title": "string", "description": "string", "weeks": 2, "estimatedCost": 2000, "estimatedSavings": 18000 }
      ],
      "totalInvestment": 5000,
      "totalSavings": 45000
    },
    "phase2": {
      "name": "Foundation",
      "durationWeeks": 12,
      "items": [],
      "totalInvestment": 15000,
      "totalSavings": 120000
    },
    "phase3": {
      "name": "Scale",
      "durationWeeks": 24,
      "items": [],
      "totalInvestment": 35000,
      "totalSavings": 220000
    }
  },
  "dashboardRecommendations": [
    {
      "title": "string — specific dashboard name",
      "rationale": "string — what blind spot this solves",
      "kpis": ["Specific metric they cannot currently see", "KPI 2", "KPI 3"],
      "estimatedBuildWeeks": 2
    }
  ],
  "competitiveInsights": [
    {
      "observation": "string — what competitors in this space are already doing with AI",
      "implication": "string — what this means for their competitive position if they don't act",
      "opportunity": "string — the specific counter-move available to them"
    }
  ],
  "nextSteps": {
    "immediate": ["This week, free action 1", "This week, free action 2", "This week, free action 3"],
    "shortTerm": ["This quarter action 1", "This quarter action 2"],
    "callToAction": "string — specific, compelling next step with Wex Advisory"
  }
}`;

// Recalculate annualSavings from component fields so Claude's arithmetic errors don't propagate.
// If Claude's numbers are internally consistent (rate × hours × FTEs × ceiling × 12) we use them.
// If they're off by more than 20%, we override with the correct math.
function verifyOpportunityMath(data: AuditReportData): AuditReportData {
  if (!Array.isArray(data.opportunities)) return data;

  const verified = data.opportunities.map((opp) => {
    const hours = Number(opp.hoursPerMonth) || 0;
    const rate = Number(opp.fullyLoadedHourlyRate) || 0;
    const ftes = Number(opp.fteCountAffected) || 1;
    const ceiling = Number(opp.automationCeilingPct) || 0;

    const annualLaborCost = hours * rate * ftes * 12;
    const annualSavings = Math.round(annualLaborCost * (ceiling / 100));

    const claimedSavings = Number(opp.annualSavings) || 0;
    const deviation = claimedSavings > 0 ? Math.abs(claimedSavings - annualSavings) / claimedSavings : 1;

    if (deviation > 0.20 || claimedSavings === 0) {
      console.log(`[verify] ${opp.id}: claimed $${claimedSavings} → corrected to $${annualSavings}`);
      return { ...opp, annualLaborCost: Math.round(annualLaborCost), annualSavings };
    }
    return opp;
  });

  // Re-sort by corrected annualSavings and recalculate executive summary totals
  verified.sort((a, b) => (b.annualSavings ?? 0) - (a.annualSavings ?? 0));

  const totalAnnualSavings = verified.reduce((sum, o) => sum + (o.annualSavings ?? 0), 0);
  const quickWinSavings = verified
    .filter((o) => o.quickWin)
    .reduce((sum, o) => sum + (o.annualSavings ?? 0), 0);

  // Sync the headline text to match the verified total (Claude's original number is now wrong)
  const fmtShort = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${Math.round(n / 1000)}K`;
  const headline = (data.executiveSummary.headline || '').replace(
    /\$[\d,]+(?:\.\d+)?[KkMm]?/,
    fmtShort(totalAnnualSavings),
  );

  return {
    ...data,
    opportunities: verified,
    executiveSummary: {
      ...data.executiveSummary,
      headline,
      totalAnnualSavings,
      quickWinSavings,
    },
  };
}

// ── Quality gate ──────────────────────────────────────────────────────────────
// Code-based checks on the parsed output. No extra API calls — runs in <1ms.
// A failing gate triggers one quality retry with specific feedback injected into
// the prompt so Claude knows exactly what to fix.

interface QualityCheckResult {
  passed: boolean;
  issues: string[];
}

const BANNED_ENTERPRISE_TOOLS = [
  'salesforce einstein', 'microsoft copilot for enterprise',
  'servicenow', 'workday ai', 'oracle ai', 'sap ai',
  'aws comprehend', 'google vertex ai enterprise',
];

export function checkAuditQuality(data: AuditReportData): QualityCheckResult {
  const issues: string[] = [];
  const opps = data.opportunities ?? [];

  if (opps.length < 3) {
    issues.push(`only ${opps.length} opportunit${opps.length === 1 ? 'y' : 'ies'} generated — need at least 3`);
  }

  const shortDesc = opps.filter(o => !o.workflowDescription || o.workflowDescription.trim().length < 40);
  if (shortDesc.length > 0) {
    issues.push(
      `${shortDesc.length} opportunit${shortDesc.length > 1 ? 'ies have' : 'y has'} a workflow description under 40 characters — describe the actual step-by-step manual process`
    );
  }

  const noTools = opps.filter(o => !o.recommendedTools || o.recommendedTools.length === 0);
  if (noTools.length > 0) {
    issues.push(
      `${noTools.length} opportunit${noTools.length > 1 ? 'ies have' : 'y has'} no recommended tools — name at least one specific tool with pricing per opportunity`
    );
  }

  const zeroSavings = opps.filter(o => !o.annualSavings || o.annualSavings <= 0);
  if (zeroSavings.length > 1) {
    issues.push(
      `${zeroSavings.length} opportunities have zero annual savings — calculate from hours_per_month × rate × ftes × ceiling × 12`
    );
  }

  if (!data.executiveSummary?.totalAnnualSavings || data.executiveSummary.totalAnnualSavings <= 0) {
    issues.push('total annual savings is zero — sum the verified opportunity savings');
  }

  const allToolNames = opps
    .flatMap(o => o.recommendedTools ?? [])
    .map(t => (t.name ?? '').toLowerCase());
  const banned = allToolNames.filter(n => BANNED_ENTERPRISE_TOOLS.some(b => n.includes(b)));
  if (banned.length > 0) {
    issues.push(`enterprise tools flagged (${banned.join(', ')}) — replace with affordable alternatives under $500/month`);
  }

  return { passed: issues.length === 0, issues };
}

export interface LLMQualityScore {
  score: number;       // 0–1 normalized from 1–5
  reasoning: string;
}

export async function scoreAuditQualityLLM(
  data: AuditReportData,
  companyName: string,
): Promise<LLMQualityScore | null> {
  try {
    const opps = (data.opportunities ?? []).slice(0, 3).map(o => ({
      title: o.title,
      tools: (o.recommendedTools ?? []).map(t => t.name).join(', '),
      savings: o.annualSavings,
      workflow: o.workflowDescription?.slice(0, 100),
    }));

    const prompt = `You are evaluating an AI audit report produced for ${companyName}.

Top opportunities:
${opps.map((o, i) => `${i + 1}. ${o.title} — tools: ${o.tools} — savings: $${o.savings?.toLocaleString()} — workflow: ${o.workflow}`).join('\n')}

Total annual savings: $${data.executiveSummary?.totalAnnualSavings?.toLocaleString()}
Opportunities: ${data.opportunities?.length ?? 0}
Quick wins: ${data.opportunities?.filter(o => o.quickWin).length ?? 0}

Score overall audit quality 1–5:
5 = Specific workflows, named tools with pricing, quantified savings with clear math
4 = Mostly specific, minor gaps in pricing or workflow detail
3 = Adequate but some opportunities feel generic
2 = Weak specificity, tools named but not matched to workflows
1 = Generic advice, no real quantification

Respond ONLY with JSON: {"score": <1-5>, "reasoning": "<one sentence>"}`;

    const message = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    return { score: Math.round((parsed.score / 5) * 100) / 100, reasoning: parsed.reasoning ?? '' };
  } catch {
    return null;
  }
}

function buildQualityFeedback(check: QualityCheckResult, attempt: number): string {
  return (
    `\n\nQUALITY GATE FAILED (attempt ${attempt} — do not repeat these mistakes):\n` +
    check.issues.map(i => `- ${i}`).join('\n') +
    '\n\nFix every issue above in this response. Be specific: name exact workflows, not categories. Every opportunity must have a step-by-step workflow description (2+ sentences), at least one named affordable tool with pricing, and a calculated savings figure.'
  );
}

// ── Synthesis internals ───────────────────────────────────────────────────────

export interface SynthesisInput {
  intake: SnapshotIntake;
  classification: BusinessClassification;
  webContent: string;
  jobSignals: string;
  manualProcessSignals: string[];
  techSignalsDetected: string[];
  trafficSummary: string;
  benchmarkContext: string;
}

// Progressive content limits: full → 60% → 33% to recover from max_tokens truncation
const CONTENT_LIMITS = [
  { web: 6000, job: 3000 },
  { web: 3600, job: 1800 },
  { web: 2000, job: 1200 },
] as const;

function buildUserMessage(
  input: SynthesisInput,
  webLimit: number,
  jobLimit: number,
  jsonOnly = false,
  qualityFeedback = '',
): string {
  const prefix = jsonOnly
    ? 'IMPORTANT: Return ONLY the JSON object. No preamble, no explanation, no markdown fences.\n\n'
    : '';
  return `${prefix}COMPANY: ${input.intake.companyName}
URL: ${input.intake.companyUrl}
INDUSTRY (self-reported): ${input.intake.industry}
EMPLOYEE RANGE: ${input.intake.employeeRange}
BIGGEST CHALLENGE (in their words): "${input.intake.biggestChallenge}"

BUSINESS CLASSIFICATION:
- Model: ${input.classification.businessModel}
- Revenue: ${input.classification.revenueModel}
- Customers: ${input.classification.customerType}
- Org: ${input.classification.orgStructure}
- Data Maturity: ${input.classification.dataMature}
- Tech Sophistication: ${input.classification.techSophistication}
- Inferred Departments: ${input.classification.inferredDepartments.join(', ')}
- Business Description: ${input.classification.businessDescription}

TECH DETECTED ON SITE/JOB POSTINGS: ${input.techSignalsDetected.join(', ') || 'none detected'}
MANUAL PROCESS SIGNALS FROM JOB POSTINGS: ${input.manualProcessSignals.join('; ') || 'none detected'}

INDUSTRY BENCHMARK CONTEXT:
${input.benchmarkContext}

WEBSITE CONTENT (scraped):
${input.webContent.slice(0, webLimit)}

JOB POSTING & REVIEW SIGNALS:
${input.jobSignals.slice(0, jobLimit)}

${input.trafficSummary ? `TRAFFIC DATA:\n${input.trafficSummary}` : ''}

Generate the full AI opportunity audit JSON. Be specific, quantified, and consultative. Every number must have clear logic behind it based on the benchmark data and company signals provided.${qualityFeedback}`.trim();
}

// One synthesis attempt with technical retries (JSON parse / max_tokens).
// qualityFeedback is appended to the user message when non-empty.
async function runSynthesisWithRetry(
  input: SynthesisInput,
  qualityFeedback: string,
  isQualityRetry: boolean,
): Promise<AuditReportData> {
  let lastError: Error = new Error('Synthesis failed after all attempts');

  for (let attempt = 0; attempt < CONTENT_LIMITS.length; attempt++) {
    const { web: webLimit, job: jobLimit } = CONTENT_LIMITS[attempt];
    // Force JSON-only prefix on technical retries and quality retries
    const jsonOnly = attempt > 0 || isQualityRetry;

    if (attempt > 0) {
      console.warn(
        `[synthesize] retrying (attempt ${attempt + 1}/${CONTENT_LIMITS.length}) web=${webLimit} job=${jobLimit}`,
      );
    }

    const model = (process.env.AUDIT_MODEL ?? 'claude-sonnet-4-6').trim();

    const message = await getClient().messages.create({
      model,
      max_tokens: 16000,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: buildUserMessage(input, webLimit, jobLimit, jsonOnly, qualityFeedback),
      }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text : '';

    if (message.stop_reason === 'max_tokens') {
      console.warn(`[synthesize] attempt ${attempt + 1} hit max_tokens — reducing content and retrying`);
      lastError = new Error('Synthesis output truncated');
      continue;
    }

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      console.warn(`[synthesize] attempt ${attempt + 1} returned no JSON`);
      lastError = new Error('Synthesis returned no JSON');
      continue;
    }

    try {
      const parsed: AuditReportData = JSON.parse(match[0]);
      return verifyOpportunityMath(parsed);
    } catch (e) {
      console.warn(
        `[synthesize] attempt ${attempt + 1} JSON parse failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      lastError = e instanceof Error ? e : new Error(String(e));
      continue;
    }
  }

  throw lastError;
}

// ── Public API ────────────────────────────────────────────────────────────────
// Quality loop: generate → check → if weak, inject specific feedback → retry once.
// Max 2 total synthesis calls (1 quality retry). No extra API cost for scoring.
// Always returns the best result available — never throws on quality failure.

const MAX_QUALITY_TURNS = 1;

export async function synthesizeAudit(input: SynthesisInput): Promise<AuditReportData> {
  let qualityFeedback = '';

  for (let qualityTurn = 0; qualityTurn <= MAX_QUALITY_TURNS; qualityTurn++) {
    const result = await runSynthesisWithRetry(input, qualityFeedback, qualityTurn > 0);
    const quality = checkAuditQuality(result);

    if (quality.passed) {
      if (qualityTurn > 0) {
        console.log(`[quality-loop] passed on quality turn ${qualityTurn + 1}`);
      }
      return result;
    }

    if (qualityTurn === MAX_QUALITY_TURNS) {
      console.warn(
        `[quality-loop] returning best result after ${MAX_QUALITY_TURNS + 1} quality turn(s) — issues: ${quality.issues.join('; ')}`,
      );
      return result;
    }

    console.warn(`[quality-loop] turn ${qualityTurn + 1} failed: ${quality.issues.join('; ')}`);
    qualityFeedback = buildQualityFeedback(quality, qualityTurn + 1);
  }

  // TypeScript requires a return path here even though the loop always returns
  throw new Error('[quality-loop] unexpected exit — this should never be reached');
}
