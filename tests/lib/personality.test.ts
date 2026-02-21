import { describe, it, expect } from 'vitest';
import { computePersonality } from '@/lib/personality';
import type { FeedItem } from '@/lib/db';

function makeFeedItem(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: 'fi_test',
    botUsername: 'test-bot',
    feedType: 'thought',
    title: '',
    content: 'test content',
    metadata: null,
    createdAt: new Date().toISOString(),
    replyTo: null,
    chainHash: null,
    chainTx: null,
    sourceType: null,
    contentHash: null,
    ...overrides,
  } as FeedItem;
}

describe('computePersonality', () => {
  it('returns empty traits for no feed items', () => {
    const result = computePersonality([]);
    expect(result.traits).toEqual([]);
    expect(result.dominantType).toBe('unknown');
    expect(result.summary).toContain('Not enough data');
  });

  it('identifies dominant type from feed items', () => {
    const items = Array.from({ length: 10 }, () => makeFeedItem({ feedType: 'action', content: 'deployed the new build' }));
    const result = computePersonality(items);
    expect(result.dominantType).toBe('action');
  });

  it('boosts analytical trait for thought-heavy feeds', () => {
    const items = Array.from({ length: 10 }, () =>
      makeFeedItem({ feedType: 'thought', content: 'analyze the data patterns and evaluate metrics' })
    );
    const result = computePersonality(items);
    const analytical = result.traits.find(t => t.name === 'Analytical');
    expect(analytical).toBeDefined();
    expect(analytical!.strength).toBeGreaterThan(0);
  });

  it('boosts decisive trait for action-heavy feeds', () => {
    const items = Array.from({ length: 10 }, () =>
      makeFeedItem({ feedType: 'action', content: 'deploy and ship the build to production, execute the plan' })
    );
    const result = computePersonality(items);
    const decisive = result.traits.find(t => t.name === 'Decisive');
    expect(decisive).toBeDefined();
  });

  it('boosts curious trait for observation-heavy feeds', () => {
    const items = Array.from({ length: 10 }, () =>
      makeFeedItem({ feedType: 'observation', content: 'explore and discover new research findings, investigate patterns' })
    );
    const result = computePersonality(items);
    const curious = result.traits.find(t => t.name === 'Curious');
    expect(curious).toBeDefined();
  });

  it('returns at most 4 traits', () => {
    const items = Array.from({ length: 50 }, (_, i) =>
      makeFeedItem({ content: 'analyze create system explore collaborate decide plan design data test' })
    );
    const result = computePersonality(items);
    expect(result.traits.length).toBeLessThanOrEqual(4);
  });

  it('traits have strength between 0 and 100', () => {
    const items = Array.from({ length: 20 }, () =>
      makeFeedItem({ content: 'analyze data patterns and evaluate metrics systematically' })
    );
    const result = computePersonality(items);
    for (const trait of result.traits) {
      expect(trait.strength).toBeGreaterThanOrEqual(0);
      expect(trait.strength).toBeLessThanOrEqual(100);
    }
  });

  it('generates a summary string', () => {
    const items = Array.from({ length: 5 }, () => makeFeedItem({ feedType: 'thought', content: 'analyze data' }));
    const result = computePersonality(items);
    expect(typeof result.summary).toBe('string');
    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.summary).toContain('reflective');
  });

  it('trait objects have required fields', () => {
    const items = Array.from({ length: 10 }, () =>
      makeFeedItem({ content: 'analyze and explore data patterns to discover insights' })
    );
    const result = computePersonality(items);
    expect(result.traits.length).toBeGreaterThan(0);
    for (const trait of result.traits) {
      expect(trait).toHaveProperty('name');
      expect(trait).toHaveProperty('icon');
      expect(trait).toHaveProperty('color');
      expect(trait).toHaveProperty('strength');
    }
  });
});
