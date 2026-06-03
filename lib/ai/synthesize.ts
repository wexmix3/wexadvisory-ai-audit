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

Output ONLY valid JSON matching this exact schema. No markdown fences, no preamble:

{
  "executiveSummary": {
    "headline": "string — e.g. 'Acme Co could save $287K/year by automating 4 high-volume manual workflows'",
    "totalAnnualSavings": 287000,
    "quickWinSavings": 45000,
    "topOpportunity": "string — one specific sentence naming the #1 opportunity and its savings",
    "urgencyNote": "string — specific competitive pressure or cost of delay (name competitor type or market trend)",
    "confidenceStatement": "string — e.g. 'Based on website content, job signals, and industry benchmarks for 25-person professional services firms'"
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

export async function synthesizeAudit(input: SynthesisInput): Promise<AuditReportData> {
  const userMessage = `
COMPANY: ${input.intake.companyName}
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
${input.webContent.slice(0, 6000)}

JOB POSTING & REVIEW SIGNALS:
${input.jobSignals.slice(0, 3000)}

${input.trafficSummary ? `TRAFFIC DATA:\n${input.trafficSummary}` : ''}

Generate the full AI opportunity audit JSON. Be specific, quantified, and consultative. Every number must have clear logic behind it based on the benchmark data and company signals provided.`.trim();

  const message = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';

  if (message.stop_reason === 'max_tokens') {
    console.error('[synthesize] Claude hit max_tokens limit — output was truncated');
    throw new Error('Synthesis output was truncated — reduce prompt size or contact support');
  }

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Synthesis returned invalid JSON');

  let parsed: AuditReportData;
  try {
    parsed = JSON.parse(match[0]);
  } catch (e) {
    console.error('[synthesize] JSON parse failed. stop_reason:', message.stop_reason, 'raw length:', raw.length);
    throw new Error(`JSON parse error: ${e instanceof Error ? e.message : String(e)}`);
  }

  return verifyOpportunityMath(parsed);
}
