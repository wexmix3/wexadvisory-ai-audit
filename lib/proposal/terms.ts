import type { ProposalContent } from '@/types/audit';

// Engagement terms quoted in every automatic proposal. The prompt, the PDFs
// and the terms check all read these, so they cannot disagree. Change a price
// here only. Model since 2026-11-02 (Max): free AI Audit, then a free trial on
// real data, then setup + a monthly plan if they keep it. Custom one-off
// builds are one fixed price estimated from hours, never billed by the hour.
// The site (wex-advisory) states the same terms; keep the two in step.
export const BUILD_RATE_USD = 200; // also drives the audit's build-cost math (synthesize.ts)
export const EXTRA_HOUR_RATE_USD = 150; // change hours beyond the monthly allowance
export const TRAINING_RATE_USD = 200;
export const SETUP_FEE_USD = 1000;
export const MONTHLY_FEE_USD = 300; // founding price
export const MONTHLY_INCLUDED_HOURS = 2;
export const TRIAL_DAYS = 30;
export const MIN_TERM_MONTHS = 3;

/** "$1,000". ASCII only, safe for Helvetica. */
export function fmtUsd(n: number): string {
  return `$${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/** Fixed-price estimate from build hours, each end rounded to the nearest $100. */
export function fixedPriceRange(hoursLow: number, hoursHigh: number): [number, number] {
  const round100 = (n: number) => Math.max(100, Math.round(n / 100) * 100);
  return [round100(hoursLow * BUILD_RATE_USD), round100(hoursHigh * BUILD_RATE_USD)];
}

// Printed verbatim in the PDF. ASCII only (Helvetica has no other glyphs).
// Kept to what one consultant can deliver: no lifetime access, no monthly
// sessions, no on-site visits.
export const TEAM_HANDOFF =
  'Every build includes a live walkthrough for your team, about an hour, on the tools as they run in ' +
  'your business. The session is recorded, and you keep the recording and a short written guide. ' +
  'While we are working together, there is a refresher each quarter and the guide is updated when ' +
  `the tools change. Further training is available at $${TRAINING_RATE_USD} per hour.`;

// Printed verbatim in the PDF's AFTER LAUNCH box, after the model's own
// sentence on what the plan covers for this company. The model is told not to
// restate these terms at length, so the full wording lives only here.
export const MONTHLY_PLAN_TERMS =
  `Start with a free ${TRIAL_DAYS}-day trial on your real data. The price and the day-${TRIAL_DAYS} date ` +
  'are in writing on day one, and setup work during the trial is free. If you keep it: ' +
  `${fmtUsd(SETUP_FEE_USD)} setup (half at signing, half at go-live) and ${fmtUsd(MONTHLY_FEE_USD)} a month ` +
  `(founding price). The monthly covers upkeep and up to ${MONTHLY_INCLUDED_HOURS} hours of changes; ` +
  `extra hours are ${fmtUsd(EXTRA_HOUR_RATE_USD)}. ${MIN_TERM_MONTHS}-month minimum, then month to month. ` +
  'Custom one-off builds are one fixed price, quoted before work starts (estimated from hours at ' +
  `${fmtUsd(BUILD_RATE_USD)}/hr). Never billed hour by hour.`;

// Terms the model must not introduce. A proposal that quotes a rate or a
// promise we do not offer is worse than no proposal, so this throws and the
// pipeline records the failure and alerts. negatable: a match right after
// "never"/"not"/"no" is the correct statement, not a violation.
const OFF_TERMS: { pattern: RegExp; label: string; negatable?: boolean }[] = [
  { pattern: /retainer/i, label: 'a retainer (we sell a monthly plan, not a retainer)' },
  // Billing language is about our invoices; client staff are "paid", not "billed".
  { pattern: /\bbilled\s+(?:hourly|by the hour|per hour|hour by hour|on an hourly basis)\b/i, label: 'hourly billing', negatable: true },
  { pattern: /\bhourly\s+(?:maintenance|support|upkeep|billing)\b/i, label: 'hourly maintenance', negatable: true },
  { pattern: /\bmaintenance rate\b/i, label: 'a maintenance rate (retired 2026-11-02)' },
  // "as needed" only next to support words, so "the team pulls reports as needed" stays legal.
  { pattern: /\b(?:maintenance|support|upkeep|billed|billing|hours)\b[^.\n]{0,40}\bas[- ]needed\b/i, label: '"as needed" support', negatable: true },
  { pattern: /\bas[- ]needed\b[^.\n]{0,25}\b(?:maintenance|support|upkeep|basis)\b/i, label: '"as needed" support', negatable: true },
  { pattern: /lifetime access/i, label: 'lifetime access' },
  { pattern: /on-?site (visit|training|session)/i, label: 'on-site visits' },
];

const NEGATION = /\b(?:never|not|no|isn't|aren't|nothing)\b[^.\n]{0,20}$/i;

const HOURLY_RATE = /\$\s?(\d[\d,]*)\s*(?:\/\s*h(?:ou)?r|per hour|an hour)/gi;
const MONTHLY_FIGURE = /\$\s?(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:\/\s*mo(?:nth)?\b|per\s+month\b|a\s+month\b|each\s+month\b|every\s+month\b|monthly\b)/gi;
const SETUP_FIGURE_BEFORE = /\$\s?(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:one[- ]time\s+)?set-?up\b/gi;
const SETUP_FIGURE_AFTER = /\bset-?up(?:\s+fee)?(?:\s+(?:is|of|at|costs?|runs?))?\s*[:(]?\s*\$\s?(\d[\d,]*(?:\.\d+)?)\s*(k)?/gi;

// A $/month or setup figure is someone else's (a tool's price, the client's
// savings or labor) when its sentence says so and does not also talk about
// our plan. Everything else is read as our fee and must match the constants.
const OUR_CUE = /\b(?:wex|founding|monthly plan|our plan|the plan|plan (?:is|at)|monthly fee|our fee|upkeep|after launch|go-live|keep it|retainer|change hours|included hours|minimum|trial)\b/i;
const THIRD_PARTY_CUE = /\b(?:sav(?:e|es|ed|ing|ings)|recover\w*|free[sd]? up|lost|losing|wast\w*|labou?r|staff|payroll|wages?|salar\w*|costs?|subscriptions?|licen[cs]es?|seats?|tiers?|pricing|priced|per user|software|tools?|apps?)\b/i;

// A "." between digits ($10.59) or inside a domain (Make.com) is not a sentence end.
const SENTENCE_END = /[;\n]|\.(?![\w])/g;

function sentenceAround(text: string, index: number): string {
  let start = 0;
  let end = text.length;
  for (const m of text.matchAll(SENTENCE_END)) {
    const i = m.index ?? 0;
    if (i < index) start = i + 1;
    else { end = i; break; }
  }
  return text.slice(start, end);
}

function amountOf(digits: string, k: string | undefined): number {
  return Number(digits.replace(/,/g, '')) * (k ? 1000 : 1);
}

function dollarAmounts(text: string): Set<number> {
  const out = new Set<number>();
  for (const m of text.matchAll(/\$\s?(\d[\d,]*(?:\.\d+)?)\s*(k)?/gi)) out.add(amountOf(m[1], m[2]));
  return out;
}

export interface TermsCheckOptions {
  /** Third-party price strings the model was shown (audit tool pricing). Matching amounts are exempt. */
  thirdPartyPrices?: string[];
}

/** Every terms problem in a proposal, without throwing. */
export function proposalTermsProblems(content: ProposalContent, opts: TermsCheckOptions = {}): string[] {
  const problems: string[] = [];
  const knownPrices = dollarAmounts((opts.thirdPartyPrices ?? []).join(' '));

  if (typeof content.ongoingSupportDescription !== 'string' || !content.ongoingSupportDescription.trim()) {
    problems.push('ongoingSupportDescription is missing or empty');
  }

  // Fields where we state our own terms. executiveSummary and opportunities
  // are left out on purpose: they describe the client's business, which
  // legitimately quotes tool prices ("Zapier $20/month"), the client's own
  // retainers, and staff hourly costs. A false positive there would throw
  // away a paid proposal with no retry.
  const ours: [string, string][] = [
    ['engagementScope', content.engagementScope ?? ''],
    ['engagementTimeline', content.engagementTimeline ?? ''],
    ['ongoingSupportDescription', content.ongoingSupportDescription ?? ''],
    ['nextStep', content.nextStep ?? ''],
    ['emailBody', content.emailBody ?? ''],
  ];

  for (const [field, text] of ours) {
    for (const { pattern, label, negatable } of OFF_TERMS) {
      const m = pattern.exec(text);
      if (!m) continue;
      if (negatable && NEGATION.test(text.slice(Math.max(0, m.index - 30), m.index))) continue;
      problems.push(`${field} mentions ${label}`);
    }

    const isTheirs = (index: number, amount: number) => {
      if (knownPrices.has(amount)) return true;
      const sentence = sentenceAround(text, index);
      return THIRD_PARTY_CUE.test(sentence) && !OUR_CUE.test(sentence);
    };

    for (const m of text.matchAll(MONTHLY_FIGURE)) {
      const amount = amountOf(m[1], m[2]);
      if (amount !== MONTHLY_FEE_USD && !isTheirs(m.index ?? 0, amount)) {
        problems.push(`${field} quotes ${fmtUsd(amount)} a month; the monthly plan is ${fmtUsd(MONTHLY_FEE_USD)}`);
      }
    }
    for (const re of [SETUP_FIGURE_BEFORE, SETUP_FIGURE_AFTER]) {
      for (const m of text.matchAll(re)) {
        const amount = amountOf(m[1], m[2]);
        if (amount !== SETUP_FEE_USD && !isTheirs(m.index ?? 0, amount)) {
          problems.push(`${field} quotes ${fmtUsd(amount)} setup; setup is ${fmtUsd(SETUP_FEE_USD)}`);
        }
      }
    }
  }

  // Any hourly rate we quote in our own terms must be one we charge. emailBody
  // is exempt (unchanged from before 2026-11-02): it opens with what we found,
  // which often cites the client's staff cost ("a $45/hr coordinator").
  const rates = new Set([BUILD_RATE_USD, EXTRA_HOUR_RATE_USD, TRAINING_RATE_USD]);
  for (const [field, text] of ours.filter(([f]) => f !== 'emailBody')) {
    for (const match of text.matchAll(HOURLY_RATE)) {
      const rate = Number(match[1].replace(/,/g, ''));
      if (!rates.has(rate)) {
        problems.push(`${field} quotes $${rate}/hr, which is not a current rate`);
      }
    }
  }

  return problems;
}

export function assertProposalTerms(content: ProposalContent, opts: TermsCheckOptions = {}): void {
  const problems = proposalTermsProblems(content, opts);
  if (problems.length > 0) {
    throw new Error(`Proposal failed the terms check: ${problems.join('; ')}`);
  }
}
