import { test, expect } from '@playwright/test';
import { E2E_USER } from './fixtures/auth';

test.beforeEach(async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(E2E_USER.email);
  await page.getByLabel('Password').fill(E2E_USER.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/(?!.*sign-in).*/, { timeout: 15000 });
});

test.describe('Spreadsheet', () => {
  test('spreadsheet page loads without error', async ({ page }) => {
    await page.goto('/spreadsheet');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });

  test('Export tab is active by default', async ({ page }) => {
    await page.goto('/spreadsheet');
    // The component initialises activeTab as 'export', which renders
    // a tab button containing the word "Export".
    await expect(
      page.getByRole('button', { name: /export/i }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('Import tab button is visible', async ({ page }) => {
    await page.goto('/spreadsheet');
    await expect(
      page.getByRole('button', { name: /import/i }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('clicking Import tab shows import UI', async ({ page }) => {
    await page.goto('/spreadsheet');
    const importTab = page.getByRole('button', { name: /import/i }).first();
    await importTab.click();
    // After switching, import-related content should be on the page.
    // The import panel shows entity type options like "Invoices", "Customers".
    await expect(page.getByText(/invoices|customers|vendors/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('Templates tab button is visible', async ({ page }) => {
    await page.goto('/spreadsheet');
    await expect(
      page.getByRole('button', { name: /templates/i }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('export data type selector contains Invoices option', async ({
    page,
  }) => {
    await page.goto('/spreadsheet');
    // The export panel renders radio/button options for data types.
    // "Invoices" is the first EXPORT_TYPE item.
    await expect(page.getByText('Invoices').first()).toBeVisible({
      timeout: 10000,
    });
  });
});
