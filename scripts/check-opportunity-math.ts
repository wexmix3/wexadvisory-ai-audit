// Checks the code-computed numbers in lib/ai/opportunity-math.ts.
// Structure and numbers only, never generated wording.
// Run: node --experimental-strip-types scripts/check-opportunity-math.ts

import assert from 'node:assert/strict';
import {
  computeWorthAutomatingScore,
  dropUnworthyOpportunities,
  failsWorthAutomating,
  fmtRange,
  opportunityMathIssues,
  opportunityMathNotes,
  verifyOpportunityMath,
} from '../lib/ai/opportunity-math.ts';
import type { AuditReportData, OpportunityItem, WorthAutomating } from '../types/audit';

const RATE = 200;
let checks = 0;
function check(name: string, fn: () => void) {
  fn();
  checks++;
  console.log(`  ok  ${name}`);
}

const GOOD_WORTH: WorthAutomating = { minutesPerRun: 12, runsPerMonth: 480, skillGap: 1, mistakeCost: 2, needsTheirData: 2 };

function opp(over: Partial<OpportunityItem> = {}): OpportunityItem {
  return {
    id: 'opp-001',
    department: 'Sales',
    title: 'Follow-up emails',
    workflowDescription: 'Rep copies each lead into a template and sends it by hand after every call.',
    opportunityDescription: 'HubSpot sequence sends it.',
    frequency: 'Daily',
    hoursPerMonth: 32,
    fteCountAffected: 3,
    fullyLoadedHourlyRate: 45,
    annualLaborCost: 51840,
    automationCeilingPct: 75,
    annualSavings: 38880,
    confidenceLevel: 'high',
    complexity: 'low',
    implementationWeeks: 3,
    implementationCostLow: 1500,
    implementationCostHigh: 4000,
    roiMonths: 1,
    recommendedTools: [{ name: 'HubSpot Sequences', purpose: 'cadences', pricing: '$45/mo' }],
    quickWin: true,
    ...over,
  };
}

function phase(items: AuditReportData['implementationRoadmap']['phase1']['items'], totalInvestment: number) {
  return { name: 'P', durationWeeks: 4, items, totalInvestment, totalSavings: 1000 };
}

function report(opps: OpportunityItem[], over: Partial<AuditReportData> = {}): AuditReportData {
  return {
    executiveSummary: {
      headline: 'Acme could save $999K/year by automating 4 workflows',
      totalAnnualSavings: 999000,
      quickWinSavings: 1,
      topOpportunity: 'x',
      urgencyNote: 'x',
      confidenceStatement: 'x',
    },
    scores: {} as AuditReportData['scores'],
    opportunities: opps,
    implementationRoadmap: { phase1: phase([], 5000), phase2: phase([], 15000), phase3: phase([], 35000) },
    nextSteps: { immediate: ['a'] },
    ...over,
  };
}

console.log('check-opportunity-math');

check('range math: conservative = half of best, totals and headline range', () => {
  const r = verifyOpportunityMath(
    report([opp(), opp({ id: 'opp-002', title: 'Invoices', hoursPerMonth: 20, fteCountAffected: 1, annualSavings: 0 })]),
    { buildRateUsd: RATE },
  );
  const [a, b] = r.opportunities;
  assert.equal(a.annualSavings, 38880);
  assert.equal(a.annualSavingsConservative, 19440);
  // 20 * 45 * 1 * 12 * 0.75 = 8100 (claimed 0 -> recomputed)
  assert.equal(b.annualSavings, 8100);
  assert.equal(b.annualSavingsConservative, 4050);
  assert.equal(r.executiveSummary.totalAnnualSavings, 46980);
  assert.equal(r.executiveSummary.totalAnnualSavingsConservative, 23490);
  assert.ok(r.executiveSummary.headline.includes('$23K-$47K'), r.executiveSummary.headline);
  assert.ok(!r.executiveSummary.headline.includes('$999K'));
  assert.deepEqual(a.inputSources, {
    hours: 'industry benchmark estimate',
    rate: 'industry benchmark estimate',
    automationShare: 'industry benchmark estimate',
  });
});

check('headline: existing range is replaced whole, not appended to', () => {
  const base = report([opp()]);
  base.executiveSummary.headline = 'Could save $100K-$200K/year';
  const r = verifyOpportunityMath(base, { buildRateUsd: RATE });
  assert.equal((r.executiveSummary.headline.match(/\$/g) ?? []).length, 2, r.executiveSummary.headline);
  // Idempotent: running twice gives the same headline.
  const r2 = verifyOpportunityMath(r, { buildRateUsd: RATE });
  assert.equal(r2.executiveSummary.headline, r.executiveSummary.headline);
  assert.equal(fmtRange(1300000, 650000), '$650K-$1.3M');
  assert.equal(fmtRange(0, 0), '$0');
  assert.equal(fmtRange(400, 200), '$200-$400');
});

check('>20% override still works, within 20% keeps the model figure', () => {
  const off = verifyOpportunityMath(report([opp({ annualSavings: 64800 })]), { buildRateUsd: RATE });
  assert.equal(off.opportunities[0].annualSavings, 38880);
  assert.equal(off.opportunities[0].annualLaborCost, 51840);
  const near = verifyOpportunityMath(report([opp({ annualSavings: 40000 })]), { buildRateUsd: RATE });
  assert.equal(near.opportunities[0].annualSavings, 40000);
  assert.equal(near.opportunities[0].annualSavingsConservative, 20000);
});

check('intake hours applied to the flagged opportunity only, labeled from you', () => {
  const r = verifyOpportunityMath(
    report([opp(), opp({ id: 'opp-002', title: 'Weekly report', usesIntakeHours: true, annualSavings: 5000 })]),
    { buildRateUsd: RATE, intakeHoursPerWeek: 6 },
  );
  const flagged = r.opportunities.find((o) => o.id === 'opp-002')!;
  const other = r.opportunities.find((o) => o.id === 'opp-001')!;
  assert.equal(flagged.fteCountAffected, 1);
  assert.equal(flagged.hoursPerMonth, 26); // round(6 * 4.33)
  assert.equal(flagged.annualSavings, Math.round(26 * 45 * 1 * 12 * 0.75));
  assert.equal(flagged.inputSources?.hours, 'from you');
  assert.equal(flagged.inputSources?.rate, 'industry benchmark estimate');
  assert.equal(other.inputSources?.hours, 'industry benchmark estimate');
  assert.equal(other.hoursPerMonth, 32);
  // Their hours replace the model's; runs are derived from them so the PDF line and score agree,
  // and the hours-consistency note never fires on the flagged opportunity.
  const withWorth = verifyOpportunityMath(
    report([opp({ usesIntakeHours: true, worthAutomating: { ...GOOD_WORTH, minutesPerRun: 15, runsPerMonth: 999 } })]),
    { buildRateUsd: RATE, intakeHoursPerWeek: 2 },
  );
  const w = withWorth.opportunities[0];
  assert.equal(w.hoursPerMonth, 9); // round(2 * 4.33)
  assert.equal(w.worthAutomating?.runsPerMonth, 36); // 9 h * 60 / 15 min
  assert.deepEqual(opportunityMathNotes({ ...withWorth, opportunities: [{ ...w, buildHoursLow: 1, buildHoursHigh: 2 }] }), []);
  assert.deepEqual(opportunityMathIssues({ ...r, opportunities: r.opportunities.map((o) => ({ ...o, worthAutomating: GOOD_WORTH, buildHoursLow: 1, buildHoursHigh: 2 })) }, 6)
    .filter((i) => i.includes('usesIntakeHours') || i.includes('hours/week')), []);
});

check('intake hours: none flagged -> gate issue; invalid hours ignored', () => {
  const r = report([opp({ worthAutomating: GOOD_WORTH, buildHoursLow: 8, buildHoursHigh: 20 })]);
  const issues = opportunityMathIssues(r, 6);
  assert.equal(issues.filter((i) => i.includes('6 hours/week')).length, 1);
  assert.equal(opportunityMathIssues(r, undefined).filter((i) => i.includes('hours/week')).length, 0);
  const bad = verifyOpportunityMath(report([opp({ usesIntakeHours: true })]), { buildRateUsd: RATE, intakeHoursPerWeek: 500 });
  assert.equal(bad.opportunities[0].hoursPerMonth, 32);
  assert.equal(bad.opportunities[0].inputSources?.hours, 'industry benchmark estimate');
});

check('worth-automating score thresholds', () => {
  const w = (o: Partial<WorthAutomating>) => computeWorthAutomatingScore({ ...GOOD_WORTH, ...o });
  assert.equal(w({}), 2 + 2 + 1 + 2 + 2);
  assert.equal(w({ minutesPerRun: 5 }) - w({ minutesPerRun: 4.9 }), 1);
  assert.equal(w({ minutesPerRun: 0.5 }) - w({ minutesPerRun: 0.4 }), 1);
  assert.equal(w({ runsPerMonth: 20 }) - w({ runsPerMonth: 19 }), 1);
  assert.equal(w({ runsPerMonth: 5 }) - w({ runsPerMonth: 4 }), 1);
  assert.equal(w({ skillGap: 9, mistakeCost: -3, needsTheirData: 2 }), 2 + 2 + 2 + 0 + 2); // clamped to 0-2
  assert.equal(computeWorthAutomatingScore({ minutesPerRun: 0, runsPerMonth: 0, skillGap: 0, mistakeCost: 0, needsTheirData: 0 }), 0);
  assert.equal(failsWorthAutomating(opp({ worthAutomating: { ...GOOD_WORTH, needsTheirData: 0 } })), true); // score 7 but no data need
  assert.equal(failsWorthAutomating(opp({ worthAutomating: { minutesPerRun: 1, runsPerMonth: 4, skillGap: 1, mistakeCost: 1, needsTheirData: 2 } })), true); // 1+0+1+1+2 = 5
  assert.equal(failsWorthAutomating(opp({ worthAutomating: { minutesPerRun: 1, runsPerMonth: 5, skillGap: 1, mistakeCost: 1, needsTheirData: 2 } })), false); // 6
  assert.equal(failsWorthAutomating(opp()), false); // no facts -> not judged here (gate flags missing)
  const r = verifyOpportunityMath(report([opp({ worthAutomating: GOOD_WORTH })]), { buildRateUsd: RATE });
  assert.equal(r.opportunities[0].worthAutomatingScore, 9);
});

check('gate: unworthy and missing facts retry; inconsistent hours and missing build hours are notes only', () => {
  const unworthy = opp({ title: 'Draft a LinkedIn post', worthAutomating: { ...GOOD_WORTH, needsTheirData: 0 }, buildHoursLow: 1, buildHoursHigh: 2 });
  // 32 h x 3 FTE = 96 h stated; 2 min x 30 runs = 1 h implied -> 96x off
  const inconsistent = opp({ id: 'o2', title: 'Inconsistent one', worthAutomating: { ...GOOD_WORTH, minutesPerRun: 2, runsPerMonth: 30 }, buildHoursLow: 1, buildHoursHigh: 2 });
  const consistent = opp({ id: 'o3', title: 'Fine', worthAutomating: GOOD_WORTH, buildHoursLow: 1, buildHoursHigh: 2 });
  const missing = opp({ id: 'o4', title: 'No facts' });
  const all = report([unworthy, inconsistent, consistent, missing]);
  const issues = opportunityMathIssues(all);
  assert.ok(issues.some((i) => i.includes('"Draft a LinkedIn post"')));
  assert.ok(issues.some((i) => i.includes('missing worthAutomating')));
  assert.ok(!issues.some((i) => i.includes('inconsistent') || i.includes('buildHours')), 'notes must not retry');
  const notes = opportunityMathNotes(all);
  assert.ok(notes.every((n) => n.startsWith('note: ')));
  assert.ok(notes.some((n) => n.includes('"Inconsistent one"') && !n.includes('"Fine"')));
  assert.ok(notes.some((n) => n.includes('missing buildHoursLow')));
  assert.deepEqual(opportunityMathIssues(report([consistent])), []);
  assert.deepEqual(opportunityMathNotes(report([consistent])), []);
});

check('drop unworthy only when 3+ remain', () => {
  const good = (id: string, s: number) => opp({ id, title: id, worthAutomating: GOOD_WORTH, annualSavings: s, hoursPerMonth: s / (45 * 3 * 12 * 0.75) });
  const bad = opp({ id: 'bad', title: 'bad', worthAutomating: { ...GOOD_WORTH, needsTheirData: 0 } });
  const four = verifyOpportunityMath(report([good('a', 30000), good('b', 20000), good('c', 10000), bad]), { buildRateUsd: RATE });
  const dropped = dropUnworthyOpportunities(four);
  assert.deepEqual(dropped.dropped, ['bad']);
  assert.equal(dropped.data.opportunities.length, 3);
  assert.equal(dropped.data.executiveSummary.totalAnnualSavings, 60000);
  assert.equal(dropped.data.executiveSummary.totalAnnualSavingsConservative, 30000);
  const three = verifyOpportunityMath(report([good('a', 30000), good('b', 20000), bad]), { buildRateUsd: RATE });
  const kept = dropUnworthyOpportunities(three);
  assert.deepEqual(kept.dropped, []);
  assert.equal(kept.data.opportunities.length, 3);
  // The opportunity carrying their own hours is never dropped.
  const flaggedBad = opp({ id: 'mine', title: 'mine', usesIntakeHours: true, worthAutomating: { ...GOOD_WORTH, needsTheirData: 0 } });
  const withMine = dropUnworthyOpportunities(
    verifyOpportunityMath(report([good('a', 30000), good('b', 20000), good('c', 10000), flaggedBad]), { buildRateUsd: RATE, intakeHoursPerWeek: 3 }),
  );
  assert.deepEqual(withMine.dropped, []);
  // Dropping prunes roadmap items naming it, re-sums the phase, and restates a top opportunity that named it.
  const big = opp({ id: 'big', title: 'Big but generic', worthAutomating: { ...GOOD_WORTH, needsTheirData: 0 }, annualSavings: 90000, hoursPerMonth: 90000 / (45 * 3 * 12 * 0.75) });
  const withRoad = verifyOpportunityMath(report([good('a', 30000), good('b', 20000), good('c', 10000), big], {
    implementationRoadmap: {
      phase1: phase([
        { title: 'Big but generic', description: 'x', weeks: 1, estimatedCost: 1, estimatedSavings: 90000, buildHours: 10 },
        { title: 'a', description: 'x', weeks: 1, estimatedCost: 1, estimatedSavings: 30000, buildHours: 5 },
      ], 1),
      phase2: phase([], 15000),
      phase3: phase([], 35000),
    },
  }), { buildRateUsd: RATE });
  withRoad.executiveSummary.topOpportunity = 'Big but generic saves $90K a year.';
  const pruned = dropUnworthyOpportunities(withRoad);
  assert.deepEqual(pruned.dropped, ['Big but generic']);
  assert.deepEqual(pruned.data.implementationRoadmap.phase1.items.map((i) => i.title), ['a']);
  assert.equal(pruned.data.implementationRoadmap.phase1.totalInvestment, 1000);
  assert.equal(pruned.data.implementationRoadmap.phase1.totalSavings, 30000);
  assert.ok(pruned.data.executiveSummary.topOpportunity.startsWith('a:'), pruned.data.executiveSummary.topOpportunity);
  assert.ok(!pruned.data.executiveSummary.headline.includes('$90K'));
});

check('cost = build hours x rate, roiMonths on conservative, quickWin rule', () => {
  const r = verifyOpportunityMath(report([opp({ buildHoursLow: 20, buildHoursHigh: 8, roiMonths: 99 })]), { buildRateUsd: RATE });
  const o = r.opportunities[0];
  assert.equal(o.buildHoursLow, 8); // swapped into order
  assert.equal(o.buildHoursHigh, 20);
  assert.equal(o.implementationCostLow, 1600);
  assert.equal(o.implementationCostHigh, 4000);
  // 4000 / (19440 / 12) = 2.47 -> 3
  assert.equal(o.roiMonths, 3);
  assert.equal(o.quickWin, true);
  assert.equal(r.executiveSummary.quickWinSavings, 38880);
  const tooBig = verifyOpportunityMath(report([opp({ buildHoursLow: 20, buildHoursHigh: 26 })]), { buildRateUsd: RATE });
  assert.equal(tooBig.opportunities[0].implementationCostHigh, 5200);
  assert.equal(tooBig.opportunities[0].quickWin, false);
  assert.equal(tooBig.executiveSummary.quickWinSavings, 0);
  const slow = verifyOpportunityMath(report([opp({ buildHoursLow: 2, buildHoursHigh: 4, implementationWeeks: 5 })]), { buildRateUsd: RATE });
  assert.equal(slow.opportunities[0].quickWin, false);
  const complex = verifyOpportunityMath(report([opp({ buildHoursLow: 2, buildHoursHigh: 4, complexity: 'medium', quickWin: true })]), { buildRateUsd: RATE });
  assert.equal(complex.opportunities[0].quickWin, false);
  const noWeeks = verifyOpportunityMath(
    report([opp({ buildHoursLow: 2, buildHoursHigh: 4, implementationWeeks: undefined as unknown as number })]),
    { buildRateUsd: RATE },
  );
  assert.equal(noWeeks.opportunities[0].quickWin, false); // missing weeks is not a quick win
  const tiny = verifyOpportunityMath(report([opp({ buildHoursLow: 1, buildHoursHigh: 1 })]), { buildRateUsd: RATE });
  assert.equal(tiny.opportunities[0].roiMonths, 1); // floor of 1 month
});

check('roadmap: item cost = buildHours x rate, phase total = sum; empty phases keep model total', () => {
  const r = verifyOpportunityMath(
    report([opp()], {
      implementationRoadmap: {
        phase1: phase([
          { title: 'a', description: 'a', weeks: 1, estimatedCost: 1, estimatedSavings: 1, buildHours: 10 },
          { title: 'b', description: 'b', weeks: 1, estimatedCost: 1, estimatedSavings: 1, buildHours: 15 },
        ], 99999),
        phase2: phase([], 15000),
        phase3: phase([{ title: 'c', description: 'c', weeks: 1, estimatedCost: 7000, estimatedSavings: 1 }], 7000),
      },
    }),
    { buildRateUsd: RATE },
  );
  const rm = r.implementationRoadmap;
  assert.deepEqual(rm.phase1.items.map((i) => i.estimatedCost), [2000, 3000]);
  assert.equal(rm.phase1.totalInvestment, 5000);
  assert.equal(rm.phase2.totalInvestment, 15000);
  assert.equal(rm.phase3.totalInvestment, 7000); // no buildHours -> stored numbers kept
});

check('old-shape report passes through without throwing and keeps its numbers', () => {
  // Shape stored before 2026-10-18, including the now-deprecated fields.
  const old = {
    ...report([
      opp({ implementationCostLow: 1500, implementationCostHigh: 4000, roiMonths: 1 }),
      opp({ id: 'opp-002', title: 'Two', hoursPerMonth: 10, fteCountAffected: 2, annualSavings: 8100, complexity: 'medium', quickWin: false, implementationCostLow: 6000, implementationCostHigh: 9000, roiMonths: 7 }),
    ], {
      implementationRoadmap: {
        phase1: phase([{ title: 'a', description: 'a', weeks: 2, estimatedCost: 2000, estimatedSavings: 18000 }], 5000),
        phase2: phase([], 15000),
        phase3: phase([], 35000),
      },
    }),
    companySnapshot: { inferredModel: 'x', inferredSize: 'x', keyStrengths: [], keyGaps: [], techStackDetected: [], dataMaturityAssessment: 'x' },
    dashboardRecommendations: [],
    competitiveInsights: [],
    nextSteps: { immediate: ['a'], shortTerm: ['b'], callToAction: 'c' },
  } as AuditReportData;
  const before = JSON.parse(JSON.stringify(old));
  const r = verifyOpportunityMath(old, { buildRateUsd: RATE });
  assert.deepEqual(old, before, 'input must not be mutated');
  const o1 = r.opportunities[0];
  const o2 = r.opportunities[1];
  assert.equal(o1.annualSavings, 38880);
  assert.equal(o1.implementationCostLow, 1500);
  assert.equal(o1.implementationCostHigh, 4000);
  assert.equal(o1.roiMonths, 1);
  assert.equal(o2.annualSavings, 8100);
  assert.equal(o2.implementationCostHigh, 9000);
  assert.equal(o2.roiMonths, 7);
  assert.equal(r.executiveSummary.totalAnnualSavings, 46980);
  assert.equal(r.executiveSummary.quickWinSavings, 38880);
  assert.equal(r.implementationRoadmap.phase1.totalInvestment, 5000);
  assert.equal(r.implementationRoadmap.phase1.items[0].estimatedCost, 2000);
  assert.equal(r.implementationRoadmap.phase3.totalInvestment, 35000);
  // A report with no opportunities array is returned as-is.
  const empty = { ...old, opportunities: undefined } as unknown as AuditReportData;
  assert.equal(verifyOpportunityMath(empty, { buildRateUsd: RATE }), empty);
});

console.log(`PASS check-opportunity-math: ${checks} checks`);
