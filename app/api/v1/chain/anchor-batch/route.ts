import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getUnanchoredFeedItems, updateFeedItemChain } from '@/lib/db';
import { hashFeedItem, isSolanaConfigured, submitMemoTransaction } from '@/lib/solana';

export async function POST(request: NextRequest) {
  const adminError = requireAdmin(request);
  if (adminError) return adminError;

  try {
    const items = await getUnanchoredFeedItems(100);
    const configured = isSolanaConfigured();
    const results: Array<{ id: string; hash: string; signature?: string; error?: string }> = [];

    for (const item of items) {
      try {
        const hash = await hashFeedItem(item.content);

        if (configured) {
          const { signature } = await submitMemoTransaction(hash, item.id);
          await updateFeedItemChain(item.id, hash, signature);
          results.push({ id: item.id, hash, signature });
        } else {
          await updateFeedItemChain(item.id, hash, null);
          results.push({ id: item.id, hash });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        results.push({ id: item.id, hash: '', error: message });
      }
    }

    return Response.json({
      success: true,
      mode: configured ? 'live' : 'dry_run',
      processed: results.length,
      results,
    });
  } catch {
    return Response.json({ success: false, error: 'Anchor batch failed' }, { status: 500 });
  }
}
