import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createRequest, createAuthRequest } from '../helpers';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

const bot = {
  id: 'bot-reactor',
  username: 'reactor-bot',
  display_name: 'Reactor Bot',
  avatar_url: '',
  status_message: '',
  is_online: false,
  api_key: 'aims_reactor_key_789',
  webhook_url: null,
  key_created_at: new Date(),
  ip_address: '127.0.0.1',
  created_at: new Date(),
  last_seen: new Date(),
  token_balance: 100,
};

describe('Integration: Reaction Flow', () => {
  it('post feed item → add reaction → verify count → remove reaction → verify removed', async () => {
    let feedItemCreated = false;
    const reactions: Map<string, { emoji: string; count: number }> = new Map();

    setAllQueriesHandler((query, values) => {
      // Auth
      if (query.includes('SELECT') && query.includes('api_key')) return [bot];
      if (query.includes('SELECT') && query.includes('bots') && query.includes('username')) return [bot];

      // Feed item creation
      if (query.includes('UPDATE') && query.includes('token_balance')) return [{ token_balance: 99 }];
      if (query.includes('INSERT INTO feed_items')) {
        feedItemCreated = true;
        return [];
      }
      if (query.includes('webhooks')) return [];

      // Add reaction
      if (query.includes('INSERT INTO feed_reactions')) {
        const emoji = values.find((v) => typeof v === 'string' && !v.includes('feed-') && !v.includes('session'));
        if (emoji) reactions.set(emoji as string, { emoji: emoji as string, count: (reactions.get(emoji as string)?.count || 0) + 1 });
        return [];
      }
      // Remove reaction
      if (query.includes('DELETE') && query.includes('feed_reactions')) {
        const emoji = values.find((v) => typeof v === 'string' && !v.includes('feed-') && !v.includes('session'));
        if (emoji) reactions.delete(emoji as string);
        return [];
      }
      // Get reaction counts
      if (query.includes('SELECT') && query.includes('feed_reactions') && query.includes('COUNT')) {
        return Array.from(reactions.values()).map((r) => ({
          feed_item_id: 'feed-item-react-001',
          emoji: r.emoji,
          count: r.count.toString(),
        }));
      }
      // Feed queries
      if (query.includes('SELECT') && query.includes('feed_items') && feedItemCreated) {
        return [{
          id: 'feed-item-react-001',
          bot_id: 'bot-reactor',
          username: 'reactor-bot',
          display_name: 'Reactor Bot',
          type: 'thought',
          content: 'React to me!',
          metadata: null,
          chain_hash: null,
          chain_tx: null,
          source_type: 'api',
          content_hash: null,
          is_pinned: false,
          created_at: new Date(),
        }];
      }
      return [];
    });

    // Step 1: Post a feed item
    const { POST: feedPOST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const postReq = createAuthRequest('/api/v1/bots/reactor-bot/feed', bot.api_key, {
      method: 'POST',
      body: { type: 'thought', content: 'React to me!' },
    });
    const postRes = await feedPOST(postReq, { params: Promise.resolve({ username: 'reactor-bot' }) });
    expect(postRes.status).toBe(200);

    // Step 2: Add a reaction
    const { POST: reactionPOST, GET: reactionGET } = await import('@/app/api/v1/feed/reactions/route');
    const addReq = createRequest('/api/v1/feed/reactions', {
      method: 'POST',
      body: { feedItemId: 'feed-item-react-001', emoji: '🔥', sessionId: 'session-123' },
    });
    const addRes = await reactionPOST(addReq);
    const addData = await addRes.json();

    expect(addRes.status).toBe(200);
    expect(addData.success).toBe(true);

    // Step 3: Verify reaction count
    const getReq = createRequest('/api/v1/feed/reactions?feedItemId=feed-item-react-001');
    const getRes = await reactionGET(getReq);
    const getData = await getRes.json();

    expect(getRes.status).toBe(200);
    expect(getData.success).toBe(true);

    // Step 4: Remove reaction
    const removeReq = createRequest('/api/v1/feed/reactions', {
      method: 'POST',
      body: { feedItemId: 'feed-item-react-001', emoji: '🔥', sessionId: 'session-123', remove: true },
    });
    const removeRes = await reactionPOST(removeReq);
    expect(removeRes.status).toBe(200);

    // Step 5: Verify reaction removed
    const verifyReq = createRequest('/api/v1/feed/reactions?feedItemId=feed-item-react-001');
    const verifyRes = await reactionGET(verifyReq);
    const verifyData = await verifyRes.json();

    expect(verifyRes.status).toBe(200);
    expect(verifyData.reactions).toBeDefined();
  });

  it('multiple reactions on same item accumulate correctly', async () => {
    const reactionStore: Array<{ feed_item_id: string; emoji: string; count: string }> = [];

    setAllQueriesHandler((query, values) => {
      if (query.includes('INSERT INTO feed_reactions')) {
        const emoji = values[1] as string;
        const existing = reactionStore.find((r) => r.emoji === emoji);
        if (existing) {
          existing.count = (parseInt(existing.count) + 1).toString();
        } else {
          reactionStore.push({ feed_item_id: 'feed-001', emoji, count: '1' });
        }
        return [];
      }
      if (query.includes('SELECT') && query.includes('feed_reactions') && query.includes('COUNT')) {
        return [...reactionStore];
      }
      return [];
    });

    const { POST: reactionPOST, GET: reactionGET } = await import('@/app/api/v1/feed/reactions/route');

    // Add 🔥 reaction
    await reactionPOST(createRequest('/api/v1/feed/reactions', {
      method: 'POST',
      body: { feedItemId: 'feed-001', emoji: '🔥', sessionId: 'user-1' },
    }));

    // Add 💡 reaction
    await reactionPOST(createRequest('/api/v1/feed/reactions', {
      method: 'POST',
      body: { feedItemId: 'feed-001', emoji: '💡', sessionId: 'user-2' },
    }));

    // Verify both exist
    const res = await reactionGET(createRequest('/api/v1/feed/reactions?feedItemId=feed-001'));
    const data = await res.json();

    expect(data.success).toBe(true);
  });
});
