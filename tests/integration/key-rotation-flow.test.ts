import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createRequest, createAuthRequest } from '../helpers';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

const ORIGINAL_KEY = 'aims_original_key_999';

const makeBot = (keyOverride?: string) => ({
  id: 'bot-rotate',
  username: 'rotate-bot',
  display_name: 'Rotate Bot',
  avatar_url: '',
  status_message: '',
  is_online: false,
  api_key: keyOverride || ORIGINAL_KEY,
  webhook_url: null,
  key_created_at: new Date(),
  ip_address: '127.0.0.1',
  created_at: new Date(),
  last_seen: new Date(),
  token_balance: 100,
});

describe('Integration: Key Rotation Flow', () => {
  it('register → use API key → rotate → old key fails → new key works', async () => {
    let registered = false;
    let currentKey = ORIGINAL_KEY;

    setAllQueriesHandler((query, values) => {
      if (query.includes('COUNT')) return [{ count: 0 }];
      if (query.includes('SELECT') && query.includes('bots') && !registered) return [];
      if (query.includes('INSERT INTO bots')) { registered = true; return []; }
      // After registration: check api_key match
      if (query.includes('SELECT') && query.includes('bots') && registered) {
        const keyVal = values.find((v) => typeof v === 'string' && (v as string).startsWith('aims_'));
        if (keyVal && keyVal !== currentKey) return []; // invalid key
        return [makeBot(currentKey)];
      }
      // Key rotation UPDATE
      if (query.includes('UPDATE') && query.includes('api_key')) {
        const newKey = values.find((v) => typeof v === 'string' && (v as string).startsWith('aims_'));
        if (newKey) currentKey = newKey as string;
        return [];
      }
      // Feed operations
      if (query.includes('UPDATE') && query.includes('token_balance')) return [{ token_balance: 99 }];
      if (query.includes('INSERT INTO feed_items')) return [];
      if (query.includes('SELECT') && query.includes('feed_items')) {
        return [{
          id: 'feed-001', bot_username: 'rotate-bot', feed_type: 'thought',
          title: '', content: 'test', metadata: '{}', reply_to: null,
          source_type: 'api', content_hash: null, chain_hash: null, chain_tx: null,
          is_pinned: false, created_at: new Date(),
        }];
      }
      if (query.includes('webhooks')) return [];
      return [];
    });

    // Step 1: Register
    const { POST: registerPOST } = await import('@/app/api/v1/bots/register/route');
    const regRes = await registerPOST(createRequest('/api/v1/bots/register', {
      method: 'POST',
      body: { username: 'rotate-bot', displayName: 'Rotate Bot' },
    }));
    expect(regRes.status).toBe(200);
    const regData = await regRes.json();
    expect(regData.success).toBe(true);

    // Step 2: Use the original key to post (should work)
    const { POST: feedPOST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const feedRes = await feedPOST(
      createAuthRequest('/api/v1/bots/rotate-bot/feed', ORIGINAL_KEY, {
        method: 'POST',
        body: { type: 'thought', content: 'Before rotation' },
      }),
      { params: Promise.resolve({ username: 'rotate-bot' }) }
    );
    expect(feedRes.status).toBe(200);

    // Step 3: Rotate the key
    const { POST: rotatePOST } = await import('@/app/api/v1/bots/[username]/rotate-key/route');
    const rotateRes = await rotatePOST(
      createAuthRequest('/api/v1/bots/rotate-bot/rotate-key', ORIGINAL_KEY, { method: 'POST' }),
      { params: Promise.resolve({ username: 'rotate-bot' }) }
    );
    const rotateData = await rotateRes.json();
    expect(rotateRes.status).toBe(200);
    expect(rotateData.success).toBe(true);
    expect(rotateData.api_key).toBeDefined();
    const newKey = rotateData.api_key;
    expect(newKey).not.toBe(ORIGINAL_KEY);

    // Step 4: Old key should fail (401)
    const oldKeyRes = await feedPOST(
      createAuthRequest('/api/v1/bots/rotate-bot/feed', ORIGINAL_KEY, {
        method: 'POST',
        body: { type: 'thought', content: 'With old key' },
      }),
      { params: Promise.resolve({ username: 'rotate-bot' }) }
    );
    expect(oldKeyRes.status).toBe(401);

    // Step 5: New key should work
    const newKeyRes = await feedPOST(
      createAuthRequest('/api/v1/bots/rotate-bot/feed', newKey, {
        method: 'POST',
        body: { type: 'thought', content: 'After rotation' },
      }),
      { params: Promise.resolve({ username: 'rotate-bot' }) }
    );
    expect(newKeyRes.status).toBe(200);
  });

  it('rotating key for another bot returns 403', async () => {
    const otherBot = {
      ...makeBot('aims_other_key_111'),
      username: 'other-bot',
    };

    setAllQueriesHandler((query, values) => {
      if (query.includes('SELECT') && query.includes('bots')) {
        const keyVal = values.find((v) => typeof v === 'string' && (v as string).startsWith('aims_'));
        if (keyVal === 'aims_other_key_111') return [otherBot];
        return [];
      }
      return [];
    });

    const { POST: rotatePOST } = await import('@/app/api/v1/bots/[username]/rotate-key/route');
    const res = await rotatePOST(
      createAuthRequest('/api/v1/bots/rotate-bot/rotate-key', 'aims_other_key_111', { method: 'POST' }),
      { params: Promise.resolve({ username: 'rotate-bot' }) }
    );
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('own key');
  });
});
