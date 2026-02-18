'use client';

import { useEffect, useState } from 'react';

interface ChainStatus {
  configured: boolean;
  wallet?: string;
  balance?: number;
  solanaVersion?: string;
  recentTransactions?: Array<{
    signature: string;
    slot: number;
    blockTime: number | null;
  }>;
  message?: string;
}

export default function SolanaStatus() {
  const [status, setStatus] = useState<ChainStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/chain/status')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setStatus(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-center text-xs text-gray-400">
        Checking Solana connection...
      </div>
    );
  }

  if (!status || !status.configured) {
    return null; // Don't show anything when not configured — fall back to existing mock data
  }

  return (
    <section>
      <h2 className="text-lg font-bold text-[#003399] mb-3">🟢 Live Solana Devnet</h2>
      <div className="bg-gradient-to-br from-purple-50 to-green-50 rounded-lg border border-purple-200 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-bold text-green-700">Connected to Solana {status.solanaVersion}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="text-[10px] font-bold text-gray-400 uppercase">Wallet</div>
            <div className="text-xs font-mono text-gray-700 truncate">{status.wallet}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="text-[10px] font-bold text-gray-400 uppercase">Balance</div>
            <div className="text-lg font-bold text-purple-700">{status.balance?.toFixed(4)} SOL</div>
          </div>
        </div>

        {status.recentTransactions && status.recentTransactions.length > 0 && (
          <div>
            <div className="text-xs font-bold text-gray-600 mb-2">Recent Transactions</div>
            <div className="space-y-1">
              {status.recentTransactions.slice(0, 5).map((tx) => (
                <div key={tx.signature} className="flex items-center justify-between bg-white rounded p-2 border border-gray-100 text-[10px]">
                  <a
                    href={`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 hover:underline font-mono truncate max-w-[200px]"
                  >
                    {tx.signature.slice(0, 24)}...
                  </a>
                  <span className="text-gray-400">
                    {tx.blockTime ? new Date(tx.blockTime * 1000).toLocaleString() : `Slot ${tx.slot}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
