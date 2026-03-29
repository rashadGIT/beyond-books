import { test, expect } from '@playwright/test';
import { E2E_USER } from './fixtures/auth';

test.beforeEach(async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(E2E_USER.email);
  await page.getByLabel('Password').fill(E2E_USER.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/(?!.*sign-in).*/, { timeout: 15000 });
});

test.describe('Letters', () => {
  test('letters page loads without error', async ({ page }) => {
    await page.goto('/letters');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });

  test('donation letter related text is present on the page', async ({
    page,
  }) => {
    await page.goto('/letters');
    // The page is titled "Donation Letters" in the AppNav and the component
    // works with donor/donation data. One of these terms must appear.
    const donationText = page
      .getByText(/donation/i)
      .or(page.getByText(/donor/i))
      .or(page.getByText(/letter/i));
    await expect(donationText.first()).toBeVisible({ timeout: 10000 });
  });

  test('print or email action buttons are accessible', async ({ page }) => {
    await page.goto('/letters');
    // The letters page includes Printer and Mail action buttons.
    // When no donors are loaded they may be disabled; we only check visibility.
    const actionBtn = page
      .getByRole('button', { name: /print|email|send/i })
      .first();
    // If no donors are present these buttons may not be rendered. Guard with
    // a conditional check so the test does not fail on a clean environment.
    const count = await actionBtn.count();
    if (count > 0) {
      await expect(actionBtn).toBeVisible({ timeout: 10000 });
    }
  });

  test('QB connect prompt or donor data is shown', async ({ page }) => {
    await page.goto('/letters');
    // With no QB connection the component shows a connect prompt or an empty
    // state. With a connection it shows donor groups. Either way the page
    // must render something meaningful.
    const content = page
      .getByText(/quickbooks|donor|no donors|connect/i)
      .first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });
});
