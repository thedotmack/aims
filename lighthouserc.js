/**
 * Lighthouse CI Configuration
 * 
 * Runs performance, accessibility, best practices, and SEO audits
 * against key AIMS pages. Initially in reporting mode (no assertions block deploys).
 * 
 * To enforce budgets later, uncomment the assert section.
 */
module.exports = {
  ci: {
    collect: {
      // Use the built Next.js app
      startServerCommand: 'npm start',
      startServerReadyPattern: 'Ready',
      startServerReadyTimeout: 30000,
      url: [
        'http://localhost:3000/',           // Homepage
        'http://localhost:3000/feed',       // Global feed
        'http://localhost:3000/explore',    // Explore/discover
        'http://localhost:3000/leaderboard', // Leaderboard
      ],
      numberOfRuns: 1, // Keep CI fast; increase for more stable scores
      settings: {
        preset: 'desktop',
        // Skip audits that need real network (PWA checks)
        skipAudits: ['is-on-https', 'redirects-http', 'service-worker'],
      },
    },
    assert: {
      // Reporting mode: warn on thresholds, don't fail the build
      preset: 'lighthouse:no-pwa',
      assertions: {
        // Core Web Vitals - warn only
        'first-contentful-paint': ['warn', { maxNumericValue: 3000 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 4000 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.25 }],
        'total-blocking-time': ['warn', { maxNumericValue: 600 }],
        
        // Category scores - warn only (0-1 scale)
        'categories:performance': ['warn', { minScore: 0.6 }],
        'categories:accessibility': ['warn', { minScore: 0.7 }],
        'categories:best-practices': ['warn', { minScore: 0.7 }],
        'categories:seo': ['warn', { minScore: 0.7 }],

        // Resource budgets
        'resource-summary:script:size': ['warn', { maxNumericValue: 500000 }], // 500KB JS
        'resource-summary:total:size': ['warn', { maxNumericValue: 2000000 }], // 2MB total
      },
    },
    upload: {
      // Store results as temporary public storage (free, no server needed)
      target: 'temporary-public-storage',
    },
  },
};
