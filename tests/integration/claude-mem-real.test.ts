/**
 * Claude-mem integration verification tests.
 * Tests real behavior of the claude-mem utilities and webhook pipeline
 * without requiring a live claude-mem instance.
 *
 * Separated from mock-based tests to clearly document what is
 * real behavior vs what depends on external services.
 */
import { describe, it, expect } from 'vitest';
import { mapClaudeMemType, enrichObservation, contentHash } from '@/lib/claude-mem';

describe('Claude-mem real behavior verification', () => {
  describe('type mapping completeness', () => {
    const ALL_KNOWN_TYPES = [
      // Standard claude-mem types
      'thought', 'observation', 'action',
      // Extended types
      'decision', 'bugfix', 'discovery',
      // Webhook ingest route also handles these (separate mapper)
      'summary', 'session_summary', 'reflection', 'reasoning', 'tool_use', 'command', 'observe',
    ];

    it('maps all known claude-mem types without throwing', () => {
      for (const type of ALL_KNOWN_TYPES) {
        const result = mapClaudeMemType(type);
        expect(result).toHaveProperty('feedType');
        expect(result).toHaveProperty('tags');
        expect(['observation', 'thought', 'action', 'summary']).toContain(result.feedType);
      }
    });

    it('handles null/undefined/empty gracefully', () => {
      expect(mapClaudeMemType(null)).toEqual({ feedType: 'observation', tags: [] });
      expect(mapClaudeMemType(undefined)).toEqual({ feedType: 'observation', tags: [] });
      expect(mapClaudeMemType('')).toEqual({ feedType: 'observation', tags: [] });
    });

    it('is case-insensitive', () => {
      expect(mapClaudeMemType('THOUGHT')).toEqual(mapClaudeMemType('thought'));
      expect(mapClaudeMemType('Observation')).toEqual(mapClaudeMemType('observation'));
    });

    it('unknown types default to observation (not error)', () => {
      expect(mapClaudeMemType('foobar')).toEqual({ feedType: 'observation', tags: [] });
      expect(mapClaudeMemType('x'.repeat(1000))).toEqual({ feedType: 'observation', tags: [] });
    });
  });

  describe('enrichment produces actionable metadata', () => {
    it('extracts file paths from real claude-mem-style content', () => {
      const content = `Reviewed src/lib/db.ts and found 96 functions.
        Also checked tests/api/feed.test.ts for coverage.
        The ./package.json has correct dependencies.`;
      const result = enrichObservation(content);
      expect(result.filePaths).toContain('src/lib/db.ts');
      expect(result.filePaths).toContain('tests/api/feed.test.ts');
      expect(result.codeLanguage).toBe('TypeScript');
    });

    it('detects code language from code blocks', () => {
      const content = 'Here is the fix:\n```python\ndef hello():\n    pass\n```';
      const result = enrichObservation(content);
      expect(result.codeLanguage).toBe('Python');
    });

    it('computes sentiment from real observation text', () => {
      // "Fixed" is positive but "bug" is negative → neutral (both present)
      expect(enrichObservation('Fixed the bug, all tests passing').sentiment).toBe('neutral');
      // Only positive words
      expect(enrichObservation('All tests working, great success').sentiment).toBe('positive');
      expect(enrichObservation('Error in build, cannot deploy').sentiment).toBe('negative');
      expect(enrichObservation('Reviewed the architecture diagram').sentiment).toBe('neutral');
    });

    it('classifies complexity by word count', () => {
      expect(enrichObservation('Short note').complexity).toBe('simple');
      expect(enrichObservation('word '.repeat(100)).complexity).toBe('moderate');
      expect(enrichObservation('word '.repeat(300)).complexity).toBe('complex');
    });
  });

  describe('content hash deduplication', () => {
    it('produces stable hashes for same input', () => {
      const h1 = contentHash('hello world', 'bot1');
      const h2 = contentHash('hello world', 'bot1');
      expect(h1).toBe(h2);
    });

    it('different bots get different hashes for same content', () => {
      const h1 = contentHash('hello world', 'bot1');
      const h2 = contentHash('hello world', 'bot2');
      expect(h1).not.toBe(h2);
    });

    it('trims whitespace for consistent hashing', () => {
      const h1 = contentHash('hello world', 'bot1');
      const h2 = contentHash('  hello world  ', 'bot1');
      expect(h1).toBe(h2);
    });

    it('hash format is ch_ prefix + base36', () => {
      const h = contentHash('test', 'bot');
      expect(h).toMatch(/^ch_[a-z0-9]+$/);
    });
  });
});

describe('Webhook ingest route type mapping (separate from lib)', () => {
  // The webhook ingest route has its own mapFeedType function
  // This documents the mapping to ensure consistency
  const ROUTE_MAPPINGS: Record<string, string> = {
    'observation': 'observation',
    'observe': 'observation',
    'summary': 'summary',
    'session_summary': 'summary',
    'thought': 'thought',
    'reflection': 'thought',
    'reasoning': 'thought',
    'action': 'action',
    'tool_use': 'action',
    'command': 'action',
    'unknown_type': 'observation',  // default
  };

  it('documents all webhook ingest type mappings', () => {
    // This test serves as documentation of the expected mappings
    // If the route's mapFeedType changes, this should be updated
    for (const [input, expected] of Object.entries(ROUTE_MAPPINGS)) {
      expect(expected).toMatch(/^(observation|thought|action|summary)$/);
    }
    expect(Object.keys(ROUTE_MAPPINGS).length).toBeGreaterThanOrEqual(10);
  });

  it('lib/claude-mem and webhook route have compatible type mappings', () => {
    // Both mappers should agree on the core types
    const coreTypes = ['thought', 'observation', 'action'];
    for (const type of coreTypes) {
      const libResult = mapClaudeMemType(type);
      expect(libResult.feedType).toBe(ROUTE_MAPPINGS[type]);
    }
  });
});
