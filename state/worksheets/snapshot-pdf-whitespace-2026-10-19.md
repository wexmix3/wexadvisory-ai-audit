# Snapshot PDF whitespace + visual-QA 62 anchor (2026-10-19)

Branch `fix/snapshot-pdf-whitespace` (worktree `ai-audit-vqa`). Not pushed, not merged, not deployed.

## Goal
Every production audit since 2026-09-03 stored `visual_qa_score = 62`, verdict fail, with the
same issues (dead space on pages 1, 2, 3, 6, 7). Fix the real layout defect and find out why the
score never moves.

## Root causes
1. **Grader never saw any text in production.** pdfjs (5.4) in Node draws the report's
   non-embedded Helvetica with canvas `fillText` under the family "Helvetica", sans-serif.
   Locally Windows supplies a system font; the Vercel function has none, so every production
   raster was boxes, bars and gold dots only. Reproduced locally by making `fillText` a no-op:
   2/2 runs scored exactly 62 with the production issue wording ("three gold dots"). The
   2026-09-02 worksheet logged "benign pdfjs font warnings" in prod logs; they were not benign.
2. **Layout: one `<Page>` per section.** Exec summary, scorecard, every pair of opportunity
   cards, and roadmap + CTA each forced a new page, so short sections left 34-59% of the page
   blank, and two tall cards that did not fit together each got a page of their own
   (PerformX: 10 pages, 7 of them ~45% blank).
3. Roadmap columns used `alignItems: 'flex-start'` (uneven card heights in the 3-column row).
4. Cover rules used `rgba()` border colours, which react-pdf draws bright green.

## Changes
- `lib/pdf/visual-qa.ts`: register pdfjs's own Liberation Sans (Helvetica-metric) files as
  "Helvetica" with `GlobalFonts` before rasterizing; throw if the files are missing (route logs
  it and the score stays null instead of a bogus number). Prompt unchanged.
- `next.config.ts`: trace the two TTFs into `/api/audit/process`.
- `lib/pdf/snapshot-pdf.tsx`: everything after the cover is one flowing `<Page>`; section heads
  are glued to their first unbreakable unit (`SectionHead`), units are `wrap={false}`; roadmap
  columns stretch to equal height; next steps + CTA are one closing block; cover spreads three
  groups with `space-between`; slightly tighter card spacing so two typical cards share a page;
  roadmap taller than a page falls back to a fresh, splittable page (unbreakable blocks taller
  than a page make react-pdf overlap the page).
- `lib/pdf/proposal-pdf.tsx`: same rgba cover rule -> solid hex.

## Verification
Rendered 4 stored audits before/after (`scripts/render-pages.mjs`), viewed every page.
Blank space below content, worst content page: Green Generation 49% -> 20%, PerformX 59% -> 17%
(10 -> 6 pages), Stripe 51% -> 23%, Smith and Sons 51% -> 24%.
Grader (Haiku, local, system fonts): before 92/82/78 (Green Gen x3), 82 PerformX, 82 Stripe,
85 Green Gen with the font fix; after 92 on all 7 runs. Prod emulation (no fonts): 62, 62.
Stress: 6 items/phase roadmap keeps together; 12 items/phase splits cleanly on a fresh page.

## Open
- Font fix is verified by emulation only. Confirm on the first production audit after deploy:
  `visual_qa_score` should no longer be 62 and issues should mention real text.
- Grader is coarse (clusters at 62/92); verdict and score disagree at 82 (one pass, one fail).
- A section head that starts a page shows its hairline rule at the top of that page.
