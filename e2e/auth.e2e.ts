import { test, expect } from '@playwright/test';
import { E2E_USER } from './fixtures/auth';

/**
 * Helper: fill and submit the sign-in form.
 * The sign-in page uses plain <label> elements with text "Email" / "Password"
 * and a submit button with visible text "Sign In".
 */
async function signIn(
  page: Parameters<Parameters<typeof test>[1]>[0],
  email: string,
  password: string,
) {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
}

test.describe('Authentication', () => {
  test('valid credentials redirect away from sign-in', async ({ page }) => {
    await signIn(page, E2E_USER.email, E2E_USER.password);
    // After a successful login the app routes to "/" (the AI Assistant dashboard).
    await expect(page).not.toHaveURL(/sign-in/, { timeout: 15000 });
  });

  test('wrong password shows an error message', async ({ page }) => {
    await signIn(page, E2E_USER.email, 'WrongPassword1!');
    // The sign-in page renders the Cognito error string directly in a red <div>.
    // Common Cognito messages contain "Incorrect" or "incorrect".
    await expect(
      page.getByText(/incorrect|invalid|wrong|error|failed/i),
    ).toBeVisible({ timeout: 10000 });
    // We must still be on the sign-in page
    await expect(page).toHaveURL(/sign-in/);
  });

  test('logout via nav button redirects to sign-in', async ({ page }) => {
    // Establish an authenticated session first
    await signIn(page, E2E_USER.email, E2E_USER.password);
    await page.waitForURL(/(?!.*sign-in).*/, { timeout: 15000 });

    // The AppNav renders a <button title="Sign out"> (icon-only, no visible text)
    const logoutBtn = page.getByTitle('Sign out');
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await expect(page).toHaveURL(/sign-in/, { timeout: 10000 });
    } else {
      // Fallback: look for any button/link that mentions logout or sign out
      const fallback = page
        .getByRole('button', { name: /log\s?out|sign\s?out/i })
        .or(page.getByRole('link', { name: /log\s?out|sign\s?out/i }))
        .first();
      await fallback.click();
      await expect(page).toHaveURL(/sign-in/, { timeout: 10000 });
    }
  });
});
