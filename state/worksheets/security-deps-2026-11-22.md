# Security dependency update (2026-11-22)

## Goal
Clear the known security advisories in ai-audit (audit.wexadvisory.com) without changing behavior. Trigger: Next.js dev server printed a vulnerability notice during the intake junk guard work (11-21). Max: "NEXTJS SECURITY GO".

## Before
`npm audit --omit=dev`: 9 advisories (7 high, 2 moderate).
- next 16.4.3: 7 moderate (use-cache disclosure/poisoning, SVG image-optimizer bypass, HttpOnly cookie exposure on Edge routes, response injection when self-hosted). Fixed in 16.4.6.
- High: axios (via @mendable/firecrawl-js and @tavily/core), zod <4.6.6, form-data, follow-redirects, source-map-js. Moderate: baseline-browser-mapping. All fixable without a major version bump.

## What changed (branch chore/security-deps-2026-11-22)
- dde8444: next 16.4.3 -> 16.4.6 (kept exact pin), eslint-config-next ^16.4.6.
- 11e4802: `npm audit fix` (no --force). Lockfile only. Notable: @mendable/firecrawl-js 4.54.0, axios 1.20.0, zod 4.6.7.
- After: `npm audit --omit=dev` = 0 vulnerabilities.

## Verification
- `tsc --noEmit` clean; `next build` clean on both commits.
- scripts: check-intake 18/18, check-opportunity-math 20/20, check-proposal-terms 12/12.
- Full local pipeline on the built app (next start, trigger pointed at localhost so the new deps ran the process step): audit af2c4b8e (Piece of Cake, utm deploy-check-deps, email maxwexley@wexadvisory.com) reached status complete with savings, scores and proposal. Email step skipped locally only because BREVO_API_KEY is not in .env.local.
- Firecrawl: lib/research/firecrawl.ts swallows errors and returns '' (a shape change would silently empty reports). Direct scrapeUrl on the upgraded client returned success, 66,315 markdown chars at result.markdown, so the wrapper still reads content. New deprecation warning (v1 methods mapped to v2) is harmless for now.
- Production: see Outcome below.

## Open risks
- Firecrawl v1-style methods are deprecated in 4.54; a future major may remove them. Migrate lib/research/firecrawl.ts to scrape() when it next gets touched.
- lib/research/firecrawl.ts catch-all returning '' violates fail-loudly; a broken scrape would not show up anywhere. Not changed here (behavior change, out of scope).

## Outcome
LIVE 2026-11-22. master 3d1edec (merge), Vercel production deploy ai-audit-25bmljenu Ready.
- audit.wexadvisory.com / and /audit: 200.
- 11-18 junk payload: 400 companyUrl (intake guard still works).
- Real audit 4d49268a (Piece of Cake, utm deploy-check-deps, maxwexley@wexadvisory.com): complete, headline "$51K-$101K/year". Both emails landed in maxwexley@wexadvisory.com: "Your AI Opportunity Snapshot for Piece of Cake Moving is ready" (with PDF) and "New Lead: ... (via deploy-check-deps)".
- Cost of verification: 2 full audits (~$2 Anthropic) + Firecrawl/Tavily credits.
