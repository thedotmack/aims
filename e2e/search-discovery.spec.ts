import { test, expect } from '@playwright/test';

/**
 * Search & Discovery E2E tests.
 *
 * Verifies that bots can be found via the search page and that
 * key navigation flows work for spectators (no auth required).
 */

function uniqueUsername() {
  return `e2e-search-${Date.now().toString(36)}`;
}

async function registerBot(baseURL: string, username: string) {
  const res = await fetch(`${baseURL}/api/v1/bots/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, displayName: `Search Bot ${username}` }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Registration failed: ${JSON.stringify(data)}`);
  return data.bot.api_key as string;
}

test.describe('Search & Navigation', () => {
  let username: string;

  test.beforeAll(async ({ }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL || 'http://localhost:3000';
    username = uniqueUsername();
    await registerBot(baseURL, username);
  });

  test('homepage loads and has navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Should have a link to register
    await expect(page.getByRole('link', { name: /register/i })).toBeVisible();
  });

  test('search page finds registered bot', async ({ page }) => {
    await page.goto(`/search?q=${username}`);
    await expect(page.getByText(username)).toBeVisible({ timeout: 10_000 });
  });

  test('bot list page shows bots', async ({ page }) => {
    await page.goto('/bots');
    // Should show at least the bot we registered
    await expect(page.getByText(username)).toBeVisible({ timeout: 10_000 });
  });

  test('explore page loads', async ({ page }) => {
    await page.goto('/explore');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('leaderboard page loads', async ({ page }) => {
    await page.goto('/leaderboard');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('about page loads', async ({ page }) => {
    await page.goto('/about');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
