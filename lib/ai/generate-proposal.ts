import Anthropic from '@anthropic-ai/sdk';
import type { AuditReportData, SnapshotIntake, ProposalContent } from '@/types/audit';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    client = new Anthropic({ apiKey });
  }
  return client;
}

const SYSTEM_PROMPT = `You are a senior consultant at Wex Advisory, a boutique AI consulting firm. You write concise, formal consulting proposals for small to mid-market businesses. Your tone is direct, professional, and confident — never generic, never padded.

You will receive a completed AI opportunity audit for a company and produce a structured proposal JSON.

RULES:
1. Reference the company by name throughout — never say "your company" generically
2. The executiveSummary must reference their specific top opportunity and savings figure
3. Each opportunity's proposedApproach must name the specific tools already identified in the audit
4. engagementScope must describe concrete deliverables (e.g., "Build and deploy a Make.com automation for X"), not vague scope
5. Keep every string field concise — no paragraph over 4 sentences
6. emailBody must be 3-4 short paragraphs: (1) what we found, (2) what we propose, (3) CTA. Formal but human.
7. emailSubject must be specific — reference company name and top savings figure
8. All monetary values must use exact figures from the audit, not rounded estimates

Output ONLY valid JSON — no markdown, no preamble:

{
  "contactFirstName": "string — first name only",
  "companyName": "string",
  "companyUrl": "string",
  "preparedDate": "string — formatted as Month DD, YYYY",
  "executiveSummary": "string — 2-3 sentences: what we found, total identified savings, why now",
  "opportunities": [
    {
      "title": "string — exact opportunity title from audit",
      "currentState": "string — 1-2 sentences describing the current manual process",
      "proposedApproach": "string — 1-2 sentences naming the specific tools and what we would build",
      "estimatedSavings": 0,
      "timelineWeeks": 0
    }
  ],
  "engagementScope": "string — bullet-point style description of concrete deliverables for Phase 1 (quick wins). Use \\n to separate items.",
  "engagementTimeline": "string — e.g. 'Phase 1 (Weeks 1-4): Quick wins implementation. Phase 2 (Weeks 5-16): Foundation build. Ongoing: Monthly retainer for maintenance and optimization.'",
  "monthlyRetainerDescription": "string — 1-2 sentences on what the $300/mo retainer covers",
  "nextStep": "string — specific CTA sentence pointing to the Calendly link",
  "emailSubject": "string — specific subject line referencing company and top savings",
  "emailBody": "string — 3-4 paragraph email body. Use \\n\\n between paragraphs. Formal consulting tone. Sign off as Max Wexley, Wex Advisory."
}`;

function buildUserMessage(
  intake: SnapshotIntake,
  reportData: AuditReportData,
  trafficSummary: string,
  preparedDate: string,
): string {
  const top3 = reportData.opportunities
    .slice(0, 3)
    .map((o, i) =>
      `Opportunity ${i + 1}: ${o.title}
  Department: ${o.department}
  Current process: ${o.workflowDescription}
  Automation: ${o.opportunityDescription}
  Tools: ${o.recommendedTools.map((t) => `${t.name} (${t.pricing})`).join(', ')}
  Annual savings: $${o.annualSavings.toLocaleString()}
  Timeline: ${o.implementationWeeks} weeks
  Quick win: ${o.quickWin}`
    )
    .join('\n\n');

  return `PREPARED DATE: ${preparedDate}

COMPANY: ${intake.companyName}
URL: ${intake.companyUrl}
CONTACT NAME: ${intake.contactName}
INDUSTRY: ${intake.industry}
TEAM SIZE: ${intake.employeeRange} employees
BIGGEST CHALLENGE: "${intake.biggestChallenge}"

AUDIT EXECUTIVE SUMMARY:
- Headline: ${reportData.executiveSummary.headline}
- Total annual savings identified: $${reportData.executiveSummary.totalAnnualSavings.toLocaleString()}
- Quick win savings: $${reportData.executiveSummary.quickWinSavings.toLocaleString()}
- Top opportunity: ${reportData.executiveSummary.topOpportunity}
- Urgency: ${reportData.executiveSummary.urgencyNote}

${trafficSummary ? `TRAFFIC DATA: ${trafficSummary}` : ''}

TOP 3 OPPORTUNITIES (ranked by annual savings):
${top3}

ENGAGEMENT RATES:
- Hourly build rate: $150/hr
- Monthly retainer: $300/mo (ongoing maintenance, optimization, and on-call support after Phase 1)
- Calendly link: https://calendly.com/maxwexley-wexadvisory/free-strategy-call

Generate the proposal JSON. Be specific to ${intake.companyName} — reference their actual processes and tools, not generic descriptions.`;
}

export async function generateProposalContent(
  intake: SnapshotIntake,
  reportData: AuditReportData,
  trafficSummary: string,
): Promise<{ content: ProposalContent; inputTokens: number; outputTokens: number }> {
  const preparedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
  });

  const message = await getClient().messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: buildUserMessage(intake, reportData, trafficSummary, preparedDate),
    }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Proposal generation returned no JSON');

  const content: ProposalContent = JSON.parse(match[0]);
  return {
    content,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
}
