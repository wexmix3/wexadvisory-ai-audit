# Worksheet — Visual QA scoring bug, three stacked root causes

**Date:** 2026-09-02 · **Repo:** ai-audit · **Resumed from:** `VISUAL QA RESUME` keyword, see `state/worksheets/ai-audit-pipeline-fixes-2026-09-02.md`

## Goal

`visual_qa_score` had been `null` on every audit ever run since the feature shipped 2026-06-29. Find and fix the root cause.

## What it turned out to be

Not one bug — three, stacked, each one masking the next until fixed. Systematic debugging (root-cause tracing against live production, not local repro alone) was essential here: the local test script (`scripts/visual-qa-check.mjs`) always passed, because it never exercised any of the three failure modes.

1. **Missing dependency declaration** (`c60a4b4`): `@napi-rs/canvas` and `pdfjs-dist` were never in `package.json` — only ever transitive deps of `pdf-parse`, hoisted to top-level `node_modules` by npm locally. The commit that introduced visual-qa.ts (`f780d66`) said "both already transitive deps, no new installs" — that was the mistake. Declared both as direct deps at their already-locked versions.
2. **Untraced worker file** (`cb201e7`): with the deps now resolvable, the real error surfaced via live Vercel logs: `Cannot find module '.../pdfjs-dist/legacy/build/pdf.worker.mjs'`. pdfjs-dist's fake-worker fallback dynamically imports that file by path at runtime, which Vercel's static file tracer (`@vercel/nft`) can't see. Fixed with `outputFileTracingIncludes` in `next.config.ts` for the `/api/audit/process` route.
3. **Detached promise vs. `after()`'s `waitUntil`** (`4b4cb7a`): with both of the above fixed, the pipeline actually ran (pdfjs's own font-load warnings appeared in logs) but `visual_qa_score` was STILL null, with no error logged anywhere. Root cause: `scoreVisualQuality(pdfBuffer).then(...).catch(...)` was fire-and-forget — never awaited inside `runAuditPipelineAsync`, which itself runs inside `after(async () => { await runAuditPipelineAsync(...) })`. Per Next.js docs, `waitUntil` only extends the serverless invocation's lifetime for the promise passed to `after()`. Since the visual-QA chain wasn't part of that promise, Vercel could freeze the container the instant the rest of the pipeline (leads insert, proposal pipeline) finished — killing the visual-QA chain mid-flight, before the Anthropic network call or DB update ran. Fixed by awaiting it directly inside `runAuditPipelineAsync` (still runs after email send, so it never blocks/delays delivery — that ordering was already correct and untouched). Also fixed a second latent bug found along the way: the Supabase `.update()` call resolves with an `error` field on failure rather than rejecting, so the original `.catch()` would never have caught a DB-side failure even with the freeze bug fixed. Now checked and logged explicitly.

## Verification evidence — 3 live production audits, one per fix

| Run | auditId | Deploy | Result |
|---|---|---|---|
| 1 | `429e9ac8-5ceb-4c93-b313-e9abfea10975` | `dpl_JV5AYVdUfxmP1948kFLhJuM7W5ko` (fix #1 only) | Failed: `Cannot find module '@napi-rs/canvas'`-class error → `Setting up fake worker failed: Cannot find module '.../pdf.worker.mjs'` |
| 2 | `8258dd97-1127-4cb6-9857-0ff90ae50a45` | `dpl_CKzxHwVXJCxNDJ4MQrZgXvKQZTQg` (fix #1+#2) | Worker resolved (only benign pdfjs font warnings in logs), but `visual_qa_score` stayed `null`, no error logged — matched the detached-promise hypothesis |
| 3 | `d1f09191-e549-474c-aa84-6358f2fc722a` | (fix #1+#2+#3) | **`visual_qa_score: 42`, `verdict: "fail"`, 6 specific issues** — pipeline genuinely works end-to-end |

Confirmed each failure mode by pulling live Vercel function logs (`vercel logs <deployment-id>`) after each deploy, not by inference — this is what surfaced the exact error strings that separated hypothesis 1 from hypothesis 2, and the absence of any log line (not even from a rejected promise) that pointed at hypothesis 3.

Manually tested the Supabase update query in isolation (matching exact payload shape) to rule out an RLS/schema issue before concluding it was a container-freeze problem, not a database problem.

## Bonus finding, not yet actioned

Run 3's real score was 42/fail with 6 concrete layout defects (severe whitespace imbalance, pages almost entirely blank). This is the first real signal the visual-QA feature has ever produced. Per the code's own comment, "layout issues are code bugs in snapshot-pdf.tsx, not LLM-content issues a retry could fix" — worth a follow-up session to look at `snapshot-pdf.tsx`'s pagination/whitespace logic. Not investigated in this session; scope was strictly "make the scoring pipeline work," not "fix what it found."

## Cost

3 live audits + font/API testing across this session: Anthropic (Opus synthesis + Haiku classify/visual-QA) + Firecrawl/Tavily, all against Max's own key, all targeted to `maxwexley@wexadvisory.com` only. Estimated $3-5 total, consistent with the $25/mo ceiling.

## Remaining scope

None on the scoring pipeline itself — closed. The bonus finding above (actual layout defects in generated PDFs) is open and unscoped.
