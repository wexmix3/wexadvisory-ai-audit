# Intake junk guard (2026-11-18 to 11-21)

## Goal
Stop junk submissions on the public /audit form before they cost money or email a PDF to a fake address. Never block a real small-business owner.

## Trigger
Audit 760f3bc7 (2026-11-18 05:25 UTC, utm_source chatgpt.com): company "czxc", url "https://czxc", contact "2", email "2@gm.com", challenge "zxc". The full pipeline ran (~$1), the text gate passed, and the report was emailed to 2@gm.com (gm.com is General Motors' real domain, so it may not even bounce). It was the first audit ever tagged chatgpt.com; every other audit since 10-15 was one of Max's own test runs.

## What changed
- `lib/intake/shape.ts` (pure, used by the form and the route): website must parse to a host with a dot and a real-looking ending (no IPs, no localhost; unicode domains are punycoded by URL); company name must have a letter or digit in any script; "never do again" answer at least 3 chars with a letter in any script and not keyboard mash (all-ASCII with no vowel, or one character repeated; all-caps acronyms like CRM pass); email domain goes through the same host check and is punycoded.
- `lib/intake/dns-check.ts` (server only): website must resolve (dns.lookup, then the www./bare alternative); email domain must exist: MX through a resolver pinned to 1.1.1.1 / 8.8.8.8, and if there is no MX, the domain's own address (RFC 5321 implicit MX). Rejects only on a definite not-found. Timeouts and other errors let the audit through with a console.warn.
- Fresh-context review (reviewer agent, 11-21) found 4 false-rejection risks (non-Latin names, 7-letter answers like "billing", no-MX domains, unicode email domains) plus the www reverse case. All fixed, each with a check.
- `app/api/audit/snapshot/route.ts`: runs both checks after normalizing; on a problem returns 400 `{ error, field }` before any DB insert or pipeline call.
- `app/audit/page.tsx`: same shape check client-side; a server rejection on website/company name jumps back to step 1. Industry label now linked to its select (accessibility; the smoke test relied on it).
- `e2e/smoke.spec.ts`: challenge placeholder selector updated (stale).
- `scripts/check-intake.ts`: 14 checks (shape, fake resolver, live DNS). Run: `node --experimental-strip-types scripts/check-intake.ts`.

## Why MX goes through public resolvers
On Max's machine the system resolver is 127.0.0.1 and refuses MX queries (ECONNREFUSED). With the system default, the email check would silently pass everything. dns.lookup (getaddrinfo) works fine, so the site check uses it.

## Verification
- check-intake: 18/18 pass (after review fixes). `tsc --noEmit` clean. eslint clean on changed files.
- Local route (next dev, port 3217): the exact 11-18 junk -> 400 companyUrl; fake .com site -> 400 companyUrl; dead mail domain -> 400 contactEmail; "zxc" challenge -> 400 biggestChallenge. No DB rows written (rejection happens before insert).
- Local browser (headless Playwright): "czxc" blocked on step 1; short challenge blocked on step 2; a fake but well-formed site passes the form, server bounces it, page returns to step 1 with "We couldn't find that website".
- Production: see the Outcome section in aios state/decisions/log.md (2026-11-21).

## Open risks
- If Vercel blocks outbound UDP 53 to public resolvers, the email check fails open (logged as "[intake] DNS check inconclusive"). Check Vercel logs after deploy.
- Not built: double opt-in (confirm email before sending the report). Adds friction to a lead form; only worth it if junk keeps getting through.
