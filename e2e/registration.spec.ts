import { test, expect } from '@playwright/test';

/**
 * Registration flow E2E tests.
 *
 * These test the critical path: register a bot → get API key → see profile.
 * Uses role/text selectors (no brittle CSS selectors).
 */

function uniqueUsername() {
  return `e2e-bot-${Date.now().toString(36)}`;
}

test.describe('Registration Flow', () => {
  test('page loads with form fields', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Screen Name');
    await expect(page.locator('#reg-username')).toBeVisible();
    await expect(page.locator('#reg-display-name')).toBeVisible();
    await expect(page.getByRole('button', { name: /Register Agent/i })).toBeVisible();
  });

  test('validates username too short', async ({ page }) => {
    await page.goto('/register');
    await page.locator('#reg-username').fill('ab');
    // Trigger validation by clicking submit
    await page.getByRole('button', { name: /Register Agent/i }).click();
    await expect(page.getByText('Must be at least 3 characters')).toBeVisible();
  });

  test('validates username with uppercase shows lowercase', async ({ page }) => {
    await page.goto('/register');
    await page.locator('#reg-username').fill('MyBot');
    // Input should be lowercased automatically
    await expect(page.locator('#reg-username')).toHaveValue('mybot');
  });

  test('full registration creates bot and shows API key', async ({ page }) => {
    const username = uniqueUsername();
    await page.goto('/register');

    await page.locator('#reg-username').fill(username);
    await page.locator('#reg-display-name').fill('E2E Test Bot');
    await page.getByRole('button', { name: /Register Agent/i }).click();

    // Wait for success screen
    await expect(page.getByText('Welcome to AIMs!')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(`@${username}`)).toBeVisible();
    await expect(page.getByText('100 $AIMS')).toBeVisible();

    // API key should be shown
    await expect(page.getByText(/^aims_/)).toBeVisible();

    // Copy button exists
    await expect(page.getByRole('button', { name: /Copy$/i })).toBeVisible();

    // Navigation buttons to profile and getting-started
    await expect(page.getByRole('button', { name: /Full Setup Guide/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Profile/i })).toBeVisible();
  });

  test('registered bot profile page is accessible', async ({ page }) => {
    const username = uniqueUsername();
    await page.goto('/register');
    await page.locator('#reg-username').fill(username);
    await page.getByRole('button', { name: /Register Agent/i }).click();
    await expect(page.getByText('Welcome to AIMs!')).toBeVisible({ timeout: 15_000 });

    // Navigate to profile
    await page.getByRole('button', { name: /Profile/i }).click();
    await expect(page).toHaveURL(new RegExp(`/bots/${username}`));
    await expect(page.getByText(username)).toBeVisible();
  });

  test('duplicate username shows error', async ({ page }) => {
    const username = uniqueUsername();

    // Register first time
    await page.goto('/register');
    await page.locator('#reg-username').fill(username);
    await page.getByRole('button', { name: /Register Agent/i }).click();
    await expect(page.getByText('Welcome to AIMs!')).toBeVisible({ timeout: 15_000 });

    // Try again with same username
    await page.goto('/register');
    await page.locator('#reg-username').fill(username);
    await page.getByRole('button', { name: /Register Agent/i }).click();

    // Should see error
    await expect(page.getByText(/already|taken|exists/i)).toBeVisible({ timeout: 10_000 });
  });
});
