# Firecrawl fails loudly (2026-11-22)

## Goal
lib/research/firecrawl.ts caught every error and returned '', so a broken Firecrawl (bad key, out of credits, outage) or a site that blocks it would produce audits with no website content and no trace anywhere. Make those failures visible without blocking the audit (the lead still gets a report). Also move off the deprecated v1 `scrapeUrl` method. Max: "FIRECRAWL LOUD GO".

## What changed (branch fix/firecrawl-loud)
- `lib/research/firecrawl.ts`: v2 client (`Firecrawl` default export, `scrape(url, { formats: ['markdown'] })`). `scrapeMultiplePages` returns `{ pages, failures }`.
  - Subpage 404/410 = page does not exist, skipped quietly.
  - Thrown errors, any other HTTP status >= 400 (403/429/5xx = blocked or erroring site), and an empty home page = failures. Each is logged with `console.error('[firecrawl] scrape failed ...')`.
  - `websiteReadWarning()` gives one line when the home page or every page failed (one subpage timing out is noise). Error text is flattened and capped at 200 chars.
- `lib/pipeline/audit-pipeline.ts`: stores `eval_quality.scrape_failures` (jsonb, no migration) and returns `websiteWarning`.
- `lib/email/brevo.ts` + `app/api/audit/process/route.ts`: the New Lead email gets a red line in the body (escaped) and `[WEBSITE NOT READ]` at the end of the subject.
- Side effect, intended: before this, Firecrawl's "page not found" text for missing subpages (/about, /services, /team, /careers, /pricing on Piece of Cake's site) went into the model prompt as if it were that page. Those are now skipped.
- New checks: `scripts/check-firecrawl.ts` (fake client + bad key; `--live` adds one real scrape, 7 credits), `scripts/check-lead-email.mts` (fetch stubbed, nothing sent; run with `npx tsx`).

## Review
Fresh reviewer found: blocked sites (403/429/503) were still silent because every status >= 400 was treated as "missing"; an empty home page (JS-only site) gave no warning; long error text uncapped. All three fixed, each with a check.

## Verification
- check-firecrawl 11/11 (incl. live: mypieceofcakemove.com reads / and /contact, no failures), check-lead-email 2/2, check-intake 18/18, opportunity-math 20/20, proposal-terms 12/12. tsc + eslint clean; next build clean.
- Local end to end with FIRECRAWL_API_KEY deliberately invalid (audit cf545f97, email maxwexley@wexadvisory.com): audit completed, 7 `[firecrawl] scrape failed ... Unauthorized: Invalid token` log lines, row has web_content {} and eval_quality.scrape_failures with 7 entries. Emails not sent locally (no BREVO_API_KEY in .env.local); the email content is covered by check-lead-email.
- Production: see Outcome.

## Open risks
- Soft 404s (200 status with a "not found" body, or /pricing redirecting to home) still pass as content. Unchanged from before.
- A site that 403s only some subpages logs errors for them but raises no warning (home page read fine).

## Outcome
(filled after production deploy)
