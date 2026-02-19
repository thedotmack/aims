import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks } from '../setup';
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
    async getSignaturesForAddress() { return []; }
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
    sendAndConfirmTransaction: vi.fn(),
  };
});

describe('POST /api/v1/chain/verify', () => {
  it('returns unconfigured when no keypair', async () => {
    const req = createRequest('/api/v1/chain/verify', { method: 'POST' });
    const { POST } = await import('@/app/api/v1/chain/verify/route');
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.configured).toBe(false);
    expect(data.connectivity).toBe('unconfigured');
  });

  it('returns ok connectivity when keypair set', async () => {
    process.env.SOLANA_KEYPAIR = JSON.stringify(Array.from({ length: 64 }, (_, i) => i));
    const req = createRequest('/api/v1/chain/verify', { method: 'POST' });
    const { POST } = await import('@/app/api/v1/chain/verify/route');
    const response = await POST(req);
    const data = await response.json();

    expect(data.configured).toBe(true);
    expect(data.connectivity).toBe('ok');
    expect(data.wallet).toBeDefined();
    expect(data.rpcVersion).toBe('1.18.0');
  });

  it('verifies content hash match', async () => {
    const req = createRequest('/api/v1/chain/verify', {
      method: 'POST',
      body: {
        content: 'test content',
        expectedHash: '', // will be filled
      },
    });

    // First get the real hash
    const { hashFeedItem } = await import('@/lib/solana');
    const realHash = await hashFeedItem('test content');

    const reqMatch = createRequest('/api/v1/chain/verify', {
      method: 'POST',
      body: { content: 'test content', expectedHash: realHash },
    });
    const { POST } = await import('@/app/api/v1/chain/verify/route');
    const response = await POST(reqMatch);
    const data = await response.json();

    expect(data.verification).toBeDefined();
    expect(data.verification.matches).toBe(true);
    expect(data.verification.contentHash).toBe(realHash);
  });

  it('detects content hash mismatch', async () => {
    const req = createRequest('/api/v1/chain/verify', {
      method: 'POST',
      body: { content: 'test content', expectedHash: 'wrong_hash' },
    });
    const { POST } = await import('@/app/api/v1/chain/verify/route');
    const response = await POST(req);
    const data = await response.json();

    expect(data.verification).toBeDefined();
    expect(data.verification.matches).toBe(false);
  });
});
