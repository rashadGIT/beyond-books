import { chromium } from '@playwright/test';
import path from 'path';

export const E2E_USER = {
  email: 'e2e@beyondbooks.test',
  password: 'E2eTestPass1!',
};

export const AUTH_STATE_PATH = path.join(__dirname, '../.auth/user.json');

/**
 * Performs a real browser login and saves the resulting cookie state
 * (httpOnly cookies included) to AUTH_STATE_PATH.
 *
 * Call this from a global setup or a one-off script before running
 * authenticated test suites.
 */
export async function saveAuthState() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:3000/sign-in');

  // The sign-in form uses plain <label> elements whose text matches these
  // patterns. No `for`/`id` linkage, but Playwright's getByLabel walks the
  // DOM and matches on label text content.
  await page.getByLabel('Email').fill(E2E_USER.email);
  await page.getByLabel('Password').fill(E2E_USER.password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait until we are no longer on the sign-in page
  await page.waitForURL(/(?!.*sign-in).*/, { timeout: 15000 });

  await context.storageState({ path: AUTH_STATE_PATH });
  await browser.close();
}
