import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createRequest } from '../helpers';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
  delete process.env.SOLANA_KEYPAIR;
});

vi.mock('@solana/web3.js', () => {
  class MockPublicKey {
    private key: string;
    constructor(key: string) { this.key = key; }
    toBase58() { return this.key; }
  }
  class MockConnection {
    constructor() {}
    async getVersion() { return { 'solana-core': '1.18.0' }; }
    async getBalance() { return 5000000000; }
  }
  class MockKeypair {
    publicKey: MockPublicKey;
    constructor() { this.publicKey = new MockPublicKey('FakeWallet123'); }
    static fromSecretKey() { return new MockKeypair(); }
  }
  return {
    Connection: MockConnection,
    PublicKey: MockPublicKey,
    Keypair: MockKeypair,
    Transaction: class { add() { return this; } },
    TransactionInstruction: class {},
    sendAndConfirmTransaction: vi.fn().mockResolvedValue('mock-sig-123'),
  };
});

describe('POST /api/v1/chain/anchor-batch', () => {
  it('returns dry_run mode when no keypair', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('feed_items') && query.includes('chain_hash IS NULL')) {
        return [{ id: 'feed-1', content: 'test content', bot_username: 'bot1' }];
      }
      if (query.includes('UPDATE feed_items')) return [];
      return [];
    });

    const req = createRequest('/api/v1/chain/anchor-batch', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-admin-key-123' },
    });
    const { POST } = await import('@/app/api/v1/chain/anchor-batch/route');
    const response = await POST(req);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.mode).toBe('dry_run');
    expect(data.processed).toBe(1);
    expect(data.results[0].hash).toMatch(/^[a-f0-9]{64}$/);
    expect(data.results[0].signature).toBeUndefined();
  });

  it('returns live mode with keypair', async () => {
    process.env.SOLANA_KEYPAIR = JSON.stringify(Array.from({ length: 64 }, (_, i) => i));

    setAllQueriesHandler((query) => {
      if (query.includes('feed_items') && query.includes('chain_hash IS NULL')) {
        return [{ id: 'feed-1', content: 'test content', bot_username: 'bot1' }];
      }
      if (query.includes('UPDATE feed_items')) return [];
      return [];
    });

    const req = createRequest('/api/v1/chain/anchor-batch', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-admin-key-123' },
    });
    const { POST } = await import('@/app/api/v1/chain/anchor-batch/route');
    const response = await POST(req);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.mode).toBe('live');
    expect(data.results[0].signature).toBe('mock-sig-123');
  });

  it('returns empty results when no unanchored items', async () => {
    setAllQueriesHandler(() => []);

    const req = createRequest('/api/v1/chain/anchor-batch', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-admin-key-123' },
    });
    const { POST } = await import('@/app/api/v1/chain/anchor-batch/route');
    const response = await POST(req);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.processed).toBe(0);
  });

  it('rejects non-admin requests', async () => {
    const req = createRequest('/api/v1/chain/anchor-batch', { method: 'POST' });
    const { POST } = await import('@/app/api/v1/chain/anchor-batch/route');
    const response = await POST(req);
    expect([401, 403]).toContain(response.status);
  });
});
