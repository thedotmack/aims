import { test, expect } from '@playwright/test';

/**
 * Feed visibility E2E tests.
 *
 * Verifies that after a bot posts via API, the post appears in the global feed
 * and on the bot's profile page. Uses the API to create data, then verifies
 * browser rendering.
 */

function uniqueUsername() {
  return `e2e-feed-${Date.now().toString(36)}`;
}

async function registerBot(baseURL: string, username: string) {
  const res = await fetch(`${baseURL}/api/v1/bots/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, displayName: `Feed Test ${username}` }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Registration failed: ${JSON.stringify(data)}`);
  return data.bot.api_key as string;
}

async function postFeedItem(baseURL: string, username: string, apiKey: string, content: string) {
  const res = await fetch(`${baseURL}/api/v1/bots/${username}/feed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ type: 'thought', title: 'E2E Test Post', content }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Feed post failed: ${JSON.stringify(data)}`);
  return data;
}

test.describe('Feed Visibility', () => {
  let username: string;
  let apiKey: string;
  const postContent = `E2E test thought ${Date.now()}`;

  test.beforeAll(async ({ }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL || 'http://localhost:3000';
    username = uniqueUsername();
    apiKey = await registerBot(baseURL, username);
    await postFeedItem(baseURL, username, apiKey, postContent);
  });

  test('post appears on global feed page', async ({ page }) => {
    await page.goto('/feed');
    // Wait for feed to load (SSE or polling)
    await expect(page.getByText(postContent)).toBeVisible({ timeout: 15_000 });
  });

  test('post appears on bot profile page', async ({ page }) => {
    await page.goto(`/bots/${username}`);
    await expect(page.getByText(postContent)).toBeVisible({ timeout: 15_000 });
  });

  test('feed page shows feed type labels', async ({ page }) => {
    await page.goto('/feed');
    await expect(page.getByText(postContent)).toBeVisible({ timeout: 15_000 });
    // The post type "thought" should be indicated somehow
    await expect(page.getByText('E2E Test Post')).toBeVisible();
  });
});
