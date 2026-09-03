# Worksheet — snapshot-pdf.tsx whitespace/pagination defects

**Date:** 2026-09-02 · **Repo:** ai-audit · **Status:** FIXED locally, committed, NOT pushed (push = Vercel deploy, awaiting Max)
**Resumed via:** `PDF WHITESPACE RESUME` · **Predecessor:** `visual-qa-scoring-fix-2026-09-02.md`

## Goal

Once visual-QA scoring worked, its first real result on production audit
`d1f09191-e549-474c-aa84-6358f2fc722a` was 42/100, "fail", 6 whitespace defects. Find and fix the layout bugs.

## Root causes — two, not one

Reproduced locally (`scripts/render-pages.mjs` renders the audit's PDF and rasterizes every page) and
looked at every page before touching code. The head-start hypothesis was half the story:

1. **`justifyContent: 'center'` on the shared `s.page` style** — confirmed. Every non-cover page was
   vertically centered, so exec summary, scorecard and CTA pages showed a large blank band on top.
   Fix: dropped it; top margin moved from each section (`sec` padding-top 36) onto the Page itself
   (`paddingTop: 36`) so react-pdf applies it to auto-generated continuation pages too.
2. **Roadmap fold-in on the lone-card page** — the code folded the 3-phase roadmap onto the last
   opportunities page whenever it held a single card (the *common* case: synthesize.ts caps
   opportunities at exactly 5). Roadmap height depends on LLM output; when it didn't fit, react-pdf
   split the 3-column row mid-column and the Quick Wins column's totals row landed alone on an
   otherwise blank page (the "page 7 almost entirely blank" finding). Fix: roadmap + next steps always
   start a fresh page (the layout the even-count path already used); CTA block is `wrap={false}` so a
   tall roadmap pushes it whole to the next page, divider trails the roadmap so nothing starts with an
   orphan rule. Tried a smarter "fold in only if it fits" variant first (wrap={false} blocks on the
   last card page) — worked, but a trailing divider inside the block cost 33pt and un-fit it, and
   folding only shuffles the same tail whitespace between pages, so deterministic won.
3. Bonus: cover's top-3 list anchored to the bottom (`marginTop: 'auto'`) — removes the cover's dead
   zone at the bottom that the QA flagged in every run.

## Verification evidence (local, same production report data)

| Render | Pages | Visual-QA score | Verdict |
|---|---|---|---|
| Before (current prod) | 8 | 42 (prod run) / 72 (local re-score of identical render) | fail |
| After | 7 | 92, 85 (two runs) | pass |
| After, 4-opp variant (even path) | 6 | 92 | pass |
| After, 5-opp + 5 items/phase roadmap | 8 | not scored; viewed: roadmap page + CTA moves whole to p8, no split | — |

All page PNGs viewed by eye, not just scored. Before/after board shown to Max:
`scratchpad/pdf-before-after.html` (session-local).
`npx tsc --noEmit` clean, `eslint lib/pdf/snapshot-pdf.tsx` clean.

**Scorer variance note:** the identical "before" PDF scored 42 in production and 72 locally; the
identical "after" PDF scored 92 then 85. Haiku's visual grader has ±15-30pt noise. A single score
is not a signal — treat the verdict + specific issues as the signal, and re-score before acting on
a borderline number.

## Residuals (content-volume, not layout bugs)

- Exec summary page ends ~60% down; scorecard page similar. Content is what it is.
- Lone 5th-card page ends ~55% down. Option if Max wants it filled: fold the Next Steps/CTA block
  (short, fixed height) onto that page and give the roadmap its own final page — but that reorders
  the narrative (CTA before roadmap). Product call, not made here.

## Remaining scope

1. Max: push `master` (auto-deploys Vercel) — not done, deploy needs approval.
2. Then one live audit trigger (~$1-2, Max's keys, `maxwexley@wexadvisory.com` only) and pull
   `visual_qa_score`/`visual_qa_issues` from the `audits` row to confirm in production.
3. Stale June PNGs in `scripts/` (page-*.png, v2-page-*.png, roadmap-*.png) are dev litter — untouched.

## Live confirmation (2026-09-02 22:02-22:05 EDT)

Pushed `db958d9`, Vercel deploy Ready, triggered audit `b72c3c8b-6c5b-410e-b261-3fd6d9e50ac3`
(Wex Advisory PDF Layout Test, utm `pdf-whitespace-verify`, ~$1-2 on Max's keys).
Result: 7 pages, `visual_qa_score` 62, verdict fail, issues:

- page 1: excessive blank space below content section
- page 2 / page 3 / page 6: dead zone in lower half after last block
- page 7: "very large dead zone between three-column card section and footer bar"

Rendered the same audit locally and inspected every page: the two original defects are
gone in production (no centered blank bands, roadmap intact on one page with the CTA
below it, no near-empty page). The page-7 flag is the ordinary space under the CTA
box, not a defect. Pages 2/3/6 are content-volume: exec summary, scorecard and the
lone 5th card each fill ~55-60% of a page, and no pagination change fixes that.

The page-1 flag was made worse by my cover change (`marginTop: 'auto'` on the top-3
list moved the gap from the bottom to the middle of the cover). Reverted in the
follow-up commit; cover is back to the original top-anchored composition.

## Grader calibration note

Same PDF: 42 (prod) vs 72 (local). Fixed PDF: 92 and 85 on identical bytes. Live
run on different content: 62. Haiku's numeric score swings ~30 points on identical
input; the named issues are stable. Treat `visual_qa_verdict` as a "look at it"
signal, not a pass/fail gate, until the prompt is calibrated (e.g. ask for per-page
fill ratios, or grade against a rubric with explicit tolerances). Tracked as
skill-observations Obs 57 in aios.

## Remaining scope (not this bug)

- Content-volume whitespace on exec summary / scorecard / lone-card pages needs a
  design pass (denser packing, or CTA folded onto the lone-card page ahead of the
  roadmap - a content-order decision for Max).
- Grader calibration above.
