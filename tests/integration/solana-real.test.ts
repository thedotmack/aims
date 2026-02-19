/**
 * Optional real Solana devnet integration tests.
 * These tests are SKIPPED unless SOLANA_RPC_URL is set.
 * They verify actual connectivity — no mocks.
 *
 * To run: SOLANA_RPC_URL=https://api.devnet.solana.com npx vitest run tests/integration/solana-real.test.ts
 */
import { describe, it, expect } from 'vitest';

const HAS_RPC = !!process.env.SOLANA_RPC_URL;
const describeIfRpc = HAS_RPC ? describe : describe.skip;

describeIfRpc('Solana real devnet connectivity', () => {
  it('can connect to Solana RPC and get version', async () => {
    // Dynamic import to avoid loading @solana/web3.js when not needed
    const { Connection } = await import('@solana/web3.js');
    const url = process.env.SOLANA_RPC_URL!;
    const connection = new Connection(url, 'confirmed');
    const version = await connection.getVersion();
    expect(version['solana-core']).toBeDefined();
    expect(typeof version['solana-core']).toBe('string');
  });

  it('hashFeedItem produces consistent SHA-256 hex', async () => {
    // This doesn't need Solana but tests the hashing used for anchoring
    const { hashFeedItem } = await import('@/lib/solana');
    const hash1 = await hashFeedItem('test content');
    const hash2 = await hashFeedItem('test content');
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('buildMemoTransaction creates valid transaction structure', async () => {
    const { Keypair } = await import('@solana/web3.js');
    const { buildMemoTransaction } = await import('@/lib/solana');
    const kp = Keypair.generate();
    const { transaction, memo } = buildMemoTransaction('abc123', 'feed-001', kp.publicKey);
    expect(memo).toBe('AIMS:anchor:feed-001:abc123');
    expect(transaction.instructions).toHaveLength(1);
    expect(transaction.instructions[0].programId.toBase58()).toBe(
      'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'
    );
  });
});

const HAS_KEYPAIR = !!process.env.SOLANA_KEYPAIR;
const describeIfKeypair = HAS_KEYPAIR && HAS_RPC ? describe : describe.skip;

describeIfKeypair('Solana real devnet with keypair', () => {
  it('can read wallet balance', async () => {
    const { Connection, PublicKey } = await import('@solana/web3.js');
    const { getKeypair } = await import('@/lib/solana');
    const kp = getKeypair();
    expect(kp).not.toBeNull();
    const connection = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');
    const balance = await connection.getBalance(kp!.publicKey);
    expect(typeof balance).toBe('number');
    expect(balance).toBeGreaterThanOrEqual(0);
  });
});
