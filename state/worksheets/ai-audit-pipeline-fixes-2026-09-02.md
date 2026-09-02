# Worksheet — AI Audit pipeline: deliverability + soundness fixes

**Date:** 2026-09-02 · **Repos touched:** wex-advisory, ai-audit, outreach-tool (aios session)

## RESUME KEYWORD: `VISUAL QA RESUME`

Say this at the start of the next session to pick up exactly where this left off: the silent PDF visual-QA scoring failure, described in full at the bottom of this file. Nothing else in this worksheet needs resuming — everything above the "Open item" section is shipped, verified live, and closed.

## Goal

Started as "does the new ScrollCraft /audit page work for cold outreach + is the AI Audit sound" and escalated into finding and fixing a full production outage in the AI Audit synthesis pipeline.

## What shipped, in order (all committed + pushed + live-verified)

1. **wex-advisory `bbf7e29`→`2802e2d`**: ScrollCraft rebuild of `/audit` promoted to the real route (was `/audit-v2` preview), overlap bug fixed, sitewide em-dash sweep, stale branding fixes (Client Brain→Canon, footer tagline), CTA consistency (all audit CTAs route through `/audit` now, not straight to the intake tool).
2. **outreach-tool `2120b5f`**: cold-outreach email template links repointed from `audit.wexadvisory.com` (old plain landing page) to `www.wexadvisory.com/audit` (the new page), applied directly to the `templates` table via service-role key. Verified: 0 rows still reference the old domain.
3. **ai-audit `2650c72`**: `/audit` intake form now reads `?url=` and prefills, so the landing page's close input carries through.
4. **ai-audit `11d1318`**: three soundness bugs found via review — added `leads.prospect_id` (migration `002_leads_prospect_id.sql`, run manually in Supabase SQL editor per the L0 schema-change policy) with FK-violation-safe retry logic; replaced a dead fallback model id (`claude-sonnet-4-6`, not real) with `claude-opus-4-8`; sanitized company names before they hit email subject headers (reproduced and fixed the exact 2026-05-27 BOM/ByteString crash in a unit test).
5. **ai-audit `d991ce4`**: AI Audit summary + admin emails moved from Resend (root domain, never DNS-verified in Brevo) to Brevo (`audit@send.wexadvisory.com`, same authenticated domain cold outreach already uses).
6. **ai-audit `5926159`**: **the big one.** Live-triggered a real audit to verify #5 and discovered synthesis had been completely broken since 2026-06-30 — every real audit failed with an undocumented `"compiled grammar is too large"` 400 from Anthropic's structured-output API. Tried `$defs`/`$ref` schema dedup (documented as supported, didn't help), tried a different model tier (not model-specific either), checked Anthropic's live docs directly (no documented limit exists). Reverted the synthesis call to the schema's proven-working pre-structured-output shape (prompted JSON + regex extraction, git `2b4f819`). Also found and fixed a second independent bug hit along the way: `temperature: 0` is now rejected outright by Opus/Sonnet 4.6+ models — removed from `synthesize.ts`, `classify.ts`, `visual-qa.ts`.

## Verification evidence

- Live end-to-end test through production (`auditId 2e0c3749-ce61-465f-b6db-fe1d3f250778`): `status: complete`, `lead_status: emailed`, lead row inserted correctly.
- Brevo's own event log (not just a send-accepted response) shows both emails `delivered` AND `opened`.
- `tsc --noEmit` and `next build` clean on every commit.
- Estimated total API spend across all live tests today: $2-3.

## Open item — next session starts here

**`visual_qa_score` is `null` on every audit ever run, including the verification run above, which post-dates the visual-QA feature shipping.** This is `lib/pdf/visual-qa.ts`'s `scoreVisualQuality()` — rasterizes the generated PDF via `@napi-rs/canvas` + `pdfjs-dist`, then asks Haiku 4.5 to grade the layout. It's wired as fire-and-forget (`.catch(err => console.error(...))` in `app/api/audit/process/route.ts`) so a failure never blocks email delivery — which is also why nobody has noticed it's never once worked.

**Working hypothesis, NOT confirmed:** `@napi-rs/canvas` is a native binary dependency. That's a classic Vercel serverless failure mode (missing from the function bundle, wrong target platform, `outputFileTracingIncludes` not configured for the native `.node` file). Nothing has been done to confirm this — no logs pulled (the historical failure window is long past retention), no local repro attempted, no fix applied.

**To resume:** say `VISUAL QA RESUME`. Suggested first steps for that session: (1) trigger a fresh audit and immediately tail Vercel's live function logs (not historical — those are gone) to catch the actual `console.error` output from the failure; (2) check whether `@napi-rs/canvas` appears in Vercel's build output / included files for the `api/audit/process` function; (3) if it's the native-binary theory, either add `outputFileTracingIncludes` in `next.config.ts` for the PDF rasterization function, or swap `@napi-rs/canvas` for a pure-JS/WASM PDF rasterizer that doesn't need a native binary.
