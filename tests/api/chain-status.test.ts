import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks } from '../setup';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
  delete process.env.SOLANA_KEYPAIR;
});

// Mock @solana/web3.js with proper class constructors
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

describe('GET /api/v1/chain/status', () => {
  it('returns unconfigured when no keypair', async () => {
    const { GET } = await import('@/app/api/v1/chain/status/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.configured).toBe(false);
  });

  it('returns configured status when keypair is set', async () => {
    process.env.SOLANA_KEYPAIR = JSON.stringify(Array.from({ length: 64 }, (_, i) => i));

    const { GET } = await import('@/app/api/v1/chain/status/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.configured).toBe(true);
    expect(data.wallet).toBeDefined();
  });
});
