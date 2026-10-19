// Every number in an audit report that can be computed is computed here, not
// by the model. The model supplies the inputs (hours, rate, automatable share,
// build hours, worth-automating facts); this module derives savings, ranges,
// costs, payback, quick-win flags, roadmap totals and the headline figure.
//
// Pure functions with type-only imports, so the check script can load this
// file directly: node --experimental-strip-types scripts/check-opportunity-math.ts

import type {
  AuditReportData,
  ImplementationPhase,
  InputSources,
  OpportunityItem,
  ProposalContent,
  WorthAutomating,
} from '../../types/audit';

/** Conservative case assumes half the estimated automatable share. */
export const CONSERVATIVE_SHARE = 0.5;
/** Weeks per month used to turn their hours a week into hours a month. */
export const WEEKS_PER_MONTH = 4.33;
export const QUICK_WIN_MAX_WEEKS = 4;
export const QUICK_WIN_MAX_COST_USD = 5000;
export const WORTH_AUTOMATING_MIN_SCORE = 6;
/** Stated hours vs hours implied by minutesPerRun x runsPerMonth: flag beyond this factor. */
export const HOURS_CONSISTENCY_FACTOR = 3;

export interface OpportunityMathOptions {
  /** BUILD_RATE_USD from lib/proposal/terms.ts. Passed in so this file has no runtime imports. */
  buildRateUsd: number;
  /** SnapshotIntake.hoursPerWeek, already validated (0 < h <= 168) or undefined. */
  intakeHoursPerWeek?: number;
}

const BENCHMARK = 'industry benchmark estimate' as const;

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function validHours(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 168;
}

function clamp02(v: unknown): number {
  return Math.min(2, Math.max(0, num(v)));
}

export function fmtShort(n: number): string {
  const v = num(n);
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${Math.round(v / 1000)}K`;
  return `$${Math.round(v).toLocaleString('en-US')}`;
}

/** "$143K-$287K" when the conservative figure exists, else the old single figure. */
export function fmtRange(best: number, conservative?: number): string {
  if (typeof conservative !== 'number' || !Number.isFinite(conservative)) return fmtShort(best);
  const lo = fmtShort(conservative);
  const hi = fmtShort(best);
  return lo === hi ? hi : `${lo}-${hi}`;
}

// ── Worth-automating score ────────────────────────────────────────────────────

export function computeWorthAutomatingScore(w: WorthAutomating): number {
  const minutes = num(w.minutesPerRun);
  const runs = num(w.runsPerMonth);
  const timePoints = minutes >= 5 ? 2 : minutes >= 0.5 ? 1 : 0;
  const repeatPoints = runs >= 20 ? 2 : runs >= 5 ? 1 : 0;
  return timePoints + repeatPoints + clamp02(w.skillGap) + clamp02(w.mistakeCost) + clamp02(w.needsTheirData);
}

/** True when the opportunity has worth-automating facts and they fail the bar. */
export function failsWorthAutomating(opp: OpportunityItem): boolean {
  if (!opp.worthAutomating) return false;
  const score = opp.worthAutomatingScore ?? computeWorthAutomatingScore(opp.worthAutomating);
  return score < WORTH_AUTOMATING_MIN_SCORE || num(opp.worthAutomating.needsTheirData) < 1;
}

// ── Per-opportunity math ──────────────────────────────────────────────────────

function verifyOne(opp: OpportunityItem, opts: OpportunityMathOptions, applyIntakeHours: boolean): OpportunityItem {
  let out: OpportunityItem = { ...opp };

  // Their own hours replace the model's guess on the one matching opportunity.
  // Their number is the whole task, so it counts once (one person).
  if (applyIntakeHours && validHours(opts.intakeHoursPerWeek)) {
    out.fteCountAffected = 1;
    out.hoursPerMonth = Math.round(opts.intakeHoursPerWeek * WEEKS_PER_MONTH);
    // Keep the model's minutes per run, and derive runs from their hours so the
    // "runs about N a month" line and the repeat score agree with their number.
    const minutes = num(out.worthAutomating?.minutesPerRun);
    if (out.worthAutomating && minutes > 0) {
      out.worthAutomating = {
        ...out.worthAutomating,
        runsPerMonth: Math.max(1, Math.round((out.hoursPerMonth * 60) / minutes)),
      };
    }
  }

  const hours = num(out.hoursPerMonth);
  const rate = num(out.fullyLoadedHourlyRate);
  const ftes = num(out.fteCountAffected) || 1;
  const ceiling = num(out.automationCeilingPct);

  // Best case. Same rule as before 2026-10-18: keep the model's figure when it
  // is within 20% of the math, otherwise (or when their hours were applied)
  // override with the math.
  const annualLaborCost = hours * rate * ftes * 12;
  const computedSavings = Math.round(annualLaborCost * (ceiling / 100));
  const claimedSavings = num(out.annualSavings);
  const deviation = claimedSavings > 0 ? Math.abs(claimedSavings - computedSavings) / claimedSavings : 1;
  if (applyIntakeHours || deviation > 0.2 || claimedSavings === 0) {
    if (!applyIntakeHours) {
      console.log(`[verify] ${out.id}: claimed $${claimedSavings} -> corrected to $${computedSavings}`);
    }
    out = { ...out, annualLaborCost: Math.round(annualLaborCost), annualSavings: computedSavings };
  }

  out.annualSavingsConservative = Math.round(num(out.annualSavings) * CONSERVATIVE_SHARE);

  const inputSources: InputSources = {
    hours: applyIntakeHours ? 'from you' : BENCHMARK,
    rate: BENCHMARK,
    automationShare: BENCHMARK,
  };
  out.inputSources = inputSources;
  out.usesIntakeHours = applyIntakeHours;

  if (out.worthAutomating) {
    out.worthAutomatingScore = computeWorthAutomatingScore(out.worthAutomating);
  }

  // Cost and payback from build hours. Reports without build hours (stored
  // before 2026-10-18) keep their stored cost and payback.
  const lowH = Number(out.buildHoursLow);
  const highH = Number(out.buildHoursHigh);
  if (Number.isFinite(lowH) && Number.isFinite(highH) && lowH > 0 && highH > 0) {
    const [lo, hi] = lowH <= highH ? [lowH, highH] : [highH, lowH];
    out.buildHoursLow = lo;
    out.buildHoursHigh = hi;
    out.implementationCostLow = Math.round(lo * opts.buildRateUsd);
    out.implementationCostHigh = Math.round(hi * opts.buildRateUsd);
    const monthlyConservative = out.annualSavingsConservative / 12;
    if (monthlyConservative > 0) {
      out.roiMonths = Math.max(1, Math.ceil(out.implementationCostHigh / monthlyConservative));
    }
  }

  out.quickWin =
    out.complexity === 'low' &&
    Number.isFinite(Number(out.implementationWeeks)) &&
    num(out.implementationWeeks) <= QUICK_WIN_MAX_WEEKS &&
    Number.isFinite(Number(out.implementationCostHigh)) &&
    num(out.implementationCostHigh) <= QUICK_WIN_MAX_COST_USD;

  return out;
}

function verifyPhase(phase: ImplementationPhase | undefined, rate: number): ImplementationPhase | undefined {
  if (!phase || !Array.isArray(phase.items) || phase.items.length === 0) return phase;
  const hasHours = (h: unknown) => typeof h === 'number' && Number.isFinite(h) && h >= 0;
  if (!phase.items.some((it) => hasHours(it.buildHours))) return phase;
  const items = phase.items.map((it) =>
    hasHours(it.buildHours) ? { ...it, estimatedCost: Math.round((it.buildHours as number) * rate) } : it,
  );
  return withPhaseTotals({ ...phase, items });
}

/** Phase totals as sums of their items, so the roadmap never disagrees with itself. */
function withPhaseTotals(phase: ImplementationPhase): ImplementationPhase {
  const totalInvestment = phase.items.reduce((sum, it) => sum + num(it.estimatedCost), 0);
  const allSavings = phase.items.every((it) => Number.isFinite(Number(it.estimatedSavings)));
  const totalSavings = allSavings
    ? phase.items.reduce((sum, it) => sum + num(it.estimatedSavings), 0)
    : phase.totalSavings;
  return { ...phase, totalInvestment, totalSavings };
}

// ── Totals + headline ─────────────────────────────────────────────────────────

const MONEY = /\$[\d,]+(?:\.\d+)?[KkMm]?(?:\s*(?:-|–|—|to)\s*\$[\d,]+(?:\.\d+)?[KkMm]?)?/;

/** Replace the first dollar figure (or dollar range) in model text with a code-computed one. */
export function replaceMoney(text: string, replacement: string): string {
  return text.replace(MONEY, replacement);
}

/** Re-sorts opportunities, recomputes totals and rewrites the headline's first $ figure (or range). */
export function finalizeTotals(data: AuditReportData, opportunities: OpportunityItem[]): AuditReportData {
  const opps = [...opportunities].sort((a, b) => (b.annualSavings ?? 0) - (a.annualSavings ?? 0));
  const totalAnnualSavings = opps.reduce((sum, o) => sum + num(o.annualSavings), 0);
  const hasConservative = opps.length > 0 && opps.every((o) => typeof o.annualSavingsConservative === 'number');
  const totalAnnualSavingsConservative = hasConservative
    ? opps.reduce((sum, o) => sum + num(o.annualSavingsConservative), 0)
    : undefined;
  const quickWinSavings = opps.filter((o) => o.quickWin).reduce((sum, o) => sum + num(o.annualSavings), 0);

  const summary = data.executiveSummary ?? ({} as AuditReportData['executiveSummary']);
  const headline = replaceMoney(summary.headline || '', fmtRange(totalAnnualSavings, totalAnnualSavingsConservative));
  // Written here, not by the model: the model's sentence carried its own
  // pre-correction figure and could name an opportunity that is no longer first.
  const top = opps[0];
  const topOpportunity = top
    ? `${top.title}: about ${fmtRange(num(top.annualSavings), top.annualSavingsConservative)} a year.`
    : summary.topOpportunity;

  return {
    ...data,
    opportunities: opps,
    executiveSummary: {
      ...summary,
      headline,
      topOpportunity,
      totalAnnualSavings,
      ...(totalAnnualSavingsConservative !== undefined ? { totalAnnualSavingsConservative } : {}),
      quickWinSavings,
    },
  };
}

/**
 * Recompute every derived number from the model's inputs. Safe on old-shape
 * reports (no build hours, no worth-automating facts): their costs, payback
 * and roadmap totals are kept as stored.
 */
export function verifyOpportunityMath(data: AuditReportData, opts: OpportunityMathOptions): AuditReportData {
  if (!Array.isArray(data.opportunities)) return data;

  // Exactly one opportunity takes their stated hours: the first one flagged.
  const intakeIdx = validHours(opts.intakeHoursPerWeek)
    ? data.opportunities.findIndex((o) => o.usesIntakeHours === true)
    : -1;

  const verified = data.opportunities.map((opp, i) => verifyOne(opp, opts, i === intakeIdx));

  const roadmap = data.implementationRoadmap;
  const withRoadmap: AuditReportData = roadmap
    ? {
        ...data,
        implementationRoadmap: {
          ...roadmap,
          phase1: verifyPhase(roadmap.phase1, opts.buildRateUsd) as ImplementationPhase,
          phase2: verifyPhase(roadmap.phase2, opts.buildRateUsd) as ImplementationPhase,
          phase3: verifyPhase(roadmap.phase3, opts.buildRateUsd) as ImplementationPhase,
        },
      }
    : data;

  return finalizeTotals(withRoadmap, verified);
}

/**
 * Drop opportunities that fail the worth-automating bar, but only when at
 * least 3 remain. Otherwise the report keeps them (the gate issue is still
 * recorded by the caller).
 */
export function dropUnworthyOpportunities(data: AuditReportData): { data: AuditReportData; dropped: string[] } {
  const opps = data.opportunities ?? [];
  // The opportunity carrying their own hours is never dropped: it is the one
  // they told us about.
  const droppable = (o: OpportunityItem) => failsWorthAutomating(o) && o.usesIntakeHours !== true;
  const keep = opps.filter((o) => !droppable(o));
  if (keep.length === opps.length || keep.length < 3) return { data, dropped: [] };
  const dropped = opps.filter(droppable).map((o) => o.title);

  // Roadmap items are matched to opportunities by title only; remove the ones
  // naming a dropped opportunity and re-sum their phase.
  const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase();
  const droppedTitles = dropped.map(norm).filter(Boolean);
  // Exact match, or a substring match only when the shorter title is specific
  // enough (8+ chars and at least half the longer one), so a generic title like
  // "CRM" never removes unrelated items.
  const sameItem = (a: string, b: string) => {
    if (a === '' || b === '') return false;
    if (a === b) return true;
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    return short.length >= 8 && short.length * 2 >= long.length && long.includes(short);
  };
  const mentionsDropped = (title: string | undefined) => droppedTitles.some((d) => sameItem(norm(title), d));
  const prunePhase = (phase: ImplementationPhase | undefined) => {
    if (!phase || !Array.isArray(phase.items)) return phase;
    const items = phase.items.filter((it) => !mentionsDropped(it.title));
    return items.length === phase.items.length ? phase : withPhaseTotals({ ...phase, items });
  };
  const roadmap = data.implementationRoadmap;
  const pruned: AuditReportData = roadmap
    ? {
        ...data,
        implementationRoadmap: {
          ...roadmap,
          phase1: prunePhase(roadmap.phase1) as ImplementationPhase,
          phase2: prunePhase(roadmap.phase2) as ImplementationPhase,
          phase3: prunePhase(roadmap.phase3) as ImplementationPhase,
        },
      }
    : data;

  // finalizeTotals also restates topOpportunity from the new first opportunity.
  return { data: finalizeTotals(pruned, keep), dropped };
}

// ── Quality issues computed from the numbers ──────────────────────────────────

/** Gate issues about the computed fields. checkAuditQuality appends these. */
export function opportunityMathIssues(data: AuditReportData, intakeHoursPerWeek?: number): string[] {
  const issues: string[] = [];
  const opps = data.opportunities ?? [];

  const missingWorth = opps.filter((o) => !o.worthAutomating);
  if (missingWorth.length > 0) {
    issues.push(`${missingWorth.length} opportunit${missingWorth.length > 1 ? 'ies are' : 'y is'} missing worthAutomating, fill it for every opportunity`);
  }

  const unworthy = opps.filter(failsWorthAutomating);
  if (unworthy.length > 0) {
    issues.push(
      `not worth automating (score under ${WORTH_AUTOMATING_MIN_SCORE} of 10, or needsTheirData under 1): ${unworthy.map((o) => `"${o.title}"`).join(', ')}. Replace with workflows a person spends real time on repeatedly that need the company's own data or systems`,
    );
  }

  if (validHours(intakeHoursPerWeek)) {
    const flagged = opps.filter((o) => o.usesIntakeHours === true);
    if (flagged.length === 0) {
      issues.push(
        `their stated ${intakeHoursPerWeek} hours/week must be used on the opportunity matching their answer: set usesIntakeHours true on exactly that one`,
      );
    } else if (flagged.length > 1) {
      issues.push(`usesIntakeHours is true on ${flagged.length} opportunities, it must be true on exactly one`);
    }
  }

  return issues;
}

/**
 * Log-only notes about the numbers: stored with the gate result and shown in
 * the admin email, but they do not trigger a paid retry. Models often miss
 * minutes x runs arithmetic, and code already falls back when build hours are
 * missing, so a retry would cost more than it fixes.
 */
export function opportunityMathNotes(data: AuditReportData): string[] {
  const issues: string[] = [];
  const opps = data.opportunities ?? [];

  const inconsistent = opps.filter((o) => {
    // Their own hours replaced the model's on this one, and runs were derived from them.
    if (!o.worthAutomating || o.usesIntakeHours === true) return false;
    const implied = (num(o.worthAutomating.minutesPerRun) * num(o.worthAutomating.runsPerMonth)) / 60;
    const stated = num(o.hoursPerMonth) * (num(o.fteCountAffected) || 1);
    if (implied <= 0 && stated <= 0) return false;
    if (implied <= 0 || stated <= 0) return true;
    const ratio = implied > stated ? implied / stated : stated / implied;
    return ratio > HOURS_CONSISTENCY_FACTOR;
  });
  if (inconsistent.length > 0) {
    issues.push(
      `inconsistent numbers: minutesPerRun x runsPerMonth / 60 is more than ${HOURS_CONSISTENCY_FACTOR}x off from hoursPerMonth x fteCountAffected for ${inconsistent.map((o) => `"${o.title}"`).join(', ')}`,
    );
  }

  const missingBuild = opps.filter(
    (o) => !(Number(o.buildHoursLow) > 0 && Number(o.buildHoursHigh) > 0),
  );
  if (missingBuild.length > 0) {
    issues.push(`${missingBuild.length} opportunit${missingBuild.length > 1 ? 'ies are' : 'y is'} missing buildHoursLow/buildHoursHigh`);
  }

  return issues.map((i) => `note: ${i}`);
}

// ── Proposal figures ──────────────────────────────────────────────────────────

/**
 * Copies savings and build hours from the audit onto the proposal, so the
 * proposal never carries a model-written number. Each proposal opportunity is
 * matched to its audit opportunity by title, falling back to the same position
 * in the top 3. Whole-audit totals go on the content for the PDF cover.
 */
export function attachAuditFigures(content: ProposalContent, reportData: AuditReportData): void {
  const summary = reportData.executiveSummary;
  if (summary) {
    content.totalSavingsBest = num(summary.totalAnnualSavings);
    if (typeof summary.totalAnnualSavingsConservative === 'number') {
      content.totalSavingsConservative = summary.totalAnnualSavingsConservative;
    }
  }
  if (Array.isArray(reportData.opportunities)) content.totalOpportunities = reportData.opportunities.length;
  if (!Array.isArray(content.opportunities)) return;
  const top3 = (reportData.opportunities ?? []).slice(0, 3);
  const norm = (t: string) => (t ?? '').trim().toLowerCase();
  content.opportunities = content.opportunities.map((frame, i) => {
    const source = top3.find((o) => norm(o.title) === norm(frame.title)) ?? top3[i];
    if (!source) return frame;
    const out = { ...frame, estimatedSavings: num(source.annualSavings) };
    if (typeof source.annualSavingsConservative === 'number') {
      out.estimatedSavingsConservative = source.annualSavingsConservative;
    }
    const low = Number(source.buildHoursLow);
    const high = Number(source.buildHoursHigh);
    if (low > 0 && high > 0) {
      out.buildHoursLow = low;
      out.buildHoursHigh = high;
    }
    return out;
  });
}

/** Unrounded dollar figures like "$115,057": the proposal should only quote ranges. */
export function exactDollarFigures(text: string): string[] {
  return (text ?? '').match(/\$\d{1,3}(?:,\d{3})+(?!\d)/g) ?? [];
}
