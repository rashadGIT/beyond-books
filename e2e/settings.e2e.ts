import { test, expect } from '@playwright/test';
import { E2E_USER } from './fixtures/auth';

test.beforeEach(async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(E2E_USER.email);
  await page.getByLabel('Password').fill(E2E_USER.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/(?!.*sign-in).*/, { timeout: 15000 });
});

test.describe('Settings', () => {
  test('settings page loads and shows the Settings heading', async ({
    page,
  }) => {
    await page.goto('/settings');
    // The <h1> reads "Settings" (with a gear icon)
    await expect(
      page.getByRole('heading', { name: /settings/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('Letter Branding section is visible', async ({ page }) => {
    await page.goto('/settings');
    // Section heading: "Letter Branding"
    await expect(page.getByText(/letter branding/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test('Organization Name input is present in the branding form', async ({
    page,
  }) => {
    await page.goto('/settings');
    // The branding form renders a label "Organization Name" followed by an
    // <input type="text">. Playwright's getByLabel matches on the text content
    // of the adjacent <label> element.
    await expect(page.getByLabel('Organization Name')).toBeVisible({
      timeout: 10000,
    });
  });

  test('QuickBooks section is visible', async ({ page }) => {
    await page.goto('/settings');
    // The QuickBooks card heading renders "QUICKBOOKS" (uppercase via CSS, but
    // the DOM text node is "QuickBooks")
    await expect(page.getByText(/quickbooks/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('QB connect button or connected status is shown', async ({ page }) => {
    await page.goto('/settings');
    // When not connected: an <a> reads "Connect QuickBooks"
    // When connected: a <p> reads the company name or "Connected"
    // Either way, some QuickBooks-related text must be visible.
    const connectButton = page.getByRole('link', {
      name: /connect quickbooks/i,
    });
    const connectedStatus = page.getByText(/connected|disconnect quickbooks/i);

    const either = connectButton.or(connectedStatus).first();
    await expect(either).toBeVisible({ timeout: 10000 });
  });

  test('Save Branding button is present', async ({ page }) => {
    await page.goto('/settings');
    await expect(
      page.getByRole('button', { name: /save branding/i }),
    ).toBeVisible({ timeout: 10000 });
  });
});
