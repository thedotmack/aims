import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createRequest, createAuthRequest } from '../helpers';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

const botA = {
  id: 'bot-aaa',
  username: 'alice-bot',
  display_name: 'Alice Bot',
  avatar_url: '',
  status_message: '',
  is_online: false,
  api_key: 'aims_alice_key_123',
  webhook_url: null,
  key_created_at: new Date(),
  ip_address: '127.0.0.1',
  created_at: new Date(),
  last_seen: new Date(),
  token_balance: 100,
};

const botB = {
  id: 'bot-bbb',
  username: 'bob-bot',
  display_name: 'Bob Bot',
  avatar_url: '',
  status_message: '',
  is_online: false,
  api_key: 'aims_bob_key_456',
  webhook_url: null,
  key_created_at: new Date(),
  ip_address: '127.0.0.1',
  created_at: new Date(),
  last_seen: new Date(),
  token_balance: 100,
};

const dmRoom = {
  id: 'dm-room-001',
  bot1_username: 'alice-bot',
  bot1Username: 'alice-bot',
  bot2_username: 'bob-bot',
  bot2Username: 'bob-bot',
  created_at: new Date(),
  last_activity: new Date(),
};

describe('Integration: DM Flow', () => {
  it('register 2 bots → create DM → send messages → get messages → verify token deductions', async () => {
    let dmCreated = false;
    const messages: Array<{ id: string; dm_id: string; from_username: string; fromUsername: string; content: string; timestamp: Date }> = [];
    let aliceTokens = 100;
    let bobTokens = 100;

    setAllQueriesHandler((query, values) => {
      // Bot lookups by api_key
      if (query.includes('SELECT') && query.includes('api_key')) {
        const keyVal = values.find((v) => typeof v === 'string' && (v as string).startsWith('aims_'));
        if (keyVal === botA.api_key) return [{ ...botA, token_balance: aliceTokens }];
        if (keyVal === botB.api_key) return [{ ...botB, token_balance: bobTokens }];
        return [];
      }
      // Bot lookups by username
      if (query.includes('SELECT') && query.includes('bots') && query.includes('username')) {
        const uVal = values.find((v) => typeof v === 'string' && ((v as string).includes('alice') || (v as string).includes('bob')));
        if (uVal === 'alice-bot') return [{ ...botA, token_balance: aliceTokens }];
        if (uVal === 'bob-bot') return [{ ...botB, token_balance: bobTokens }];
        return [];
      }
      // DM lookup by participants
      if (query.includes('SELECT') && query.includes('dms') && query.includes('bot1_username') && !dmCreated) {
        return [];
      }
      if (query.includes('SELECT') && query.includes('dms') && query.includes('bot1_username') && dmCreated) {
        return [dmRoom];
      }
      // DM lookup by id
      if (query.includes('SELECT') && query.includes('dms') && query.includes('id')) {
        if (dmCreated) return [dmRoom];
        return [];
      }
      // Create DM
      if (query.includes('INSERT INTO dms')) {
        dmCreated = true;
        return [dmRoom];
      }
      // Token deduction for DM (2 $AIMS)
      if (query.includes('UPDATE') && query.includes('token_balance')) {
        // Figure out which bot based on values
        const sender = values.find((v) => typeof v === 'string' && ((v as string).includes('alice') || (v as string).includes('bob')));
        if (sender === 'alice-bot') {
          aliceTokens -= 2;
          return [{ token_balance: aliceTokens }];
        }
        if (sender === 'bob-bot') {
          bobTokens -= 2;
          return [{ token_balance: bobTokens }];
        }
        return [{ token_balance: 98 }];
      }
      // Insert message
      if (query.includes('INSERT INTO messages')) {
        const msg = {
          id: `msg-${messages.length + 1}`,
          dm_id: 'dm-room-001',
          from_username: values[1] as string,
          fromUsername: values[1] as string,
          content: values[2] as string,
          timestamp: new Date(),
        };
        messages.push(msg);
        return [msg];
      }
      // Update DM last_activity
      if (query.includes('UPDATE') && query.includes('dms')) return [];
      // Get messages
      if (query.includes('SELECT') && query.includes('messages')) {
        return messages;
      }
      return [];
    });

    // Step 1: Create DM between alice and bob
    const { POST: dmPOST } = await import('@/app/api/v1/dms/route');
    const createDmReq = createAuthRequest('/api/v1/dms', botA.api_key, {
      method: 'POST',
      body: { from: 'alice-bot', to: 'bob-bot' },
    });
    const dmRes = await dmPOST(createDmReq);
    const dmData = await dmRes.json();

    expect(dmRes.status).toBe(200);
    expect(dmData.success).toBe(true);
    expect(dmData.dm.participants).toContain('alice-bot');
    expect(dmData.dm.participants).toContain('bob-bot');

    const roomId = dmData.dm.id;

    // Step 2: Alice sends a message (costs 2 $AIMS)
    const { POST: msgPOST, GET: msgGET } = await import('@/app/api/v1/dms/[roomId]/messages/route');
    const aliceMsgReq = createAuthRequest(`/api/v1/dms/${roomId}/messages`, botA.api_key, {
      method: 'POST',
      body: { from: 'alice-bot', content: 'Hey Bob!' },
    });
    const aliceMsgRes = await msgPOST(aliceMsgReq, { params: Promise.resolve({ roomId }) });
    const aliceMsgData = await aliceMsgRes.json();

    expect(aliceMsgRes.status).toBe(200);
    expect(aliceMsgData.success).toBe(true);
    expect(aliceMsgData.message.content).toBe('Hey Bob!');
    expect(aliceTokens).toBe(98); // 100 - 2

    // Step 3: Bob sends a message (costs 2 $AIMS)
    const bobMsgReq = createAuthRequest(`/api/v1/dms/${roomId}/messages`, botB.api_key, {
      method: 'POST',
      body: { from: 'bob-bot', content: 'Hi Alice!' },
    });
    const bobMsgRes = await msgPOST(bobMsgReq, { params: Promise.resolve({ roomId }) });
    const bobMsgData = await bobMsgRes.json();

    expect(bobMsgRes.status).toBe(200);
    expect(bobMsgData.success).toBe(true);
    expect(bobTokens).toBe(98); // 100 - 2

    // Step 4: Get messages and verify both appear
    const getMsgReq = createRequest(`/api/v1/dms/${roomId}/messages`);
    const getMsgRes = await msgGET(getMsgReq, { params: Promise.resolve({ roomId }) });
    const getMsgData = await getMsgRes.json();

    expect(getMsgRes.status).toBe(200);
    expect(getMsgData.messages.length).toBe(2);
  });

  it('DM fails with 402 when sender has insufficient tokens', async () => {
    const brokeBotA = { ...botA, token_balance: 0 };

    setAllQueriesHandler((query) => {
      if (query.includes('SELECT') && query.includes('api_key')) return [brokeBotA];
      if (query.includes('SELECT') && query.includes('bots') && query.includes('username')) {
        return [brokeBotA];
      }
      if (query.includes('SELECT') && query.includes('dms')) return [dmRoom];
      if (query.includes('UPDATE') && query.includes('token_balance')) return [];
      return [];
    });

    const { POST: msgPOST } = await import('@/app/api/v1/dms/[roomId]/messages/route');
    const req = createAuthRequest('/api/v1/dms/dm-room-001/messages', botA.api_key, {
      method: 'POST',
      body: { from: 'alice-bot', content: 'I have no tokens' },
    });
    const res = await msgPOST(req, { params: Promise.resolve({ roomId: 'dm-room-001' }) });
    expect(res.status).toBe(402);
    const data = await res.json();
    expect(data.required).toBeDefined();
    expect(data.balance).toBeDefined();
  });
});
