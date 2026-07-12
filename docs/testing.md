# Testing

This app has two Playwright-based test layers under `e2e/`:

- **Smoke / e2e tests** (`e2e/smoke.spec.ts`) — functional, hits a real running
  dev server, no mocks.
- **Visual regression** (`e2e/visual.spec.ts`) — pixel screenshot diffs of key
  pages/states, baselines committed to git.

Both run against a real `npm run dev` instance on port 3200. Playwright's
`webServer` config starts it automatically if nothing is already listening on
that port.

## Running the tests

```
npm run test:e2e                 # everything (smoke + visual)
npx playwright test e2e/smoke.spec.ts
npx playwright test e2e/visual.spec.ts
```

## Important: the golden-path submission test hits production

`.env.local`'s `NEXT_PUBLIC_APP_URL` is set to `https://audit.wexadvisory.com`
(production), not `http://localhost:3200`. `/api/audit/snapshot` uses that env
var to trigger `/api/audit/process` (its trampoline to dodge the serverless
function duration cap). That means: **running the app locally and submitting
the intake form for real inserts a row into the production Supabase database
and triggers the production research/scoring pipeline** (real Firecrawl +
Tavily + Anthropic calls, real cost), even though the form itself was
rendered by your local dev server. This is true today regardless of these
tests — it's how the app has always behaved locally.

Because of that, the `golden path: submits a real intake and lands on the
results page` test in `smoke.spec.ts` is written to actually run (no mocks),
but treat it like any other cost-incurring external action: know you're
about to hit production before you run it. It uses
`maxwexley@wexadvisory.com` as the contact email, matching the project's
testing email scope. It does **not** wait for full report generation — it
only confirms the submission succeeds and the results page starts polling —
to keep runtime and spend bounded. If you want a fully-local loop, override
`NEXT_PUBLIC_APP_URL=http://localhost:3200` when starting `npm run dev` (the
Supabase row will still land in whatever database `NEXT_PUBLIC_SUPABASE_URL`
points to).

## Writing more e2e tests for this app

- **Selectors**: prefer `getByRole`, `getByLabel`, `getByPlaceholder`,
  `getByText` over CSS classes or test-ids. This app's Tailwind classes
  change often for styling reasons — a selector tied to `bg-slate-800/50`
  will break for reasons that have nothing to do with the behavior you're
  testing.
- **No hardcoded sleeps.** Use Playwright's auto-waiting assertions
  (`expect(locator).toBeVisible()`, `toHaveURL()`, etc.) with an explicit
  `timeout` override when a real operation is slow (e.g. Next dev
  compiling a route on first hit, or the audit pipeline's real API calls).
  Never `page.waitForTimeout(...)` to paper over a race.
- **Test user-visible behavior, not implementation.** E.g. assert the
  form shows an inline error and stays on step 1 — not that `useState`
  updated or that a specific class got added.
- **Real APIs cost real money and time here.** Any test that exercises
  the actual audit pipeline (Anthropic/Firecrawl/Tavily) should say so in a
  comment and be deliberately scoped (see the golden-path test above) rather
  than casually added to a fast smoke suite.

## Reviewing a visual diff

When `npx playwright test e2e/visual.spec.ts` fails on a screenshot
assertion, Playwright writes the actual/expected/diff images next to the
failure and includes them in the HTML report:

```
npx playwright show-report
```

Open the report, find the failing test, and look at the three images
(expected / actual / diff) side by side. If the difference is an actual
visual regression, fix the UI. If the difference is an **intentional**
visual change, update the baseline explicitly — never let a snapshot
update happen silently:

```
npx playwright test e2e/visual.spec.ts --update-snapshots
```

Then review the changed `.png` files under `e2e/*-snapshots/` in your diff
before committing — a baseline update is a real, reviewable change, same as
any other code change.

Baselines are OS/browser-specific (filenames include `-win32`/`-linux` etc).
These were generated on Windows. If CI ever runs Linux, generate a second
set of baselines there (or run visual tests only locally) — a Windows
baseline will not match a Linux-rendered screenshot.

## Test registry

Keep this table accurate — one row per behavior covered, not per test file.
Update it whenever a test is added, removed, or its coverage meaningfully
changes.

| File | Test | Covers |
|---|---|---|
| `e2e/smoke.spec.ts` | `homepage > renders the landing page and links to the audit form` | Landing page renders hero copy and CTA; CTA navigates to `/audit`. |
| `e2e/smoke.spec.ts` | `audit intake form > blocks step 1 submission when required fields are empty (edge case)` | Client-side validation blocks an empty step-1 submit and shows an inline error instead of advancing. |
| `e2e/smoke.spec.ts` | `audit intake form > golden path: submits a real intake and lands on the results page` | Full funnel: fill step 1 + step 2, submit, real `POST /api/audit/snapshot`, redirect to `/results/[auditId]`, results page begins polling. Hits real Supabase + triggers the real pipeline — see warning above. |
| `e2e/smoke.spec.ts` | `results page edge cases > a non-existent audit id does not crash the page` | `/results/:id` with an id that doesn't exist in the DB renders the loading shell instead of throwing or showing a raw error. |
| `e2e/visual.spec.ts` | `visual baselines > homepage` | Pixel baseline of the full landing page. |
| `e2e/visual.spec.ts` | `visual baselines > audit intake form — step 1` | Pixel baseline of the intake form's first step. |
| `e2e/visual.spec.ts` | `visual baselines > results page — report shell / loading state` | Pixel baseline of the results page's loading shell (stand-in for the report render — the completed report's numbers are non-deterministic per run, see comment in the spec file). |
