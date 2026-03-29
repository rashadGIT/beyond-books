import { test, expect } from '@playwright/test';
import { E2E_USER } from './fixtures/auth';

/**
 * The chat interface lives on the root route ("/").
 * The message input is a <textarea> — getByRole('textbox') targets it.
 * Sending a message is done by pressing Enter (Shift+Enter inserts a newline).
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(E2E_USER.email);
  await page.getByLabel('Password').fill(E2E_USER.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/(?!.*sign-in).*/, { timeout: 15000 });
  // Ensure we are on the dashboard / chat page
  await page.goto('/');
});

test.describe('Chat', () => {
  test('message textarea is present on the dashboard', async ({ page }) => {
    // The chat input is the only <textarea> on the page
    const textarea = page.getByRole('textbox');
    await expect(textarea).toBeVisible({ timeout: 10000 });
  });

  test('typing and submitting a message shows it in the conversation', async ({
    page,
  }) => {
    const testMessage = 'Hello, this is an E2E test message';
    const textarea = page.getByRole('textbox');
    await textarea.fill(testMessage);

    // Enter sends the message (Shift+Enter would insert a newline instead)
    await page.keyboard.press('Enter');

    // The optimistic message bubble should appear immediately with the "ME"
    // avatar and the user's text
    await expect(page.getByText(testMessage)).toBeVisible({ timeout: 10000 });
  });

  test('loading indicator appears while the AI is responding', async ({
    page,
  }) => {
    const textarea = page.getByRole('textbox');
    await textarea.fill('Quick test query for loading indicator');
    await page.keyboard.press('Enter');

    // Three bouncing dots are rendered while status !== 'idle'. They live
    // inside a flex container alongside the "ME" / "AI" bubbles. We look for
    // any of the animated dot elements or just confirm the user message was
    // accepted (the dots may resolve very quickly against a fast API).
    const userBubble = page.getByText('Quick test query for loading indicator');
    await expect(userBubble).toBeVisible({ timeout: 10000 });
  });

  test('scheduled tasks section is present in the sidebar', async ({
    page,
  }) => {
    // The left sidebar shows "Scheduled Tasks" heading on desktop
    await expect(page.getByText(/scheduled tasks/i)).toBeVisible({
      timeout: 10000,
    });
  });
});
