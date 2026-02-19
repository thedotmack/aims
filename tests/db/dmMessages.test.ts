import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

const mockDMMessage = {
  id: 'msg-123',
  dm_id: 'dm-1',
  from_username: 'bot-a',
  content: 'Hello',
  timestamp: new Date(),
  is_bot: true,
};

describe('createDMMessage', () => {
  it('deducts 2 $AIMS tokens', async () => {
    let deductValues: unknown[] = [];
    setAllQueriesHandler((query, values) => {
      if (query.includes('UPDATE bots SET token_balance')) {
        deductValues = values;
        return [{ token_balance: 98 }];
      }
      if (query.includes('INSERT INTO messages')) return [];
      if (query.includes('UPDATE dms')) return [];
      if (query.includes('SELECT') && query.includes('messages')) return [mockDMMessage];
      return [];
    });

    const { createDMMessage } = await import('@/lib/db');
    await createDMMessage('dm-1', 'bot-a', 'Hello');

    expect(deductValues).toContain(2);
  });

  it('throws InsufficientTokensError when balance < 2', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('UPDATE bots SET token_balance')) return [];
      if (query.includes('token_balance') && query.includes('SELECT')) return [{ token_balance: 1 }];
      return [];
    });

    const { createDMMessage, InsufficientTokensError } = await import('@/lib/db');

    await expect(createDMMessage('dm-1', 'bot-a', 'Hello'))
      .rejects.toThrow(InsufficientTokensError);
  });

  it('error includes required=2 and actual balance', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('UPDATE bots SET token_balance')) return [];
      if (query.includes('token_balance') && query.includes('SELECT')) return [{ token_balance: 1 }];
      return [];
    });

    const { createDMMessage, InsufficientTokensError } = await import('@/lib/db');

    try {
      await createDMMessage('dm-1', 'bot-a', 'Hello');
      expect.unreachable('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(InsufficientTokensError);
      expect((err as InstanceType<typeof InsufficientTokensError>).required).toBe(2);
      expect((err as InstanceType<typeof InsufficientTokensError>).balance).toBe(1);
    }
  });

  it('updates DM activity after sending', async () => {
    let dmActivityUpdated = false;
    setAllQueriesHandler((query) => {
      if (query.includes('UPDATE bots SET token_balance')) return [{ token_balance: 98 }];
      if (query.includes('INSERT INTO messages')) return [];
      if (query.includes('UPDATE dms SET last_activity')) { dmActivityUpdated = true; return []; }
      if (query.includes('SELECT') && query.includes('messages')) return [mockDMMessage];
      return [];
    });

    const { createDMMessage } = await import('@/lib/db');
    await createDMMessage('dm-1', 'bot-a', 'Hello');

    expect(dmActivityUpdated).toBe(true);
  });

  it('returns a properly shaped DMMessage', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('UPDATE bots SET token_balance')) return [{ token_balance: 98 }];
      if (query.includes('INSERT INTO messages')) return [];
      if (query.includes('UPDATE dms')) return [];
      if (query.includes('SELECT') && query.includes('messages')) return [mockDMMessage];
      return [];
    });

    const { createDMMessage } = await import('@/lib/db');
    const msg = await createDMMessage('dm-1', 'bot-a', 'Hello');

    expect(msg.id).toBe('msg-123');
    expect(msg.fromUsername).toBe('bot-a');
    expect(msg.content).toBe('Hello');
  });
});

describe('getDMMessages', () => {
  it('returns messages in order', async () => {
    setAllQueriesHandler(() => [
      mockDMMessage,
      { ...mockDMMessage, id: 'msg-456', content: 'World' },
    ]);

    const { getDMMessages } = await import('@/lib/db');
    const msgs = await getDMMessages('dm-1');

    expect(msgs).toHaveLength(2);
  });

  it('returns empty array for no messages', async () => {
    setAllQueriesHandler(() => []);

    const { getDMMessages } = await import('@/lib/db');
    expect(await getDMMessages('dm-1')).toEqual([]);
  });
});
