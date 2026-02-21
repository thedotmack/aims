import { describe, it, expect } from 'vitest';
import { computeBadges, type BadgeContext } from '@/lib/badges';

function makeCtx(overrides: Partial<BadgeContext> = {}): BadgeContext {
  return {
    botCreatedAt: new Date().toISOString(),
    feedStats: {},
    followerCount: 0,
    botRank: 0,
    totalBots: 100,
    botPosition: 50,
    ...overrides,
  };
}

describe('computeBadges', () => {
  it('returns empty array for new bot with no activity', () => {
    const badges = computeBadges(makeCtx());
    expect(badges).toEqual([]);
  });

  it('awards early-adopter for botPosition <= 10', () => {
    const badges = computeBadges(makeCtx({ botPosition: 5 }));
    expect(badges.some(b => b.id === 'early-adopter')).toBe(true);
  });

  it('does NOT award early-adopter for botPosition > 10', () => {
    const badges = computeBadges(makeCtx({ botPosition: 11 }));
    expect(badges.some(b => b.id === 'early-adopter')).toBe(false);
  });

  it('awards deep-thinker for 100+ thoughts', () => {
    const badges = computeBadges(makeCtx({ feedStats: { thought: 100 } }));
    expect(badges.some(b => b.id === 'deep-thinker')).toBe(true);
  });

  it('awards eagle-eye for 100+ observations', () => {
    const badges = computeBadges(makeCtx({ feedStats: { observation: 100 } }));
    expect(badges.some(b => b.id === 'eagle-eye')).toBe(true);
  });

  it('awards power-user for 500+ total broadcasts', () => {
    const badges = computeBadges(makeCtx({ feedStats: { thought: 300, action: 200 } }));
    expect(badges.some(b => b.id === 'power-user')).toBe(true);
  });

  it('does NOT award power-user for 499 broadcasts', () => {
    const badges = computeBadges(makeCtx({ feedStats: { thought: 250, action: 249 } }));
    expect(badges.some(b => b.id === 'power-user')).toBe(false);
  });

  it('awards social-butterfly for 10+ followers', () => {
    const badges = computeBadges(makeCtx({ followerCount: 10 }));
    expect(badges.some(b => b.id === 'social-butterfly')).toBe(true);
  });

  it('awards top-bot for rank 1', () => {
    const badges = computeBadges(makeCtx({ botRank: 1 }));
    expect(badges.some(b => b.id === 'top-bot')).toBe(true);
  });

  it('does NOT award top-bot for rank 2', () => {
    const badges = computeBadges(makeCtx({ botRank: 2 }));
    expect(badges.some(b => b.id === 'top-bot')).toBe(false);
  });

  it('can award multiple badges simultaneously', () => {
    const badges = computeBadges(makeCtx({
      botPosition: 1,
      feedStats: { thought: 200, observation: 150, action: 200 },
      followerCount: 25,
      botRank: 1,
    }));
    expect(badges.length).toBeGreaterThanOrEqual(5);
    const ids = badges.map(b => b.id);
    expect(ids).toContain('early-adopter');
    expect(ids).toContain('deep-thinker');
    expect(ids).toContain('eagle-eye');
    expect(ids).toContain('power-user');
    expect(ids).toContain('social-butterfly');
    expect(ids).toContain('top-bot');
  });

  it('badge objects have required fields', () => {
    const badges = computeBadges(makeCtx({ botPosition: 1 }));
    expect(badges[0]).toHaveProperty('id');
    expect(badges[0]).toHaveProperty('icon');
    expect(badges[0]).toHaveProperty('name');
    expect(badges[0]).toHaveProperty('description');
  });
});
