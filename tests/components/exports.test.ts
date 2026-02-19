import { describe, it, expect } from 'vitest';

describe('Component Exports — AimFeedWall', () => {
  it('exports default function', async () => {
    const mod = await import('@/components/ui/AimFeedWall');
    expect(typeof mod.default).toBe('function');
    expect(mod.default.name).toBe('AimFeedWall');
  });
});

describe('Component Exports — AimBuddyList', () => {
  it('exports default function and BuddyBot type interface', async () => {
    const mod = await import('@/components/ui/AimBuddyList');
    expect(typeof mod.default).toBe('function');
    expect(mod.default.name).toBe('AimBuddyList');
  });
});

describe('Component Exports — AimFeedItem', () => {
  it('exports default', async () => {
    const mod = await import('@/components/ui/AimFeedItem');
    expect(mod.default).toBeDefined();
  });
});

describe('Component Exports — AimMessage', () => {
  it('exports default', async () => {
    const mod = await import('@/components/ui/AimMessage');
    expect(mod.default).toBeDefined();
  });
});

describe('Component Exports — BotAvatar', () => {
  it('exports default', async () => {
    const mod = await import('@/components/ui/BotAvatar');
    expect(mod.default).toBeDefined();
  });
});

describe('Component Exports — UI barrel exports', () => {
  it('re-exports key components from index', async () => {
    const mod = await import('@/components/ui');
    expect(mod).toHaveProperty('AimBuddyList');
    expect(mod).toHaveProperty('AimFeedWall');
  });
});

describe('Component Exports — HomeClient', () => {
  it('exports default function', async () => {
    const mod = await import('@/app/HomeClient');
    expect(typeof mod.default).toBe('function');
    expect(mod.default.name).toBe('HomeClient');
  });
});

describe('Library Exports — badges', () => {
  it('exports computeBadges function', async () => {
    const mod = await import('@/lib/badges');
    expect(typeof mod.computeBadges).toBe('function');
  });
});

describe('Library Exports — personality', () => {
  it('exports personality analysis function', async () => {
    const mod = await import('@/lib/personality');
    expect(mod).toBeDefined();
    // Check it has at least one exported function
    const fns = Object.values(mod).filter(v => typeof v === 'function');
    expect(fns.length).toBeGreaterThan(0);
  });
});

describe('Library Exports — transparency', () => {
  it('exports transparency scoring', async () => {
    const mod = await import('@/lib/transparency');
    expect(mod).toBeDefined();
    const fns = Object.values(mod).filter(v => typeof v === 'function');
    expect(fns.length).toBeGreaterThan(0);
  });
});

describe('Library Exports — validation', () => {
  it('exports validateTextField and MAX_LENGTHS', async () => {
    const mod = await import('@/lib/validation');
    expect(typeof mod.validateTextField).toBe('function');
    expect(mod.MAX_LENGTHS).toBeDefined();
    expect(typeof mod.MAX_LENGTHS.DISPLAY_NAME).toBe('number');
  });
});

describe('Library Exports — auth', () => {
  it('exports auth functions', async () => {
    const mod = await import('@/lib/auth');
    expect(typeof mod.validateBotUsername).toBe('function');
    expect(typeof mod.validateAdminKey).toBe('function');
  });
});

describe('Library Exports — errors', () => {
  it('exports error handler', async () => {
    const mod = await import('@/lib/errors');
    expect(typeof mod.handleApiError).toBe('function');
  });
});
