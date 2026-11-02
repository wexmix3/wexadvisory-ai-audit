import Anthropic from '@anthropic-ai/sdk';
import type { AuditReportData, SnapshotIntake, ProposalContent, DecompressedProblem } from '@/types/audit';
import {
  EXTRA_HOUR_RATE_USD,
  MIN_TERM_MONTHS,
  MONTHLY_FEE_USD,
  MONTHLY_INCLUDED_HOURS,
  SETUP_FEE_USD,
  TEAM_HANDOFF,
  TRIAL_DAYS,
  assertProposalTerms,
  fmtUsd,
} from '@/lib/proposal/terms';
import { attachAuditFigures, exactDollarFigures, fmtRange, replaceMoney } from '@/lib/ai/opportunity-math';
import { stripEmDashesDeep } from '@/lib/ai/plain-text';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    client = new Anthropic({ apiKey });
  }
  return client;
}

export const SYSTEM_PROMPT = `You are a senior consultant at Wex Advisory, a boutique AI consulting firm. You write concise, formal consulting proposals for small to mid-market businesses. Your tone is direct, professional, and confident: never generic, never padded.

You will receive a completed AI opportunity audit for a company and produce a structured proposal JSON.

RULES:
1. Reference the company by name throughout: never say "your company" generically
2. The executiveSummary must reference their specific top opportunity and its savings range
3. Each opportunity's proposedApproach must name the specific tools already identified in the audit
4. engagementScope must describe concrete deliverables (e.g., "Build and deploy a Make.com automation for X"), not vague scope
5. Keep every string field concise: no paragraph over 4 sentences
6. emailBody must be 3-4 short paragraphs: (1) what we found, (2) what we propose, (3) CTA. Formal but human.
7. emailSubject must be specific: reference company name and the SAVINGS RANGE given below
8. Quote savings only as the ranges written below (conservative to best case), copied as written, e.g. "$29K-$59K". Never quote a single figure, and never add up, re-estimate or round them yourself.
9. Quote only the terms under ENGAGEMENT TERMS.
10. The plan terms and team handoff under ENGAGEMENT TERMS are printed in the proposal PDF as written. Do not restate or extend them; in the emailBody, one sentence on the free trial and one saying a recorded team walkthrough is included are enough.

Output ONLY valid JSON: no markdown, no preamble:

{
  "contactFirstName": "string: first name only",
  "companyName": "string",
  "companyUrl": "string",
  "preparedDate": "string: formatted as Month DD, YYYY",
  "executiveSummary": "string: 2-3 sentences: what we found, the total SAVINGS RANGE, why now",
  "opportunities": [
    {
      "title": "string: exact opportunity title from audit",
      "currentState": "string: 1-2 sentences describing the current manual process",
      "proposedApproach": "string: 1-2 sentences naming the specific tools and what we would build",
      "timelineWeeks": 0
    }
  ],
  "engagementScope": "string: bullet-point style description of concrete deliverables for Phase 1 (quick wins). Use \\n to separate items.",
  "engagementTimeline": "string: e.g. 'Phase 1 (Weeks 1-4): Quick wins implementation. Phase 2 (Weeks 5-16): Foundation build. After launch: the monthly plan.'",
  "ongoingSupportDescription": "string: 1-2 sentences on what the monthly plan would cover for this company after launch",
  "nextStep": "string: specific CTA sentence pointing to the Calendly link",
  "emailSubject": "string: specific subject line referencing company and the SAVINGS RANGE",
  "emailBody": "string: 3-4 paragraph email body. Use \\n\\n between paragraphs. Formal consulting tone. Sign off as Max Wexley, Wex Advisory."
}`;

export function buildUserMessage(
  intake: SnapshotIntake,
  reportData: AuditReportData,
  trafficSummary: string,
  preparedDate: string,
  decompressed?: DecompressedProblem | null,
  industryContext?: string | null,
): string {
  const top3 = reportData.opportunities
    .slice(0, 3)
    .map((o, i) =>
      `Opportunity ${i + 1}: ${o.title}
  Department: ${o.department}
  Current process: ${o.workflowDescription}
  Automation: ${o.opportunityDescription}
  Tools: ${o.recommendedTools.map((t) => `${t.name} (${t.pricing})`).join(', ')}
  Annual savings (conservative to best case): ${fmtRange(o.annualSavings, o.annualSavingsConservative)}
  Timeline: ${o.implementationWeeks} weeks
  Quick win: ${o.quickWin}`
    )
    .join('\n\n');

  const problemContext = decompressed
    ? `PROBLEM ANALYSIS (use this to frame the proposal — address the real problem, not just the stated challenge):
Real problem: ${decompressed.realProblem}
Key assumptions to validate: ${decompressed.keyAssumptions.join(' / ')}
Proposal opening framing: ${decompressed.proposalFraming}

`
    : '';

  const industryBlock = industryContext
    ? `INDUSTRY CONTEXT (use to strengthen urgency framing in the executiveSummary or emailBody; quote a figure only with its source named beside it, and add no industry figures of your own):
${industryContext}

`
    : '';

  return `PREPARED DATE: ${preparedDate}

${problemContext}${industryBlock}COMPANY: ${intake.companyName}
URL: ${intake.companyUrl}
CONTACT NAME: ${intake.contactName}
INDUSTRY: ${intake.industry}
TEAM SIZE: ${intake.employeeRange} employees
WHAT THEY WOULD NEVER DO AGAIN: "${intake.biggestChallenge}"
${intake.hoursPerWeek ? `HOURS PER WEEK ON IT (their number): ${intake.hoursPerWeek}\n` : ''}
AUDIT EXECUTIVE SUMMARY:
- Headline: ${reportData.executiveSummary.headline}
- SAVINGS RANGE (conservative to best case): ${fmtRange(reportData.executiveSummary.totalAnnualSavings, reportData.executiveSummary.totalAnnualSavingsConservative)}
- Top opportunity: ${reportData.executiveSummary.topOpportunity}
- Urgency: ${reportData.executiveSummary.urgencyNote}

${trafficSummary ? `TRAFFIC DATA: ${trafficSummary}` : ''}

TOP 3 OPPORTUNITIES (ranked by annual savings):
${top3}

ENGAGEMENT TERMS:
- Plan: free ${TRIAL_DAYS}-day trial on their real data. If they keep it: ${fmtUsd(SETUP_FEE_USD)} setup, then ${fmtUsd(MONTHLY_FEE_USD)} a month (founding price) including up to ${MONTHLY_INCLUDED_HOURS} change hours; extra hours ${fmtUsd(EXTRA_HOUR_RATE_USD)}; ${MIN_TERM_MONTHS}-month minimum.
- Custom builds: one fixed price quoted before work starts, never hourly.
- Team handoff, included with every build: ${TEAM_HANDOFF}
- Calendly link: https://calendly.com/maxwexley-wexadvisory/30min

Generate the proposal JSON. Be specific to ${intake.companyName} — reference their actual processes and tools, not generic descriptions.`;
}

export async function generateProposalContent(
  intake: SnapshotIntake,
  reportData: AuditReportData,
  trafficSummary: string,
  decompressed?: DecompressedProblem | null,
  industryContext?: string | null,
): Promise<{ content: ProposalContent; inputTokens: number; outputTokens: number }> {
  const preparedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
  });

  // Trimmed: the Vercel value carries a trailing newline, and the API 404s on
  // "claude-opus-4-8\n" (every production proposal failed this way once the
  // after() freeze was fixed on 2026-10-19). Same fix as AUDIT_MODEL in synthesize.ts.
  const model = (process.env.PROPOSAL_MODEL ?? 'claude-opus-4-8').trim();
  console.log(`[proposal] using model: ${model}`);

  const message = await getClient().messages.create({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: buildUserMessage(intake, reportData, trafficSummary, preparedDate, decompressed, industryContext),
    }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Proposal generation returned no JSON');

  const content: ProposalContent = stripEmDashesDeep(JSON.parse(match[0]));
  // The subject's dollar figure is set in code: the range when the audit has one.
  if (typeof content.emailSubject === 'string') {
    content.emailSubject = replaceMoney(
      content.emailSubject,
      fmtRange(reportData.executiveSummary.totalAnnualSavings, reportData.executiveSummary.totalAnnualSavingsConservative),
    );
  }
  // Tool prices the model was shown are not our fees, so the terms check exempts them.
  assertProposalTerms(content, {
    thirdPartyPrices: reportData.opportunities.flatMap((o) => (o.recommendedTools ?? []).map((t) => t.pricing)),
  });
  attachAuditFigures(content, reportData);
  // Log-only: the email body is model text; an unrounded figure means it
  // quoted a single number instead of a range (2026-10-19 draft said "$115,057").
  const exact = exactDollarFigures(content.emailBody);
  if (exact.length > 0) {
    console.warn(`[proposal] note: emailBody quotes single figures ${exact.join(', ')} instead of ranges`);
  }
  return {
    content,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
}
