import { describe, it, expect } from 'vitest';
import { mapClaudeMemType, enrichObservation, contentHash } from '@/lib/claude-mem';

describe('claude-mem type mapping', () => {
  it('maps thought to thought', () => {
    expect(mapClaudeMemType('thought')).toEqual({ feedType: 'thought', tags: [] });
  });

  it('maps observation to observation', () => {
    expect(mapClaudeMemType('observation')).toEqual({ feedType: 'observation', tags: [] });
  });

  it('maps action to action', () => {
    expect(mapClaudeMemType('action')).toEqual({ feedType: 'action', tags: [] });
  });

  it('maps decision to thought with decision tag', () => {
    expect(mapClaudeMemType('decision')).toEqual({ feedType: 'thought', tags: ['decision'] });
  });

  it('maps bugfix to action with bugfix tag', () => {
    expect(mapClaudeMemType('bugfix')).toEqual({ feedType: 'action', tags: ['bugfix'] });
  });

  it('maps summary to summary', () => {
    expect(mapClaudeMemType('summary')).toEqual({ feedType: 'summary', tags: [] });
  });

  it('maps session_summary to summary with session tag', () => {
    expect(mapClaudeMemType('session_summary')).toEqual({ feedType: 'summary', tags: ['session'] });
  });

  it('maps observe to observation', () => {
    expect(mapClaudeMemType('observe')).toEqual({ feedType: 'observation', tags: [] });
  });

  it('maps reflection to thought with reflection tag', () => {
    expect(mapClaudeMemType('reflection')).toEqual({ feedType: 'thought', tags: ['reflection'] });
  });

  it('maps reasoning to thought with reasoning tag', () => {
    expect(mapClaudeMemType('reasoning')).toEqual({ feedType: 'thought', tags: ['reasoning'] });
  });

  it('maps tool_use to action with tool_use tag', () => {
    expect(mapClaudeMemType('tool_use')).toEqual({ feedType: 'action', tags: ['tool_use'] });
  });

  it('maps command to action with command tag', () => {
    expect(mapClaudeMemType('command')).toEqual({ feedType: 'action', tags: ['command'] });
  });

  it('defaults unknown types to observation', () => {
    expect(mapClaudeMemType('unknown')).toEqual({ feedType: 'observation', tags: [] });
  });

  it('defaults null/undefined to observation', () => {
    expect(mapClaudeMemType(null)).toEqual({ feedType: 'observation', tags: [] });
    expect(mapClaudeMemType(undefined)).toEqual({ feedType: 'observation', tags: [] });
  });

  it('is case insensitive', () => {
    expect(mapClaudeMemType('THOUGHT')).toEqual({ feedType: 'thought', tags: [] });
  });
});

describe('enrichObservation', () => {
  it('extracts file paths', () => {
    const result = enrichObservation('Edited src/lib/db.ts and tests/api/feed.test.ts');
    expect(result.filePaths).toContain('src/lib/db.ts');
    expect(result.filePaths).toContain('tests/api/feed.test.ts');
  });

  it('detects code language from file extensions', () => {
    const result = enrichObservation('Working on src/app.tsx');
    expect(result.codeLanguage).toBe('TypeScript');
  });

  it('detects language from code blocks', () => {
    const result = enrichObservation('```python\nprint("hello")\n```');
    expect(result.codeLanguage).toBe('Python');
  });

  it('calculates complexity based on word count', () => {
    expect(enrichObservation('short').complexity).toBe('simple');
    expect(enrichObservation('a '.repeat(100)).complexity).toBe('moderate');
    expect(enrichObservation('a '.repeat(300)).complexity).toBe('complex');
  });

  it('detects positive sentiment', () => {
    expect(enrichObservation('Everything is working great and improved').sentiment).toBe('positive');
  });

  it('detects negative sentiment', () => {
    expect(enrichObservation('Found a critical error in production').sentiment).toBe('negative');
  });

  it('defaults to neutral sentiment', () => {
    expect(enrichObservation('Reviewed the code').sentiment).toBe('neutral');
  });
});

describe('contentHash', () => {
  it('produces deterministic hashes', () => {
    const h1 = contentHash('test content', 'bot1');
    const h2 = contentHash('test content', 'bot1');
    expect(h1).toBe(h2);
  });

  it('produces different hashes for different content', () => {
    const h1 = contentHash('content A', 'bot1');
    const h2 = contentHash('content B', 'bot1');
    expect(h1).not.toBe(h2);
  });

  it('produces different hashes for different bots', () => {
    const h1 = contentHash('same content', 'bot1');
    const h2 = contentHash('same content', 'bot2');
    expect(h1).not.toBe(h2);
  });

  it('starts with ch_ prefix', () => {
    expect(contentHash('test', 'bot')).toMatch(/^ch_/);
  });
});
