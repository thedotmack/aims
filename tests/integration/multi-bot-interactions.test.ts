import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createRequest, createAuthRequest } from '../helpers';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

const bots = {
  alpha: {
    id: 'bot-alpha', username: 'alpha-bot', display_name: 'Alpha Bot',
    avatar_url: '', status_message: '', is_online: false,
    api_key: 'aims_alpha_key_001', webhook_url: null,
    key_created_at: new Date(), ip_address: '127.0.0.1',
    created_at: new Date(), last_seen: new Date(), token_balance: 100,
  },
  beta: {
    id: 'bot-beta', username: 'beta-bot', display_name: 'Beta Bot',
    avatar_url: '', status_message: '', is_online: false,
    api_key: 'aims_beta_key_002', webhook_url: null,
    key_created_at: new Date(), ip_address: '127.0.0.2',
    created_at: new Date(), last_seen: new Date(), token_balance: 100,
  },
  gamma: {
    id: 'bot-gamma', username: 'gamma-bot', display_name: 'Gamma Bot',
    avatar_url: '', status_message: '', is_online: false,
    api_key: 'aims_gamma_key_003', webhook_url: null,
    key_created_at: new Date(), ip_address: '127.0.0.3',
    created_at: new Date(), last_seen: new Date(), token_balance: 100,
  },
};

function getBotByKey(key: string) {
  return Object.values(bots).find((b) => b.api_key === key) || null;
}

function getBotByUsername(username: string) {
  return Object.values(bots).find((b) => b.username === username) || null;
}

describe('Integration: Multi-Bot Interactions', () => {
  it('mutual follow: A follows B and B follows A', async () => {
    const subs: Set<string> = new Set();

    setAllQueriesHandler((query, values) => {
      if (query.includes('SELECT') && query.includes('bots')) {
        const keyVal = values.find((v) => typeof v === 'string' && (v as string).startsWith('aims_'));
        if (keyVal) return getBotByKey(keyVal as string) ? [getBotByKey(keyVal as string)] : [];
        const uVal = values.find((v) => typeof v === 'string' && (v as string).includes('-bot'));
        if (uVal) return getBotByUsername(uVal as string) ? [getBotByUsername(uVal as string)] : [];
        return [];
      }
      if (query.includes('INSERT INTO subscribers')) {
        const key = `${values[0]}→${values[1]}`;
        subs.add(key);
        return [];
      }
      if (query.includes('COUNT') && query.includes('subscribers')) {
        const target = values[0] as string;
        const count = Array.from(subs).filter((s) => s.endsWith(`→${target}`)).length;
        return [{ count }];
      }
      return [];
    });

    const { POST: subscribePOST } = await import('@/app/api/v1/bots/[username]/subscribe/route');

    // A follows B
    const res1 = await subscribePOST(
      createAuthRequest('/api/v1/bots/beta-bot/subscribe', bots.alpha.api_key, { method: 'POST' }),
      { params: Promise.resolve({ username: 'beta-bot' }) }
    );
    expect(res1.status).toBe(200);
    expect(subs.has('alpha-bot→beta-bot')).toBe(true);

    // B follows A
    const res2 = await subscribePOST(
      createAuthRequest('/api/v1/bots/alpha-bot/subscribe', bots.beta.api_key, { method: 'POST' }),
      { params: Promise.resolve({ username: 'alpha-bot' }) }
    );
    expect(res2.status).toBe(200);
    expect(subs.has('beta-bot→alpha-bot')).toBe(true);

    // Both have 1 follower each
    const { GET: subscribeGET } = await import('@/app/api/v1/bots/[username]/subscribe/route');
    const alphaFollowers = await subscribeGET(
      createRequest('/api/v1/bots/alpha-bot/subscribe'),
      { params: Promise.resolve({ username: 'alpha-bot' }) }
    );
    const alphaData = await alphaFollowers.json();
    expect(alphaData.followers).toBe(1);
  });

  it('bot cannot follow itself', async () => {
    setAllQueriesHandler((query, values) => {
      if (query.includes('SELECT') && query.includes('bots')) {
        const keyVal = values.find((v) => typeof v === 'string' && (v as string).startsWith('aims_'));
        if (keyVal) return getBotByKey(keyVal as string) ? [getBotByKey(keyVal as string)] : [];
        const uVal = values.find((v) => typeof v === 'string' && (v as string).includes('-bot'));
        if (uVal) return getBotByUsername(uVal as string) ? [getBotByUsername(uVal as string)] : [];
        return [];
      }
      return [];
    });

    const { POST: subscribePOST } = await import('@/app/api/v1/bots/[username]/subscribe/route');
    const res = await subscribePOST(
      createAuthRequest('/api/v1/bots/alpha-bot/subscribe', bots.alpha.api_key, { method: 'POST' }),
      { params: Promise.resolve({ username: 'alpha-bot' }) }
    );
    expect(res.status).toBe(400);
  });

  it('three bots post to feed, global feed shows all three', async () => {
    const feedItems: Array<Record<string, unknown>> = [];

    setAllQueriesHandler((query, values) => {
      if (query.includes('SELECT') && query.includes('bots')) {
        const keyVal = values.find((v) => typeof v === 'string' && (v as string).startsWith('aims_'));
        if (keyVal) return getBotByKey(keyVal as string) ? [getBotByKey(keyVal as string)] : [];
        const uVal = values.find((v) => typeof v === 'string' && (v as string).includes('-bot'));
        if (uVal) return getBotByUsername(uVal as string) ? [getBotByUsername(uVal as string)] : [];
        return [];
      }
      if (query.includes('UPDATE') && query.includes('token_balance')) return [{ token_balance: 99 }];
      if (query.includes('INSERT INTO feed_items')) {
        feedItems.push({
          id: `feed-${feedItems.length}`,
          bot_username: values[1] as string,
          feed_type: values[2] as string,
          title: '',
          content: values[4] as string,
          metadata: '{}',
          reply_to: null,
          chain_hash: null, chain_tx: null,
          source_type: 'api', content_hash: null,
          pinned: false, created_at: new Date(),
        });
        return [];
      }
      if (query.includes('SELECT') && query.includes('feed_items')) {
        if (query.includes('COUNT')) return [{ count: feedItems.length }];
        return feedItems;
      }
      if (query.includes('webhooks')) return [];
      return [];
    });

    const { POST: feedPOST } = await import('@/app/api/v1/bots/[username]/feed/route');

    for (const [name, b] of Object.entries(bots)) {
      const res = await feedPOST(
        createAuthRequest(`/api/v1/bots/${b.username}/feed`, b.api_key, {
          method: 'POST',
          body: { type: 'thought', content: `Hello from ${name}` },
        }),
        { params: Promise.resolve({ username: b.username }) }
      );
      expect(res.status).toBe(200);
    }

    // Global feed shows all 3
    const { GET: feedGET } = await import('@/app/api/v1/feed/route');
    const res = await feedGET(createRequest('/api/v1/feed'));
    const data = await res.json();
    expect(data.items.length).toBe(3);
  });

  it('bot cannot post to another bot feed', async () => {
    setAllQueriesHandler((query, values) => {
      if (query.includes('SELECT') && query.includes('bots')) {
        const keyVal = values.find((v) => typeof v === 'string' && (v as string).startsWith('aims_'));
        if (keyVal) return getBotByKey(keyVal as string) ? [getBotByKey(keyVal as string)] : [];
        return [];
      }
      return [];
    });

    const { POST: feedPOST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const res = await feedPOST(
      createAuthRequest('/api/v1/bots/beta-bot/feed', bots.alpha.api_key, {
        method: 'POST',
        body: { type: 'thought', content: 'Impersonation attempt' },
      }),
      { params: Promise.resolve({ username: 'beta-bot' }) }
    );
    expect(res.status).toBe(403);
  });

  it('DM between non-participant bot is rejected', async () => {
    const dm = {
      id: 'dm-ab', bot1_username: 'alpha-bot', bot1Username: 'alpha-bot',
      bot2_username: 'beta-bot', bot2Username: 'beta-bot',
      created_at: new Date(), last_activity: new Date(),
    };

    setAllQueriesHandler((query, values) => {
      if (query.includes('SELECT') && query.includes('bots')) {
        const keyVal = values.find((v) => typeof v === 'string' && (v as string).startsWith('aims_'));
        if (keyVal) return getBotByKey(keyVal as string) ? [getBotByKey(keyVal as string)] : [];
        const uVal = values.find((v) => typeof v === 'string' && (v as string).includes('-bot'));
        if (uVal) return getBotByUsername(uVal as string) ? [getBotByUsername(uVal as string)] : [];
        return [];
      }
      if (query.includes('SELECT') && query.includes('dms')) return [dm];
      return [];
    });

    const { POST: msgPOST } = await import('@/app/api/v1/dms/[roomId]/messages/route');
    // Gamma tries to send in alpha-beta DM
    const res = await msgPOST(
      createAuthRequest('/api/v1/dms/dm-ab/messages', bots.gamma.api_key, {
        method: 'POST',
        body: { from: 'gamma-bot', content: 'Intruder!' },
      }),
      { params: Promise.resolve({ roomId: 'dm-ab' }) }
    );
    expect(res.status).toBe(403);
  });
});
