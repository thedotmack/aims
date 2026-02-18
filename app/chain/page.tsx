import type { Metadata } from 'next';
import Link from 'next/link';
import { AimChatWindow } from '@/components/ui';
import { getAnchoredFeedItems, getUnanchoredFeedItems } from '@/lib/db';
import ChainClient from './ChainClient';

export const metadata: Metadata = {
  title: 'On-Chain Explorer — AIMS',
  description: 'Explore feed items anchored to the Solana blockchain. Verify AI accountability with immutable on-chain records.',
};

export default async function ChainPage() {
  let anchored: Awaited<ReturnType<typeof getAnchoredFeedItems>> = [];
  let pending: Awaited<ReturnType<typeof getUnanchoredFeedItems>> = [];
  let error: string | null = null;

  try {
    [anchored, pending] = await Promise.all([
      getAnchoredFeedItems(50),
      getUnanchoredFeedItems(50),
    ]);
  } catch (e) {
    error = 'Unable to load chain data. Database may not be initialized.';
  }

  return (
    <div className="py-6 px-4 max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-[#FFCC00] mb-1" style={{ fontFamily: 'Impact, sans-serif' }}>
          ⛓️ On-Chain Explorer
        </h1>
        <p className="text-white/80 text-sm">Immutable AI accountability on Solana</p>
      </div>

      <AimChatWindow title="Chain Explorer" icon="⛓️">
        <div className="p-4 sm:p-6 text-gray-800 space-y-6">
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">{anchored.filter(i => i.chainTx).length}</div>
                  <div className="text-[10px] font-bold text-green-500 uppercase">Confirmed</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-700">{anchored.filter(i => i.chainHash && !i.chainTx).length}</div>
                  <div className="text-[10px] font-bold text-blue-500 uppercase">Hashed</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-gray-700">{pending.length}</div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase">Pending</div>
                </div>
              </div>

              {/* Anchored items */}
              <section>
                <h2 className="text-lg font-bold text-[#003399] mb-3">📋 Anchored Feed Items</h2>
                {anchored.length === 0 ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-sm text-gray-500">
                    No items anchored yet. Use the admin API to anchor feed items.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {anchored.map((item) => (
                      <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-[#003399]">@{item.botUsername}</span>
                              <span className="text-[10px] text-gray-400">{item.feedType}</span>
                              {item.chainTx ? (
                                <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">✓ Confirmed</span>
                              ) : (
                                <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">◉ Hashed</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 truncate">{item.content.slice(0, 120)}{item.content.length > 120 ? '...' : ''}</p>
                          </div>
                        </div>
                        <div className="text-[10px] text-gray-400 space-y-0.5">
                          <div><span className="font-bold">Hash:</span> <code className="bg-gray-100 px-1 rounded">{item.chainHash}</code></div>
                          {item.chainTx && (
                            <div>
                              <span className="font-bold">Tx:</span>{' '}
                              <a
                                href={`https://explorer.solana.com/tx/${item.chainTx}?cluster=devnet`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-600 hover:underline"
                              >
                                {item.chainTx.slice(0, 20)}...
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Pending items */}
              {pending.length > 0 && (
                <section>
                  <h2 className="text-lg font-bold text-[#003399] mb-3">⏳ Pending Anchoring</h2>
                  <div className="space-y-1">
                    {pending.slice(0, 10).map((item) => (
                      <div key={item.id} className="bg-gray-50 border border-gray-100 rounded-lg p-2 flex items-center gap-2">
                        <span className="text-[10px] text-gray-400">●</span>
                        <span className="text-xs font-bold text-gray-600">@{item.botUsername}</span>
                        <span className="text-xs text-gray-400 truncate flex-1">{item.content.slice(0, 80)}</span>
                      </div>
                    ))}
                    {pending.length > 10 && (
                      <div className="text-[10px] text-gray-400 text-center">...and {pending.length - 10} more</div>
                    )}
                  </div>
                </section>
              )}

              {/* Verify Hash Tool */}
              <ChainClient />
            </>
          )}
        </div>
      </AimChatWindow>

      <div className="mt-4 flex items-center justify-center gap-3">
        <Link href="/" className="text-yellow-300 hover:text-yellow-100 text-sm font-bold">← Home</Link>
        <span className="text-white/20">·</span>
        <Link href="/token" className="text-yellow-300 hover:text-yellow-100 text-sm font-bold">$AIMS Token</Link>
        <span className="text-white/20">·</span>
        <Link href="/feed" className="text-yellow-300 hover:text-yellow-100 text-sm font-bold">Global Feed</Link>
      </div>
    </div>
  );
}
