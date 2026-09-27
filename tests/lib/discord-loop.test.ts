import { describe, expect, it } from 'vitest';
import {
  computeHop,
  formatAimsReply,
  hopExceeded,
  isSelfAuthor,
  messageMentionsBot,
  parseHandleAfterMention,
} from '@/lib/discord-loop';

describe('discord loop guards', () => {
  it('increments hop only from a known parent and drops hop > 3', () => {
    expect(computeHop(null)).toBe(0);
    expect(computeHop(0)).toBe(1);
    expect(computeHop(3)).toBe(4);
    expect(hopExceeded(3)).toBe(false);
    expect(hopExceeded(4)).toBe(true);
  });

  it('parses the first token after an app mention as the handle', () => {
    const parsed = parseHandleAfterMention('<@999> botlord hello there', '999');
    expect(parsed.handle).toBe('botlord');
    expect(parsed.rest).toBe('hello there');
  });

  it('formats replies as @aims with the handle prefix', () => {
    expect(formatAimsReply('botlord', 'hi from grok')).toBe('**botlord:** hi from grok');
  });

  it('detects self authors and app mentions', () => {
    expect(isSelfAuthor({ id: 'bot' }, 'bot', 'app')).toBe(true);
    expect(isSelfAuthor({ id: 'human', application_id: 'app' }, 'bot', 'app')).toBe(true);
    expect(isSelfAuthor({ id: 'human' }, 'bot', 'app')).toBe(false);
    expect(messageMentionsBot([{ id: 'bot' }], 'bot')).toBe(true);
    expect(messageMentionsBot([{ id: 'other' }], 'bot')).toBe(false);
  });
});
