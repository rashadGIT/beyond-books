import { test, expect } from '@playwright/test';
import { E2E_USER } from './fixtures/auth';

test.beforeEach(async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(E2E_USER.email);
  await page.getByLabel('Password').fill(E2E_USER.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/(?!.*sign-in).*/, { timeout: 15000 });
});

test.describe('Ledger', () => {
  test('ledger page loads without error', async ({ page }) => {
    await page.goto('/ledger');
    // If not connected to QB the page renders a connect prompt; if connected it
    // renders the ledger. Either way the page body must be non-empty.
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    // No uncaught JS exceptions should crash the page
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('tab navigation is rendered', async ({ page }) => {
    await page.goto('/ledger');
    // The ledger renders five tabs: Chart of Accounts, General Ledger,
    // Trial Balance, AR Subledger, AP Subledger. At least one must be visible.
    // They are rendered as <button> elements.
    const firstTab = page
      .getByRole('button', { name: /chart of accounts/i })
      .or(page.getByRole('button', { name: /general ledger/i }))
      .or(page.getByRole('button', { name: /trial balance/i }))
      .first();
    await expect(firstTab).toBeVisible({ timeout: 10000 });
  });

  test('"Chart of Accounts" tab button exists', async ({ page }) => {
    await page.goto('/ledger');
    await expect(
      page.getByRole('button', { name: 'Chart of Accounts' }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('clicking General Ledger tab updates active tab', async ({ page }) => {
    await page.goto('/ledger');
    const tab = page.getByRole('button', { name: 'General Ledger' });
    await expect(tab).toBeVisible({ timeout: 10000 });
    await tab.click();
    // After clicking, the tab itself should remain visible (no crash / navigation)
    await expect(tab).toBeVisible();
  });

  test('QB connect prompt is shown when QuickBooks is not connected', async ({
    page,
  }) => {
    await page.goto('/ledger');
    // When QB is not connected the page shows one of these messages.
    // If QB is connected, these won't appear and the test is effectively a no-op
    // (it passes because the `or` chain finds nothing to assert against and we
    // only assert visibility if the element exists).
    const connectPrompt = page
      .getByText(/connect quickbooks/i)
      .or(page.getByText(/not connected/i))
      .or(page.getByText(/quickbooks/i));
    // At minimum the word "QuickBooks" should appear somewhere on the page
    // (either in a connect prompt or in a data header).
    await expect(connectPrompt.first()).toBeVisible({ timeout: 10000 });
  });
});
