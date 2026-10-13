import type { ProposalContent } from '@/types/audit';

// Engagement terms quoted in every automatic proposal. The prompt and the PDF
// both read these, so the two cannot disagree. Change a rate here only.
export const BUILD_RATE_USD = 200;
export const MAINTENANCE_RATE_USD = 150;

// Printed verbatim in the PDF. ASCII only (Helvetica has no other glyphs).
// Kept to what one consultant can deliver: no lifetime access, no monthly
// sessions, no on-site visits.
export const TEAM_HANDOFF =
  'Every build includes a live walkthrough for your team, about an hour, on the tools as they run in ' +
  'your business. The session is recorded, and you keep the recording and a short written guide. ' +
  'While we are working together, there is a refresher each quarter and the guide is updated when ' +
  `the tools change. Further training is available at $${BUILD_RATE_USD} per hour.`;

// Printed verbatim in the PDF after the model's maintenance text. Retainers
// vary by project, so no amount is stated here and the model may not write
// about retainers itself (see OFF_TERMS): it would have to invent a number.
export const RETAINER_TERMS =
  'Where a project needs ongoing work every month, a monthly retainer is available. The amount ' +
  'depends on the project and is quoted before you commit.';

// Terms the model must not introduce. A proposal that quotes a rate or a
// promise we do not offer is worse than no proposal, so this throws and the
// pipeline records the failure and alerts.
const OFF_TERMS: { pattern: RegExp; label: string }[] = [
  { pattern: /retainer/i, label: 'a retainer (only RETAINER_TERMS may state it)' },
  { pattern: /\$\s?300\s*(\/|per|a)\s*mo/i, label: 'the retired $300/mo retainer' },
  { pattern: /lifetime access/i, label: 'lifetime access' },
  { pattern: /on-?site (visit|training|session)/i, label: 'on-site visits' },
];

const HOURLY_RATE = /\$\s?(\d[\d,]*)\s*(?:\/\s*h(?:ou)?r|per hour|an hour)/gi;

export function assertProposalTerms(content: ProposalContent): void {
  const problems: string[] = [];

  if (typeof content.ongoingSupportDescription !== 'string' || !content.ongoingSupportDescription.trim()) {
    problems.push('ongoingSupportDescription is missing or empty');
  }

  // Fields where we state our own terms. Opportunity text is left out on
  // purpose: it describes the client's business, which may itself run on
  // retainers or quote its own staff's hourly cost.
  const ours: [string, string][] = [
    ['engagementScope', content.engagementScope ?? ''],
    ['engagementTimeline', content.engagementTimeline ?? ''],
    ['ongoingSupportDescription', content.ongoingSupportDescription ?? ''],
    ['emailBody', content.emailBody ?? ''],
  ];

  for (const [field, text] of ours) {
    for (const { pattern, label } of OFF_TERMS) {
      if (pattern.test(text)) problems.push(`${field} mentions ${label}`);
    }
  }

  // Any hourly rate we quote in our own terms must be one of the two we charge.
  for (const [field, text] of ours.filter(([f]) => f !== 'emailBody')) {
    for (const match of text.matchAll(HOURLY_RATE)) {
      const rate = Number(match[1].replace(/,/g, ''));
      if (rate !== BUILD_RATE_USD && rate !== MAINTENANCE_RATE_USD) {
        problems.push(`${field} quotes $${rate}/hr, which is not a current rate`);
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(`Proposal failed the terms check: ${problems.join('; ')}`);
  }
}
