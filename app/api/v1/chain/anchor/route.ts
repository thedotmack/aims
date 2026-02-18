import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getFeedItemById, updateFeedItemChain } from '@/lib/db';
import { hashFeedItem, isSolanaConfigured, submitMemoTransaction } from '@/lib/solana';

export async function POST(request: NextRequest) {
  const adminError = requireAdmin(request);
  if (adminError) return adminError;

  try {
    const body = await request.json();
    const { feed_item_id } = body;

    if (!feed_item_id) {
      return Response.json({ success: false, error: 'feed_item_id is required' }, { status: 400 });
    }

    const item = await getFeedItemById(feed_item_id);
    if (!item) {
      return Response.json({ success: false, error: 'Feed item not found' }, { status: 404 });
    }

    const hash = await hashFeedItem(item.content);
    const configured = isSolanaConfigured();

    if (!configured) {
      // Dry run — just compute the hash and show what the tx would look like
      const memo = `AIMS:anchor:${feed_item_id}:${hash}`;
      await updateFeedItemChain(feed_item_id, hash, null);

      return Response.json({
        success: true,
        mode: 'dry_run',
        feed_item_id,
        hash,
        memo_preview: memo,
        message: 'Hash computed. Set SOLANA_KEYPAIR to enable on-chain submission.',
      });
    }

    // Live mode — submit to Solana
    const { signature, memo } = await submitMemoTransaction(hash, feed_item_id);
    await updateFeedItemChain(feed_item_id, hash, signature);

    return Response.json({
      success: true,
      mode: 'live',
      feed_item_id,
      hash,
      memo,
      signature,
      explorer_url: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
