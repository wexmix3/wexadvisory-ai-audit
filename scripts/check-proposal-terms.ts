// Checks lib/proposal/terms.ts: the terms gate every auto-proposal passes
// through, and the plan wording printed in the PDF. Structure and invariants
// only, never exact-match on generated wording. No API calls.
// Run: node --experimental-strip-types scripts/check-proposal-terms.ts

import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BUILD_RATE_USD,
  EXTRA_HOUR_RATE_USD,
  MIN_TERM_MONTHS,
  MONTHLY_FEE_USD,
  MONTHLY_INCLUDED_HOURS,
  MONTHLY_PLAN_TERMS,
  SETUP_FEE_USD,
  TEAM_HANDOFF,
  TRAINING_RATE_USD,
  TRIAL_DAYS,
  fixedPriceRange,
  fmtUsd,
  proposalTermsProblems,
  assertProposalTerms,
} from '../lib/proposal/terms.ts';
import type { ProposalContent } from '../types/audit';

let checks = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  checks++;
  console.log(`  ok  ${name}`);
}

function proposal(over: Partial<ProposalContent> = {}): ProposalContent {
  return {
    contactFirstName: 'Dana',
    companyName: 'Acme Dental',
    companyUrl: 'https://acmedental.example',
    preparedDate: 'November 02, 2026',
    executiveSummary: 'Acme Dental loses front-desk time to insurance checks; the audit found $29K-$59K a year in savings.',
    opportunities: [
      {
        title: 'Insurance eligibility checks',
        currentState: 'Front desk checks each patient by phone the day before.',
        proposedApproach: 'A Make.com scenario pulls eligibility from the payer portal each night.',
        estimatedSavings: 40000,
        estimatedSavingsConservative: 20000,
        timelineWeeks: 3,
        buildHoursLow: 12,
        buildHoursHigh: 20,
      },
    ],
    totalSavingsBest: 59000,
    totalSavingsConservative: 29000,
    totalOpportunities: 4,
    engagementScope: '- Build the nightly eligibility check in Make.com\n- Daily exceptions list to the front desk',
    engagementTimeline: 'Phase 1 (Weeks 1-4): eligibility check live. After launch: the monthly plan.',
    ongoingSupportDescription: 'The monthly plan covers keeping the payer connections working and small changes as your schedule rules shift.',
    nextStep: 'Book a 30-minute call to start the free trial.',
    emailSubject: 'Acme Dental: $29K-$59K in front-desk time',
    emailBody: 'Hi Dana,\n\nWe found $29K-$59K a year.\n\nYou can try it free for 30 days on your real data.\n\nMax Wexley, Wex Advisory',
    ...over,
  };
}

function fails(over: Partial<ProposalContent>): boolean {
  return proposalTermsProblems(proposal(over)).length > 0;
}

console.log('check-proposal-terms');

await check('clean proposal passes (and assertProposalTerms does not throw)', () => {
  assert.deepEqual(proposalTermsProblems(proposal()), []);
  assertProposalTerms(proposal());
});

await check('monthly fee: $300/month passes, $350/month fails', () => {
  assert.equal(fails({ ongoingSupportDescription: 'The monthly plan is $300/month and covers upkeep.' }), false);
  assert.equal(fails({ engagementTimeline: 'After launch: $300 a month.' }), false);
  assert.equal(fails({ ongoingSupportDescription: 'The monthly plan is $350/month and covers upkeep.' }), true);
  assert.equal(fails({ emailBody: 'After launch it is $350 per month.' }), true);
  assert.equal(fails({ nextStep: 'Keep it for $500 monthly.' }), true);
});

await check('setup fee: $1,000 setup passes, $1,500 setup fails', () => {
  assert.equal(fails({ engagementTimeline: 'If you keep it: $1,000 setup, half at signing.' }), false);
  assert.equal(fails({ engagementTimeline: 'If you keep it: $1,500 setup, half at signing.' }), true);
  assert.equal(fails({ emailBody: 'There is a setup fee of $2,000 after the trial.' }), true);
});

await check('hourly: $150/hr and $200/hr pass, $175/hr fails', () => {
  assert.equal(fails({ engagementScope: '- Extra change hours at $150/hr' }), false);
  assert.equal(fails({ engagementScope: '- Training at $200 per hour' }), false);
  assert.equal(fails({ engagementScope: '- Extra change hours at $175/hr' }), true);
});

await check('off terms: retainer and hourly / as-needed support fail', () => {
  assert.equal(fails({ ongoingSupportDescription: 'A monthly retainer covers changes.' }), true);
  assert.equal(fails({ engagementTimeline: 'After launch: support billed hourly as needed.' }), true);
  assert.equal(fails({ ongoingSupportDescription: 'Hourly maintenance covers fixes.' }), true);
  assert.equal(fails({ emailBody: 'Support after launch is billed at our rate as needed.' }), true);
});

await check('negated terms and "as needed" work (not billing) pass', () => {
  assert.equal(fails({ emailBody: 'Custom work is one fixed price, never billed by the hour.' }), false);
  assert.equal(fails({ emailBody: 'We do not use retainers.' }), false);
  assert.equal(fails({ engagementTimeline: 'No hourly billing, no retainer.' }), false);
  assert.equal(fails({ ongoingSupportDescription: 'Covers monitoring, support and fixes as needed when APIs change.' }), false);
});

await check('client staff cost and tool prices outside our fields pass', () => {
  const p = proposal({
    executiveSummary: 'Automation frees up 10 hours a week of a $40/hr coordinator; Zapier costs $20/month.',
    opportunities: [{
      ...proposal().opportunities[0],
      currentState: 'A $40/hr coordinator re-keys claims; they pay a billing retainer and use Zapier at $20/month.',
      proposedApproach: 'Zapier costs $20/month; frees up 10 hours a week of a $40/hr coordinator.',
    }],
  });
  assert.deepEqual(proposalTermsProblems(p), []);
});

await check('tool prices and savings inside our fields pass', () => {
  assert.equal(fails({ engagementScope: '- Set up Zapier, which costs $20/month' }), false);
  assert.equal(fails({ emailBody: 'This saves your team about $4K a month in staff time.' }), false);
  // Bare tool prices in the scope list: the model is shown tool pricing and names the tools.
  for (const line of [
    '- Zapier $20/month',
    '- Build it in Airtable ($24/mo)',
    '- Make.com plan ($29/month) runs the scenarios',
    '- Build on Make.com at $9/month',
    '- Twilio number at $2/month plus usage',
  ]) assert.equal(fails({ engagementScope: line }), false, line);
  assert.equal(fails({ emailBody: 'Expect about $3,000 a month back.' }), false);
  // Client staff cost in our fields is not a rate we quote.
  assert.equal(fails({ engagementScope: '- Replace the $45/hr coordinator data entry' }), false);
  assert.equal(fails({ engagementScope: '- Frees 10 hrs a week of a $45 an hour clerk' }), false);
  // A tool word does not excuse a wrong number for our own plan.
  assert.equal(fails({ ongoingSupportDescription: 'Our plan costs $350/month for the tools.' }), true);
  assert.equal(fails({ ongoingSupportDescription: 'After launch the monthly plan is $500/month.' }), true);
  assert.equal(fails({ nextStep: 'Setup is $1,500 if you keep it.' }), true);
});

await check('empty ongoingSupportDescription fails', () => {
  assert.equal(fails({ ongoingSupportDescription: '' }), true);
  assert.equal(fails({ ongoingSupportDescription: '   ' }), true);
  assert.throws(() => assertProposalTerms(proposal({ ongoingSupportDescription: '' })), /terms check/);
});

await check('PDF wording is ASCII only, carries every constant, and passes its own gate', () => {
  for (const text of [MONTHLY_PLAN_TERMS, TEAM_HANDOFF]) {
    assert.match(text, /^[\x20-\x7E]*$/, 'non-ASCII or control character in PDF wording');
    assert.doesNotMatch(text, / x /, '"x" used as multiply');
  }
  for (const figure of [fmtUsd(SETUP_FEE_USD), fmtUsd(MONTHLY_FEE_USD), fmtUsd(EXTRA_HOUR_RATE_USD), fmtUsd(BUILD_RATE_USD)]) {
    assert.ok(MONTHLY_PLAN_TERMS.includes(figure), `MONTHLY_PLAN_TERMS is missing ${figure}`);
  }
  for (const n of [TRIAL_DAYS, MONTHLY_INCLUDED_HOURS, MIN_TERM_MONTHS]) {
    assert.ok(MONTHLY_PLAN_TERMS.includes(String(n)), `MONTHLY_PLAN_TERMS is missing ${n}`);
  }
  assert.ok(TEAM_HANDOFF.includes(fmtUsd(TRAINING_RATE_USD)), 'TEAM_HANDOFF is missing the training rate');
  // If the model echoes either text verbatim, the gate must not throw.
  assert.deepEqual(proposalTermsProblems(proposal({ emailBody: MONTHLY_PLAN_TERMS, ongoingSupportDescription: TEAM_HANDOFF })), []);
});

await check('fixed-price range rounds to $100 and follows the build rate', () => {
  assert.deepEqual(fixedPriceRange(12, 20), [12 * BUILD_RATE_USD, 20 * BUILD_RATE_USD]);
  const [lo, hi] = fixedPriceRange(12.3, 19.7);
  assert.equal(lo % 100, 0);
  assert.equal(hi % 100, 0);
  assert.ok(lo <= hi);
  assert.equal(fmtUsd(1000), '$1,000');
});

// Render check. proposal-pdf.tsx is TSX with "@/" imports, which strip-types
// cannot load, so this goes through jiti (already in node_modules via eslint
// and tailwind). Skipped with a note if that is unavailable.
await (async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  let generateProposalPDF: ((c: ProposalContent) => Promise<Buffer>) | undefined;
  try {
    const { createJiti } = await import('jiti');
    const jiti = createJiti(import.meta.url, { jsx: { runtime: 'automatic' }, alias: { '@': root } });
    ({ generateProposalPDF } = await jiti.import<{ generateProposalPDF: (c: ProposalContent) => Promise<Buffer> }>(
      path.join(root, 'lib/pdf/proposal-pdf.tsx'),
    ));
  } catch (err) {
    console.log(`  skip render check: could not load proposal-pdf.tsx (${(err as Error).message.split('\n')[0]})`);
    return;
  }
  await check('proposal PDF renders to a non-empty buffer', async () => {
    const buf = await generateProposalPDF!(proposal());
    assert.ok(Buffer.isBuffer(buf) && buf.length > 1000, 'PDF buffer is empty');
    assert.equal(buf.subarray(0, 5).toString(), '%PDF-');
    const out = process.env.TERMS_PDF_OUT;
    if (out) writeFileSync(out, buf);
  });
})();

console.log(`check-proposal-terms: ${checks} checks passed`);
