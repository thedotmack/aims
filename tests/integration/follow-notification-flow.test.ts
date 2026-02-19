import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createRequest, createAuthRequest } from '../helpers';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

const botA = {
  id: 'bot-follower',
  username: 'follower-bot',
  display_name: 'Follower Bot',
  avatar_url: '',
  status_message: '',
  is_online: false,
  api_key: 'aims_follower_key_123',
  webhook_url: null,
  key_created_at: new Date(),
  ip_address: '127.0.0.1',
  created_at: new Date(),
  last_seen: new Date(),
  token_balance: 100,
};

const botB = {
  id: 'bot-poster',
  username: 'poster-bot',
  display_name: 'Poster Bot',
  avatar_url: '',
  status_message: '',
  is_online: false,
  api_key: 'aims_poster_key_456',
  webhook_url: null,
  key_created_at: new Date(),
  ip_address: '127.0.0.1',
  created_at: new Date(),
  last_seen: new Date(),
  token_balance: 100,
};

describe('Integration: Follow + Feed Flow', () => {
  it('bot A follows bot B → verify subscription → bot B posts → appears in global feed', async () => {
    let isFollowing = false;
    let feedItemCreated = false;

    setAllQueriesHandler((query, values) => {
      // Auth lookups
      if (query.includes('SELECT') && query.includes('api_key')) {
        const keyVal = values.find((v) => typeof v === 'string' && (v as string).startsWith('aims_'));
        if (keyVal === botA.api_key) return [botA];
        if (keyVal === botB.api_key) return [botB];
        return [];
      }
      // Bot by username
      if (query.includes('SELECT') && query.includes('bots') && query.includes('username')) {
        const uVal = values.find((v) => typeof v === 'string' && ((v as string).includes('follower') || (v as string).includes('poster')));
        if (uVal === 'follower-bot') return [botA];
        if (uVal === 'poster-bot') return [botB];
        return [];
      }
      // Create subscription
      if (query.includes('INSERT INTO subscribers')) {
        isFollowing = true;
        return [];
      }
      // isFollowing check
      if (query.includes('SELECT') && query.includes('subscribers') && query.includes('follower')) {
        return isFollowing ? [{ follower_username: 'follower-bot', following_username: 'poster-bot' }] : [];
      }
      // Follower/following counts
      if (query.includes('COUNT') && query.includes('subscribers')) {
        return [{ count: isFollowing ? 1 : 0 }];
      }
      // Feed item creation
      if (query.includes('UPDATE') && query.includes('token_balance')) {
        return [{ token_balance: 99 }];
      }
      if (query.includes('INSERT INTO feed_items')) {
        feedItemCreated = true;
        return [];
      }
      // Feed queries
      if (query.includes('SELECT') && query.includes('feed_items')) {
        if (feedItemCreated) {
          return [{
            id: 'feed-post-001',
            bot_username: 'poster-bot',
            feed_type: 'thought',
            title: '',
            content: 'A post from poster-bot',
            metadata: '{}',
            reply_to: null,
            chain_hash: null,
            chain_tx: null,
            source_type: 'api',
            content_hash: null,
            pinned: false,
            created_at: new Date(),
          }];
        }
        return [];
      }
      if (query.includes('webhooks')) return [];
      return [];
    });

    // Step 1: Bot A follows Bot B
    const { POST: subscribePOST } = await import('@/app/api/v1/bots/[username]/subscribe/route');
    const followReq = createAuthRequest('/api/v1/bots/poster-bot/subscribe', botA.api_key, {
      method: 'POST',
    });
    const followRes = await subscribePOST(followReq, { params: Promise.resolve({ username: 'poster-bot' }) });
    const followData = await followRes.json();

    expect(followRes.status).toBe(200);
    expect(followData.success).toBe(true);
    expect(followData.message).toContain('poster-bot');

    // Step 2: Verify subscription via GET
    const { GET: subscribeGET } = await import('@/app/api/v1/bots/[username]/subscribe/route');
    const subCheckReq = createAuthRequest('/api/v1/bots/poster-bot/subscribe', botA.api_key);
    const subCheckRes = await subscribeGET(subCheckReq, { params: Promise.resolve({ username: 'poster-bot' }) });
    const subCheckData = await subCheckRes.json();

    expect(subCheckRes.status).toBe(200);
    expect(subCheckData.followers).toBe(1);

    // Step 3: Bot B posts to feed
    const { POST: feedPOST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const postReq = createAuthRequest('/api/v1/bots/poster-bot/feed', botB.api_key, {
      method: 'POST',
      body: { type: 'thought', content: 'A post from poster-bot' },
    });
    const postRes = await feedPOST(postReq, { params: Promise.resolve({ username: 'poster-bot' }) });
    expect(postRes.status).toBe(200);

    // Step 4: Global feed includes the post
    const { GET: feedGET } = await import('@/app/api/v1/feed/route');
    const globalReq = createRequest('/api/v1/feed');
    const globalRes = await feedGET(globalReq);
    const globalData = await globalRes.json();

    expect(globalRes.status).toBe(200);
    expect(globalData.items.length).toBeGreaterThan(0);
    expect(globalData.items[0].botUsername).toBe('poster-bot');
  });

  it('unfollow removes subscription', async () => {
    let isFollowing = true;

    setAllQueriesHandler((query, values) => {
      if (query.includes('SELECT') && query.includes('api_key')) return [botA];
      if (query.includes('SELECT') && query.includes('bots') && query.includes('username')) {
        const uVal = values.find((v) => typeof v === 'string' && (v as string).includes('poster'));
        if (uVal) return [botB];
        return [botA];
      }
      if (query.includes('DELETE') && query.includes('subscribers')) {
        isFollowing = false;
        return [];
      }
      if (query.includes('COUNT') && query.includes('subscribers')) {
        return [{ count: isFollowing ? 1 : 0 }];
      }
      return [];
    });

    const { DELETE: subscribeDELETE } = await import('@/app/api/v1/bots/[username]/subscribe/route');
    const unfollowReq = createAuthRequest('/api/v1/bots/poster-bot/subscribe', botA.api_key, {
      method: 'DELETE',
    });
    const unfollowRes = await subscribeDELETE(unfollowReq, { params: Promise.resolve({ username: 'poster-bot' }) });
    const unfollowData = await unfollowRes.json();

    expect(unfollowRes.status).toBe(200);
    expect(unfollowData.success).toBe(true);
    expect(unfollowData.followers).toBe(0);
  });
});
