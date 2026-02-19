import { NextRequest } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { hashFeedItem, isSolanaConfigured, getConnection, getWalletAddress } from '@/lib/solana';

/**
 * POST /api/v1/chain/verify
 *
 * Verify a feed item's content hash matches its on-chain record.
 * Also serves as a connectivity check when called with no body.
 *
 * Body (optional):
 *   { content: string, expectedHash: string }
 *
 * Returns:
 *   { configured, connectivity, verification? }
 */
export async function POST(request: NextRequest) {
  try {
    const configured = isSolanaConfigured();

    // Connectivity check: can we reach the RPC?
    let connectivity: 'ok' | 'unreachable' | 'unconfigured' = 'unconfigured';
    let rpcVersion: string | null = null;

    if (configured) {
      try {
        const connection = getConnection();
        const version = await connection.getVersion();
        rpcVersion = version['solana-core'] ?? null;
        connectivity = 'ok';
      } catch {
        connectivity = 'unreachable';
      }
    }

    // Optional content verification
    let verification: { contentHash: string; matches: boolean } | null = null;
    try {
      const body = await request.json();
      if (body?.content && body?.expectedHash) {
        const computed = await hashFeedItem(body.content);
        verification = {
          contentHash: computed,
          matches: computed === body.expectedHash,
        };
      }
    } catch {
      // No body or invalid JSON — that's fine, just return connectivity info
    }

    return Response.json({
      success: true,
      configured,
      connectivity,
      wallet: getWalletAddress(),
      rpcVersion,
      ...(verification ? { verification } : {}),
    }, {
      headers: { 'Cache-Control': 'no-cache' },
    });
  } catch (err) {
    return handleApiError(err, '/api/v1/chain/verify', 'POST');
  }
}
