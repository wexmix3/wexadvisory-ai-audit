# Worksheet — snapshot-pdf.tsx whitespace/pagination defects (open)

**Date:** 2026-09-02 · **Repo:** ai-audit · **Status:** OPEN, not started

## RESUME KEYWORD: `PDF WHITESPACE RESUME`

## Goal

Follow-up from `state/worksheets/visual-qa-scoring-fix-2026-09-02.md`. Once the
visual-QA scoring pipeline was fixed (3 stacked bugs, all closed), it immediately
produced its first real result: score 42/100, verdict "fail", on a 7-page test PDF.

## Evidence — the actual visual-QA output that started this

```json
{
  "visual_qa_score": 42,
  "visual_qa_verdict": "fail",
  "visual_qa_issues": [
    "page 1: excessive blank space in upper half and large dead zone below content",
    "page 2: substantial whitespace at bottom of page after last content block",
    "page 3: uneven vertical spacing between sections with large gaps throughout; content appears too sparse for page",
    "page 6: significant dead space between card section and three-column grid at bottom",
    "page 7: page is almost entirely blank except for small element at bottom left - severe whitespace imbalance",
    "page 8: excessive whitespace in upper two-thirds of page; button element placed very low with no supporting content"
  ]
}
```
Source audit: `d1f09191-e549-474c-aa84-6358f2fc722a` (production, `audit.wexadvisory.com`).

## Head-start hypothesis, NOT yet verified or fixed

`lib/pdf/snapshot-pdf.tsx` line 27, the shared style for every non-cover page:
```ts
page: { backgroundColor: WHITE, fontFamily: 'Helvetica', paddingBottom: 44, justifyContent: 'center' },
```
`justifyContent: 'center'` vertically centers page content instead of top-anchoring
it. Any page shorter than a full A4 sheet — the CTA/next-steps page, a lone leftover
opportunity card, etc. — gets centered, producing large symmetric blank bands. This
matches every reported symptom (dead zones, "almost entirely blank" pages) and is a
one-line, cheaply testable culprit. **Not confirmed** — no render was inspected, no
property was changed and re-tested.

Secondary suspect if the above isn't the whole story: the explicit pagination logic
around lines 348-356 (`oppPages` chunking, `lastPageIsSingle`) — the code comment
there shows the author already partially solved for "a lone card on its own mostly-
blank page" by folding the roadmap onto that page when it happens, but evidently not
completely (see page 7's "almost entirely blank" finding).

## Suggested first steps for the resumed session

1. Change `justifyContent: 'center'` → `'flex-start'` (or drop the property; that's
   react-pdf's default) on `s.page`.
2. Regenerate the same test PDF (`scripts/render-test-pdf.mjs` exists in this repo —
   check what it currently does before assuming its output source data) and re-score
   it via `scripts/visual-qa-check.mjs` locally — no live audit trigger or cost needed
   for this iteration loop.
3. Compare before/after scores and issue lists. If score improves a lot but doesn't
   fully clear, look at the pagination logic next (see secondary suspect above).
4. Once confident locally, confirm with one live production audit trigger (~$1-2,
   same pattern as the closed visual-QA worksheet) before calling this done.

## Verification standard

Don't declare this fixed on a clean local render alone — per the OS's own
"verify by using it, not by testing it" standard, pull the actual `visual_qa_score`
from a live production run and confirm the specific issues listed above are gone,
not just that the score number went up.

## Cost note

Local render/score iteration is free (uses existing `.env.local` keys, no email
send). Final live confirmation ~$1-2, Max's own Anthropic/Firecrawl/Tavily keys,
target `maxwexley@wexadvisory.com` only — same scope as the closed bug's fix.
