import { describe, it, expect } from 'vitest';
import { isValidFeedType, getValidFeedTypes, validateTextField, sanitizeText, MAX_LENGTHS } from '@/lib/validation';

describe('Feed validation — isValidFeedType', () => {
  it('accepts thought', () => expect(isValidFeedType('thought')).toBe(true));
  it('accepts observation', () => expect(isValidFeedType('observation')).toBe(true));
  it('accepts action', () => expect(isValidFeedType('action')).toBe(true));
  it('accepts summary', () => expect(isValidFeedType('summary')).toBe(true));
  it('rejects invalid type', () => expect(isValidFeedType('invalid')).toBe(false));
  it('rejects empty string', () => expect(isValidFeedType('')).toBe(false));
  it('rejects undefined', () => expect(isValidFeedType(undefined as any)).toBe(false));

  it('getValidFeedTypes includes all core types', () => {
    const types = getValidFeedTypes();
    expect(types).toContain('thought');
    expect(types).toContain('observation');
    expect(types).toContain('action');
    expect(types).toContain('summary');
    expect(types.length).toBeGreaterThanOrEqual(4);
  });
});

describe('Feed validation — validateTextField', () => {
  it('validates required content — empty fails', () => {
    const result = validateTextField('', 'content', MAX_LENGTHS.CONTENT);
    expect(result.valid).toBe(false);
  });

  it('validates required content — non-empty passes', () => {
    const result = validateTextField('Hello world', 'content', MAX_LENGTHS.CONTENT);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe('Hello world');
  });

  it('validates optional title — empty passes', () => {
    const result = validateTextField('', 'title', MAX_LENGTHS.TITLE, false);
    expect(result.valid).toBe(true);
  });

  it('validates optional title — non-empty passes', () => {
    const result = validateTextField('My Title', 'title', MAX_LENGTHS.TITLE, false);
    expect(result.valid).toBe(true);
  });

  it('rejects content exceeding max length', () => {
    const longContent = 'a'.repeat(MAX_LENGTHS.CONTENT + 1);
    const result = validateTextField(longContent, 'content', MAX_LENGTHS.CONTENT);
    expect(result.valid).toBe(false);
  });

  it('accepts content at exact max length', () => {
    const exactContent = 'a'.repeat(MAX_LENGTHS.CONTENT);
    const result = validateTextField(exactContent, 'content', MAX_LENGTHS.CONTENT);
    expect(result.valid).toBe(true);
  });

  it('handles null/undefined gracefully', () => {
    const result = validateTextField(null as any, 'content', MAX_LENGTHS.CONTENT);
    expect(result.valid).toBe(false);
  });
});

describe('Feed validation — sanitizeText', () => {
  it('strips HTML tags', () => {
    const result = sanitizeText('<script>alert("xss")</script>Hello');
    expect(result).not.toContain('<script>');
    expect(result).toContain('Hello');
  });

  it('strips null bytes', () => {
    const result = sanitizeText('Hello\x00World');
    expect(result).not.toContain('\x00');
  });

  it('preserves normal text', () => {
    expect(sanitizeText('Hello World')).toBe('Hello World');
  });

  it('handles empty string', () => {
    expect(sanitizeText('')).toBe('');
  });
});

describe('Feed validation — MAX_LENGTHS', () => {
  it('has content max length defined', () => {
    expect(MAX_LENGTHS.CONTENT).toBeGreaterThan(0);
  });

  it('has title max length defined', () => {
    expect(MAX_LENGTHS.TITLE).toBeGreaterThan(0);
  });

  it('content max is larger than title max', () => {
    expect(MAX_LENGTHS.CONTENT).toBeGreaterThan(MAX_LENGTHS.TITLE);
  });
});

describe('Feed type mapping from claude-mem', () => {
  it('maps all 13 source types correctly', async () => {
    const { mapClaudeMemType } = await import('@/lib/claude-mem');
    
    const mappings: Record<string, { feedType: string; hasTags: boolean }> = {
      'thought': { feedType: 'thought', hasTags: false },
      'observation': { feedType: 'observation', hasTags: false },
      'action': { feedType: 'action', hasTags: false },
      'summary': { feedType: 'summary', hasTags: false },
      'reflection': { feedType: 'thought', hasTags: true },
      'reasoning': { feedType: 'thought', hasTags: true },
      'session_summary': { feedType: 'summary', hasTags: true },
      'tool_use': { feedType: 'action', hasTags: true },
      'command': { feedType: 'action', hasTags: true },
      'decision': { feedType: 'thought', hasTags: true },
      'bugfix': { feedType: 'action', hasTags: true },
      'discovery': { feedType: 'observation', hasTags: true },
      'observe': { feedType: 'observation', hasTags: false },
    };

    for (const [source, expected] of Object.entries(mappings)) {
      const result = mapClaudeMemType(source);
      expect(result.feedType).toBe(expected.feedType);
      if (expected.hasTags) {
        expect(result.tags.length).toBeGreaterThan(0);
      }
    }
  });

  it('falls back to observation for unknown types', async () => {
    const { mapClaudeMemType } = await import('@/lib/claude-mem');
    const result = mapClaudeMemType('unknown_type');
    expect(result.feedType).toBe('observation');
  });
});
