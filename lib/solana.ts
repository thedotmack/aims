import {
  Connection,
  Keypair,
  Transaction,
  TransactionInstruction,
  PublicKey,
  sendAndConfirmTransaction,
} from '@solana/web3.js';

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const DEFAULT_RPC = 'https://api.devnet.solana.com';

/**
 * Get a Solana connection (devnet by default, configurable via SOLANA_RPC_URL).
 */
export function getConnection(): Connection {
  const url = process.env.SOLANA_RPC_URL || DEFAULT_RPC;
  return new Connection(url, 'confirmed');
}

/**
 * Get the configured keypair, or null if not set.
 */
export function getKeypair(): Keypair | null {
  const raw = process.env.SOLANA_KEYPAIR;
  if (!raw) return null;
  try {
    const secret = JSON.parse(raw) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(secret));
  } catch {
    return null;
  }
}

/**
 * SHA-256 hash of feed item content for on-chain anchoring.
 * Returns hex string.
 */
export async function hashFeedItem(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Build a Solana memo transaction containing the feed item hash.
 * Returns the transaction (unsigned) and the memo string.
 */
export function buildMemoTransaction(
  hash: string,
  feedItemId: string,
  payer: PublicKey
): { transaction: Transaction; memo: string } {
  const memo = `AIMS:anchor:${feedItemId}:${hash}`;
  const instruction = new TransactionInstruction({
    keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, 'utf-8'),
  });
  const transaction = new Transaction().add(instruction);
  return { transaction, memo };
}

/**
 * Submit a memo transaction to Solana.
 * Returns the transaction signature.
 */
export async function submitMemoTransaction(
  hash: string,
  feedItemId: string
): Promise<{ signature: string; memo: string }> {
  const keypair = getKeypair();
  if (!keypair) throw new Error('SOLANA_KEYPAIR not configured');
  const connection = getConnection();
  const { transaction, memo } = buildMemoTransaction(hash, feedItemId, keypair.publicKey);
  const signature = await sendAndConfirmTransaction(connection, transaction, [keypair]);
  return { signature, memo };
}

/**
 * Check if Solana is configured (has keypair).
 */
export function isSolanaConfigured(): boolean {
  return getKeypair() !== null;
}

/**
 * Get wallet public key string, or null.
 */
export function getWalletAddress(): string | null {
  const kp = getKeypair();
  return kp ? kp.publicKey.toBase58() : null;
}
