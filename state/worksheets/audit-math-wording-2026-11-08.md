# Audit savings math + wording fix (2026-11-08)

Branch `fix/audit-math-wording`. Tag `work/audit-math-wording` on the final commit.

## Goal
1. Stop savings being counted once per person.
2. Stop the report stating guesses about a company's internal systems as facts, and stop recommending starter-tier tools to 200+ employee companies.

Found on the Piece of Cake Moving audit (834467df, 2026-11-08): $186K-$372K headline, ~$58K-$116K once corrected; page 1 said "no CRM", page 4 said "dispatch schedules in Excel", scorecard said "Low AI readiness". None of that is visible from public data.

## Root cause
- `opportunity-math.ts` computed `hoursPerMonth x rate x fteCountAffected x 12`. The model writes `hoursPerMonth` as the whole team's hours: on all 5 stored opportunities with worth facts, minutesPerRun x runsPerMonth / 60 equals hoursPerMonth exactly, never hoursPerMonth x FTEs. The prompt's own example contradicted itself (32 h, 3 FTEs, 480 runs x 12 min = 96 h).
- Wording: the prompt's confidenceStatement example demonstrated the bug ("We found no billing automation in place"); rule 9 ("a company with no CRM cannot score above 45") steered the narrative toward "no CRM" while changing no score (score-engine overrides model scores); score-engine verdicts asserted internal facts.

## Changes
- `lib/ai/opportunity-math.ts`: FTEs no longer multiply; consistency note compares runs x minutes to hoursPerMonth.
- `lib/ai/synthesize.ts`: rule 2 defines hoursPerMonth as team total; rule 3 sizes tools to EMPLOYEE RANGE; rule 8 names a company only when research shows it; rule 9 replaced (subtract-then-add) with "public data cannot show internal systems, write workflowDescription as typical practice"; example hoursPerMonth 32 -> 96 (totals unchanged), confidenceStatement example now cites observed facts; gate text formula fixed.
- `lib/pdf/snapshot-pdf.tsx`: labor cost without FTEs, formula shows "(shared by N people)", column label "HOW THIS USUALLY RUNS", methodology says public data cannot show internal systems.
- `lib/scoring/score-engine.ts`: low/partial verdicts reworded to "visible publicly" wording.
- `scripts/check-opportunity-math.ts`: fixtures moved to team-total hours; new check built from the real Piece of Cake opportunity (120 h, 4 people -> $40,320, not $161,280).
- `scripts/replay-audit.mts` (new): replays synthesis on a stored audit, no DB writes, no email.

## Verification
- `node --experimental-strip-types scripts/check-opportunity-math.ts`: PASS 15 checks.
- `npx tsc --noEmit`: exit 0.
- Live replay on 834467df: see "Replay result" below.

## Replay result
Three live replays of 834467df (`npx tsx scripts/replay-audit.mts <id> <outDir>`, ~70 s and ~$1 each, no DB writes):
- Run 1 (math + first wording pass): gate passed, 0 notes, Haiku 0.8, $124K-$247K. Math consistent on all 5 (runs x minutes = hours). Still wrong: cover concluded "done by hand"; urgency named Bellhop with a claim and a "64% of moves" stat not in the research; "1 tools detected (sap)" and an SAP-based opportunity.
- Root-caused SAP: tech-detector substring match on "asap" in the site copy. Whole-word regex now; across 28 stored audits only this one had a false hit.
- Tightened rule 8 (no company names, no stats not in the research) and rule 12 (state what was seen, never conclude how they work internally).
- Run 3: gate passed, 0 notes, Haiku 0.8, $106K-$213K. Cover cites only observed facts; urgency names no company and no stat; SAP gone; every workflow reads "Teams this size usually..."; HubSpot sized to Sales Hub Pro; math consistent on all 5.
- Totals vary run to run ($213K-$247K best case) from the model's hour estimates; all labeled benchmark estimates.

## Fresh-context review
- First reviewer stalled (no output in 600 s); a narrower one ran.
- Confirmed: example math (96 h = 480 x 12 min; 51,840; 38,880), regex escaping, old reports do not crash (missing fteCountAffected -> no "(shared by N people)").
- Acted on: two leftover prompt strings contradicting rule 9 (headline example "manual workflows"; gate retry feedback "describe the actual step-by-step manual process"); multi-word tool names now match across hyphens/newlines/extra spaces.
- Not needed: old-report formula mismatch on re-render. The PDF is only built once, at email send (lib/email/brevo.ts:90).

## What the harness caught (checklist item 8)
- Gate note "inconsistent numbers ... hoursPerMonth x fteCountAffected" on the original audit was the first visible symptom of the FTE double count; it was a log-only note, so it never blocked the report.

## Remaining / risks
- Audits already sent kept the inflated numbers; not re-sent.
- Not deployed until Max approves (Vercel auto-deploys master).

## Follow-up 2026-11-09: roadmap savings + arrow glyph (branch fix/roadmap-savings-arrow)
- Root cause: roadmap item savings were model-written; withPhaseTotals fell back to the model's phase total when items had none. Live audit 1709cf1c: Scale phase $487,000 under a $194K report total; prompt example showed empty phases with $120K/$220K savings.
- Fix: roadmap items carry opportunityId (prompt rule 15, example updated, model savings fields removed from example). Code copies savings from the matched opportunity (id, else title), each opportunity once, supporting work 0; phases can never exceed the total. PDF shows "Supporting work" for a 0 phase. Dropping an opportunity prunes its roadmap item by id. Log-only note when no item maps to an opportunity.
- Arrow: built-in Helvetica has no "→", printed as a stray quote. pdfSafeGlyphs swaps arrows and <=/>= for ASCII in every model string.
- Verified: 19 checks (3 new, fixtures from the live audit), tsc + lint clean.
- NOT verified live: replay blocked, Anthropic credit balance too low (400 "credit balance is too low", 2026-11-09). Next: top up, replay 1709cf1c, deploy, one live audit.
