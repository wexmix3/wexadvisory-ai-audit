import { test, expect } from '@playwright/test';

/**
 * Smoke tests for the core audit funnel: homepage -> intake form -> results page.
 *
 * These hit a real running instance of the app (npm run dev on :3200), not mocks.
 * The golden-path test below submits a real intake, which creates a real Supabase
 * row and triggers the real research/scoring pipeline (Firecrawl + Tavily +
 * Anthropic). That costs a small amount of real API spend and takes real time,
 * so it is intentionally scoped to just confirm the pipeline *starts* and the
 * results page begins polling — it does not wait for full report generation.
 * See docs/testing.md for the registry of what each test covers.
 */

test.describe('homepage', () => {
  test('renders the landing page and links to the audit form', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /see where ai can save/i })).toBeVisible();

    const cta = page.getByRole('link', { name: /get my free ai snapshot/i }).first();
    await expect(cta).toBeVisible();
    await cta.click();

    // Generous timeout: Next dev compiles /audit on-demand on first visit, which
    // can take longer than Playwright's default 5s assertion timeout.
    await expect(page).toHaveURL(/\/audit$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /your website/i })).toBeVisible();
  });
});

test.describe('audit intake form', () => {
  test('blocks step 1 submission when required fields are empty (edge case)', async ({ page }) => {
    await page.goto('/audit');

    await page.getByRole('button', { name: /analyze my business/i }).click();

    await expect(page.getByText(/please enter your website url/i)).toBeVisible();
    // Should stay on step 1 — step 2 fields must not be visible.
    await expect(page.getByLabel(/industry/i)).toHaveCount(0);
  });

  test('golden path: submits a real intake and lands on the results page', async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto('/audit');

    await page.getByPlaceholder('yourcompany.com').fill('https://example.com');
    await page.getByPlaceholder('Acme Inc').fill('Playwright Smoke Test Co');
    await page.getByRole('button', { name: /analyze my business/i }).click();

    await page.getByLabel(/industry/i).selectOption('SaaS / Technology');
    await page
      .getByPlaceholder(/manual reporting takes hours/i)
      .fill('E2E smoke test run — please ignore.');
    await page.getByPlaceholder('Jane Smith').fill('Playwright Bot');
    await page.getByPlaceholder('jane@company.com').fill('maxwexley@wexadvisory.com');

    await page.getByRole('button', { name: /generate my snapshot/i }).click();

    // Real network round trip: POST /api/audit/snapshot -> insert row -> trigger
    // /api/audit/process -> redirect to /results/[auditId].
    await expect(page).toHaveURL(/\/results\/[^/]+$/, { timeout: 30_000 });

    // Don't wait for the full pipeline to finish (60-90s + real API cost) — just
    // confirm the results page is live and has begun polling for status.
    await expect(
      page.getByText(/starting analysis|researching your business|classifying business model|quantifying ai opportunities/i)
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('results page edge cases', () => {
  test('a non-existent audit id does not crash the page', async ({ page }) => {
    const response = await page.goto('/results/00000000-0000-0000-0000-000000000000');
    expect(response?.ok()).toBeTruthy();

    // The page itself should render without throwing, even though the underlying
    // /api/audit/:id/status call 404s. It stays in its default loading state
    // rather than surfacing a raw error to the visitor.
    await expect(page.getByText(/ai opportunity snapshot/i)).toBeVisible();
  });
});
