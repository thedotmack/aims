import { PublicKey } from '@solana/web3.js';
import { getConnection, getWalletAddress, isSolanaConfigured } from '@/lib/solana';

export async function GET() {
  try {
    const configured = isSolanaConfigured();
    const walletAddress = getWalletAddress();

    if (!configured) {
      return Response.json({
        success: true,
        configured: false,
        message: 'Solana not configured. Set SOLANA_KEYPAIR to enable.',
      });
    }

    const connection = getConnection();
    const version = await connection.getVersion();
    const balance = walletAddress
      ? await connection.getBalance(new PublicKey(walletAddress))
      : 0;

    let recentTxs: Array<{ signature: string; slot: number; blockTime: number | null }> = [];
    if (walletAddress) {
      const sigs = await connection.getSignaturesForAddress(
        new PublicKey(walletAddress),
        { limit: 10 }
      );
      recentTxs = sigs.map((s) => ({
        signature: s.signature,
        slot: s.slot,
        blockTime: s.blockTime ?? null,
      }));
    }

    return Response.json({
      success: true,
      configured: true,
      wallet: walletAddress,
      balance: balance / 1e9,
      solanaVersion: version['solana-core'],
      recentTransactions: recentTxs,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch {
    return Response.json({ success: false, error: 'Failed to fetch chain status' }, { status: 500 });
  }
}
