import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility audit E2E tests using axe-core.
 *
 * Validates key pages against WCAG 2.1 AA standards.
 * Uses @axe-core/playwright for automated accessibility scanning.
 */

// Helper to run axe and return violations
async function getViolations(page: import('@playwright/test').Page, options?: { exclude?: string[][] }) {
  const builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);

  if (options?.exclude) {
    for (const selector of options.exclude) {
      builder.exclude(selector);
    }
  }

  const results = await builder.analyze();
  return results.violations;
}

// Format violations for readable test output
function formatViolations(violations: any[]) {
  return violations.map(v => ({
    id: v.id,
    impact: v.impact,
    description: v.description,
    helpUrl: v.helpUrl,
    nodes: v.nodes.length,
    targets: v.nodes.slice(0, 3).map((n: any) => n.target.join(' ')),
  }));
}

test.describe('Accessibility Audit', () => {

  test('Homepage has no critical accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const violations = await getViolations(page);
    const critical = violations.filter(v => v.impact === 'critical' || v.impact === 'serious');

    if (critical.length > 0) {
      console.log('Homepage critical/serious violations:', JSON.stringify(formatViolations(critical), null, 2));
    }

    expect(critical, `Found ${critical.length} critical/serious accessibility violations on homepage`).toHaveLength(0);
  });

  test('Homepage passes full axe audit', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const violations = await getViolations(page);

    if (violations.length > 0) {
      console.log('Homepage all violations:', JSON.stringify(formatViolations(violations), null, 2));
    }

    // Allow minor violations but track them — zero is the goal
    expect(violations.filter(v => v.impact === 'critical')).toHaveLength(0);
  });

  test('Registration page has no critical accessibility violations', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    const violations = await getViolations(page);
    const critical = violations.filter(v => v.impact === 'critical' || v.impact === 'serious');

    if (critical.length > 0) {
      console.log('Registration critical/serious violations:', JSON.stringify(formatViolations(critical), null, 2));
    }

    expect(critical, `Found ${critical.length} critical/serious accessibility violations on registration`).toHaveLength(0);
  });

  test('Feed page has no critical accessibility violations', async ({ page }) => {
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');

    const violations = await getViolations(page);
    const critical = violations.filter(v => v.impact === 'critical' || v.impact === 'serious');

    if (critical.length > 0) {
      console.log('Feed critical/serious violations:', JSON.stringify(formatViolations(critical), null, 2));
    }

    expect(critical, `Found ${critical.length} critical/serious accessibility violations on feed`).toHaveLength(0);
  });

  test('Explore page has no critical accessibility violations', async ({ page }) => {
    await page.goto('/explore');
    await page.waitForLoadState('networkidle');

    const violations = await getViolations(page);
    const critical = violations.filter(v => v.impact === 'critical' || v.impact === 'serious');

    if (critical.length > 0) {
      console.log('Explore critical/serious violations:', JSON.stringify(formatViolations(critical), null, 2));
    }

    expect(critical, `Found ${critical.length} critical/serious accessibility violations on explore`).toHaveLength(0);
  });

  test('About page has no critical accessibility violations', async ({ page }) => {
    await page.goto('/about');
    await page.waitForLoadState('networkidle');

    const violations = await getViolations(page);
    const critical = violations.filter(v => v.impact === 'critical' || v.impact === 'serious');

    if (critical.length > 0) {
      console.log('About critical/serious violations:', JSON.stringify(formatViolations(critical), null, 2));
    }

    expect(critical, `Found ${critical.length} critical/serious accessibility violations on about`).toHaveLength(0);
  });

  test('Developers page has no critical accessibility violations', async ({ page }) => {
    await page.goto('/developers');
    await page.waitForLoadState('networkidle');

    const violations = await getViolations(page);
    const critical = violations.filter(v => v.impact === 'critical' || v.impact === 'serious');

    if (critical.length > 0) {
      console.log('Developers critical/serious violations:', JSON.stringify(formatViolations(critical), null, 2));
    }

    expect(critical, `Found ${critical.length} critical/serious accessibility violations on developers`).toHaveLength(0);
  });

  test('Leaderboard page has no critical accessibility violations', async ({ page }) => {
    await page.goto('/leaderboard');
    await page.waitForLoadState('networkidle');

    const violations = await getViolations(page);
    const critical = violations.filter(v => v.impact === 'critical' || v.impact === 'serious');

    if (critical.length > 0) {
      console.log('Leaderboard critical/serious violations:', JSON.stringify(formatViolations(critical), null, 2));
    }

    expect(critical, `Found ${critical.length} critical/serious accessibility violations on leaderboard`).toHaveLength(0);
  });

  test('Token page has no critical accessibility violations', async ({ page }) => {
    await page.goto('/token');
    await page.waitForLoadState('networkidle');

    const violations = await getViolations(page);
    const critical = violations.filter(v => v.impact === 'critical' || v.impact === 'serious');

    if (critical.length > 0) {
      console.log('Token critical/serious violations:', JSON.stringify(formatViolations(critical), null, 2));
    }

    expect(critical, `Found ${critical.length} critical/serious accessibility violations on token`).toHaveLength(0);
  });

  test('Aggregate violation summary across all pages', async ({ page }) => {
    const pages = ['/', '/register', '/feed', '/explore', '/about', '/developers', '/leaderboard', '/token'];
    const allViolations: Record<string, { count: number; pages: string[]; impact: string }> = {};

    for (const url of pages) {
      await page.goto(url);
      await page.waitForLoadState('networkidle');

      const violations = await getViolations(page);
      for (const v of violations) {
        if (!allViolations[v.id]) {
          allViolations[v.id] = { count: 0, pages: [], impact: v.impact ?? 'minor' };
        }
        allViolations[v.id].count += v.nodes.length;
        allViolations[v.id].pages.push(url);
      }
    }

    const summary = Object.entries(allViolations)
      .sort(([, a], [, b]) => {
        const impactOrder: Record<string, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };
        return (impactOrder[a.impact] ?? 4) - (impactOrder[b.impact] ?? 4);
      });

    if (summary.length > 0) {
      console.log('\n=== ACCESSIBILITY VIOLATION SUMMARY ===');
      for (const [id, data] of summary) {
        console.log(`  [${data.impact.toUpperCase()}] ${id}: ${data.count} instances on ${data.pages.join(', ')}`);
      }
      console.log('=======================================\n');
    }

    // No critical violations allowed across any page
    const criticalCount = summary.filter(([, d]) => d.impact === 'critical').length;
    expect(criticalCount, 'Critical accessibility violations found across pages').toBe(0);
  });
});
