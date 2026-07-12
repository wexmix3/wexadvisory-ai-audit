import { test, expect } from '@playwright/test';

/**
 * Visual regression baselines for key pages/states.
 *
 * Deliberately excluded: the *completed* audit report on /results/[auditId].
 * That view renders API-generated numbers (savings estimate, scores) that
 * differ on every real run, which would make a pixel baseline flaky by
 * design. Instead we snapshot the report shell's loading state, which is
 * static markup and a reasonable stand-in for "the audit report render."
 *
 * See docs/testing.md for how to review a diff and how to intentionally
 * update baselines when a visual change is real.
 */

test.describe('visual baselines', () => {
  test('homepage', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /see where ai can save/i })).toBeVisible();
    await expect(page).toHaveScreenshot('homepage.png', { fullPage: true });
  });

  test('audit intake form — step 1', async ({ page }) => {
    await page.goto('/audit');
    await expect(page.getByRole('heading', { name: /your website/i })).toBeVisible();
    await expect(page).toHaveScreenshot('audit-step1.png', { fullPage: true });
  });

  test('results page — report shell / loading state', async ({ page }) => {
    // A fixed, never-real audit id always renders the loading shell (status
    // never resolves), giving a deterministic stand-in for the report render.
    await page.goto('/results/00000000-0000-0000-0000-000000000000');
    await expect(page.getByText(/ai opportunity snapshot/i)).toBeVisible();
    await expect(page).toHaveScreenshot('results-loading-shell.png', { fullPage: true });
  });
});
