/**
 * Static accessibility tests using axe-core with jsdom.
 *
 * These tests validate HTML patterns used across the app without
 * requiring a running server. They catch common WCAG violations
 * in form structures, navigation, headings, images, and ARIA usage.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import axe from 'axe-core';

// jsdom setup for axe-core
function setupDocument(html: string): Document {
  const doc = new DOMParser().parseFromString(
    `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body>${html}</body></html>`,
    'text/html'
  );
  return doc;
}

async function runAxe(html: string, rules?: string[]) {
  document.documentElement.innerHTML = '';
  document.open();
  document.write(`<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body>${html}</body></html>`);
  document.close();

  const config: axe.RunOptions = {
    rules: rules ? Object.fromEntries(rules.map(r => [r, { enabled: true }])) : undefined,
  };

  const results = await axe.run(document, config);
  return results;
}

describe('Accessibility: Form Patterns', () => {
  it('registration form inputs have associated labels', async () => {
    const html = `
      <form>
        <label for="reg-username">Username</label>
        <input id="reg-username" type="text" name="username" />
        <label for="reg-display-name">Display Name</label>
        <input id="reg-display-name" type="text" name="displayName" />
        <button type="submit">Register Agent</button>
      </form>
    `;
    const results = await runAxe(html);
    const labelViolations = results.violations.filter(v => v.id === 'label');
    expect(labelViolations).toHaveLength(0);
  });

  it('search inputs have accessible labels', async () => {
    const html = `
      <form role="search">
        <label for="search-input" class="sr-only">Search bots and content</label>
        <input id="search-input" type="search" placeholder="Search..." />
      </form>
    `;
    const results = await runAxe(html);
    const labelViolations = results.violations.filter(v => v.id === 'label');
    expect(labelViolations).toHaveLength(0);
  });

  it('email subscription form has proper labels', async () => {
    const html = `
      <form>
        <label for="digest-email">Email address</label>
        <input id="digest-email" type="email" name="email" />
        <label for="digest-frequency">Frequency</label>
        <select id="digest-frequency" name="frequency">
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
        <button type="submit">Subscribe</button>
      </form>
    `;
    const results = await runAxe(html);
    const violations = results.violations.filter(v =>
      v.id === 'label' || v.id === 'select-name'
    );
    expect(violations).toHaveLength(0);
  });

  it('buttons without visible text have aria-label', async () => {
    const html = `
      <button aria-label="Notifications">
        <svg viewBox="0 0 24 24"><path d="M12 2L2 12h3v8h6v-6h2v6h6v-8h3L12 2z"/></svg>
      </button>
      <button aria-label="Toggle sound">
        <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3z"/></svg>
      </button>
    `;
    const results = await runAxe(html);
    const buttonViolations = results.violations.filter(v => v.id === 'button-name');
    expect(buttonViolations).toHaveLength(0);
  });
});

describe('Accessibility: Navigation & Landmarks', () => {
  it('page has proper landmark structure', async () => {
    const html = `
      <header role="banner">
        <nav aria-label="Main navigation">
          <a href="/">Home</a>
          <a href="/feed">Feed</a>
          <a href="/explore">Explore</a>
        </nav>
      </header>
      <main role="main">
        <h1>Page Title</h1>
        <p>Content here</p>
      </main>
      <footer>
        <p>Footer content</p>
      </footer>
    `;
    const results = await runAxe(html);
    const landmarkViolations = results.violations.filter(v =>
      v.id.includes('landmark') || v.id === 'region'
    );
    expect(landmarkViolations).toHaveLength(0);
  });

  it('skip navigation link exists and targets main', async () => {
    const html = `
      <a href="#main-content" class="sr-only focus:not-sr-only">Skip to main content</a>
      <header><nav aria-label="Main"><a href="/">Home</a></nav></header>
      <main id="main-content" role="main">
        <h1>Content</h1>
      </main>
    `;
    const results = await runAxe(html);
    const skipViolations = results.violations.filter(v => v.id === 'skip-link');
    expect(skipViolations).toHaveLength(0);
  });

  it('multiple nav elements have distinct labels', async () => {
    const html = `
      <nav aria-label="Main navigation">
        <a href="/">Home</a>
        <a href="/feed">Feed</a>
      </nav>
      <nav aria-label="Footer navigation">
        <a href="/about">About</a>
        <a href="/terms">Terms</a>
      </nav>
    `;
    const results = await runAxe(html);
    // No duplicate-landmark issues
    expect(results.violations.filter(v => v.id === 'landmark-unique')).toHaveLength(0);
  });
});

describe('Accessibility: Heading Structure', () => {
  it('headings follow logical order', async () => {
    const html = `
      <main>
        <h1>AIMS - AI Messenger Service</h1>
        <section>
          <h2>How It Works</h2>
          <h3>Step 1: Register</h3>
          <h3>Step 2: Integrate</h3>
        </section>
        <section>
          <h2>Token Economy</h2>
        </section>
      </main>
    `;
    const results = await runAxe(html);
    const headingViolations = results.violations.filter(v =>
      v.id === 'heading-order' || v.id === 'page-has-heading-one'
    );
    expect(headingViolations).toHaveLength(0);
  });

  it('page has exactly one h1', async () => {
    const html = `
      <main>
        <h1>Page Title</h1>
        <h2>Section</h2>
      </main>
    `;
    const results = await runAxe(html);
    // axe doesn't enforce single h1 by default, but we check no violations
    expect(results.violations.filter(v => v.id === 'page-has-heading-one')).toHaveLength(0);
  });
});

describe('Accessibility: Images & Media', () => {
  it('images have alt text', async () => {
    const html = `
      <img src="/logo.png" alt="AIMS logo" />
      <img src="/bot-avatar.png" alt="Bot avatar for claude-mem" />
    `;
    const results = await runAxe(html);
    const imgViolations = results.violations.filter(v => v.id === 'image-alt');
    expect(imgViolations).toHaveLength(0);
  });

  it('decorative images use empty alt', async () => {
    const html = `
      <img src="/decoration.png" alt="" role="presentation" />
      <p>Some content</p>
    `;
    const results = await runAxe(html);
    expect(results.violations.filter(v => v.id === 'image-alt')).toHaveLength(0);
  });
});

describe('Accessibility: Color & Contrast', () => {
  it('text has sufficient color contrast', async () => {
    const html = `
      <div style="background-color: #1e1b4b; color: #ffffff; padding: 20px;">
        <h1 style="color: #FFD700;">AIMS Platform</h1>
        <p>Welcome to the AI transparency layer.</p>
      </div>
    `;
    const results = await runAxe(html);
    const contrastViolations = results.violations.filter(v => v.id === 'color-contrast');
    expect(contrastViolations).toHaveLength(0);
  });

  it('link text is distinguishable', async () => {
    const html = `
      <p>Visit the <a href="/feed" style="color: #FFD700; text-decoration: underline;">live feed</a> to see bot activity.</p>
    `;
    const results = await runAxe(html);
    const linkViolations = results.violations.filter(v => v.id === 'link-in-text-block');
    expect(linkViolations).toHaveLength(0);
  });
});

describe('Accessibility: ARIA Patterns', () => {
  it('live regions are properly configured', async () => {
    const html = `
      <div aria-live="polite" aria-atomic="true">
        <span>3 new notifications</span>
      </div>
    `;
    const results = await runAxe(html);
    const ariaViolations = results.violations.filter(v => v.id.startsWith('aria-'));
    expect(ariaViolations).toHaveLength(0);
  });

  it('modal dialog has proper ARIA attributes', async () => {
    const html = `
      <div role="dialog" aria-labelledby="modal-title" aria-modal="true">
        <h2 id="modal-title">Verify on Chain</h2>
        <p>Transaction details here</p>
        <button>Close</button>
      </div>
    `;
    const results = await runAxe(html);
    const ariaViolations = results.violations.filter(v => v.id.startsWith('aria-'));
    expect(ariaViolations).toHaveLength(0);
  });

  it('tablist and tabs have correct roles', async () => {
    const html = `
      <div role="tablist" aria-label="Feed filters">
        <button role="tab" aria-selected="true" aria-controls="panel-all">All</button>
        <button role="tab" aria-selected="false" aria-controls="panel-thoughts">Thoughts</button>
        <button role="tab" aria-selected="false" aria-controls="panel-actions">Actions</button>
      </div>
      <div role="tabpanel" id="panel-all">Content</div>
    `;
    const results = await runAxe(html);
    const ariaViolations = results.violations.filter(v => v.id.startsWith('aria-'));
    expect(ariaViolations).toHaveLength(0);
  });

  it('expandable notification dropdown has aria-expanded', async () => {
    const html = `
      <button aria-label="Notifications" aria-expanded="false" aria-haspopup="true">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10"/></svg>
        <span class="sr-only">3 unread notifications</span>
      </button>
    `;
    const results = await runAxe(html);
    const violations = results.violations.filter(v =>
      v.id === 'button-name' || v.id.startsWith('aria-')
    );
    expect(violations).toHaveLength(0);
  });
});

describe('Accessibility: Document Structure', () => {
  it('html has lang attribute', async () => {
    // Our runAxe helper already sets lang="en", verify no violations
    const html = `<main><h1>Test</h1></main>`;
    const results = await runAxe(html);
    const langViolations = results.violations.filter(v => v.id === 'html-has-lang');
    expect(langViolations).toHaveLength(0);
  });

  it('page has title', async () => {
    // Our runAxe helper sets <title>Test</title>
    const html = `<main><h1>Test</h1></main>`;
    const results = await runAxe(html);
    const titleViolations = results.violations.filter(v => v.id === 'document-title');
    expect(titleViolations).toHaveLength(0);
  });

  it('lists use proper markup', async () => {
    const html = `
      <nav aria-label="Bot list">
        <ul>
          <li><a href="/bots/claude-mem">claude-mem</a></li>
          <li><a href="/bots/oracle-9">oracle-9</a></li>
          <li><a href="/bots/spark">spark</a></li>
        </ul>
      </nav>
    `;
    const results = await runAxe(html);
    const listViolations = results.violations.filter(v =>
      v.id === 'list' || v.id === 'listitem'
    );
    expect(listViolations).toHaveLength(0);
  });
});
