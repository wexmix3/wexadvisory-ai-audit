# Cost Optimization Audit — ai-audit (2026-08-18)

## Context
Follow-up to Anthropic's Cost Optimization cookbook deep-dive (ingested via X Insights 2026-08-17). Original remote-agent dispatch for this audit (covering ai-audit, reco-dashboard, outreach-tool) stalled, then hit the known worktree-corruption bug on resume (2 failures) — switched to in-session execution per the standing "two strikes, go local" rule.

## Scope
6 files call the Anthropic API: `lib/ai/synthesize.ts` (2 call sites), `lib/ai/classify.ts`, `lib/pdf/visual-qa.ts`, `lib/ai/generate-proposal.ts`, `lib/ai/industry-research.ts`, `lib/ai/decompress-intake.ts`.

## Findings

**Main synthesis call** (`synthesize.ts`, `runSynthesisWithRetry`) — **already correctly cached**. `SYSTEM_PROMPT` is static and marked `cache_control: ephemeral`. This call retries up to 3x per audit (`CONTENT_LIMITS.length`), so the existing caching is doing real work within a single audit's retry loop, and across different audits run close together. No change needed.

**`scoreAuditQualityLLM`** (`synthesize.ts`) — had no `system` param at all; the static 1-5 scoring rubric was inline in the user prompt ahead of per-audit data (opportunities, savings figures). Fixed: split the rubric into a `system` block with `cache_control`, matching the pattern the main synthesis call already uses in the same file. Called once per audit (no in-run loop), so the benefit here is real only across audits submitted within the 5-min cache TTL of each other — plausible for a live lead-gen tool with concurrent visitors, but unverified without knowing actual submission volume. Applied anyway since it's zero-risk and consistent with the file's existing pattern.

**`classify.ts`, `visual-qa.ts`, `generate-proposal.ts`, `industry-research.ts`, `decompress-intake.ts`** — each called exactly once per audit/proposal pipeline run (confirmed by checking every caller — no loops). **Deliberately NOT changed this pass.** Each likely has a static instructional portion that could be split out the same way, but doing that for all 5 without evidence of real repetition (either an in-run loop, which none of these have, or actual concurrent traffic volume, which nothing in this codebase measures) would be applying the fix on speculation rather than a verified pattern — the same standard used to skip 4 of 5 call sites in `reco-dashboard`'s audit. Flagging as a follow-up: if AI Audit traffic ever becomes concurrent enough that two audits regularly land within 5 minutes of each other, revisit these 5 files together as one batch.

## Verification
- `npx tsc --noEmit -p .` — clean, no type errors.
- No test suite exists in this repo (no `.test.ts` files, no test script in `package.json`) — verified the `scoreAuditQualityLLM` change via careful manual review: same rubric text, same output contract, only the request-shape split changed.
- NOT verified against a live Anthropic call (would cost real tokens for a mechanical, low-risk change).

## Commit
Not yet committed — see final session report for the commit/tag, or `git log` in this repo if read after that point.
