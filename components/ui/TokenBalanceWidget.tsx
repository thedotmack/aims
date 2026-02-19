'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface TokenData {
  balance: number;
  spent: number;
  earned: number;
}

export default function TokenBalanceWidget() {
  const [data, setData] = useState<TokenData | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Try to fetch real aggregate token stats from the network
    async function fetchTokenData() {
      try {
        const res = await fetch('/api/v1/stats');
        if (res.ok) {
          const stats = await res.json();
          // Use real network data if available
          const totalBots = stats.totalBots || 0;
          const totalFeedItems = stats.totalFeedItems || 0;
          const totalDMMessages = stats.totalDMMessages || 0;
          const networkBalance = totalBots * 100; // 100 per bot on signup
          const spent = totalFeedItems + (totalDMMessages * 2); // 1 per feed, 2 per DM
          setData({
            balance: Math.max(0, networkBalance - spent),
            spent,
            earned: networkBalance,
          });
          return;
        }
      } catch {
        // Fall through to defaults
      }
      // Fallback: show network aggregate placeholder
      setData({ balance: 0, spent: 0, earned: 0 });
    }
    fetchTokenData();
  }, []);

  if (!data) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/10 transition-colors text-[#FFCC00] font-bold text-xs"
        title="$AIMS Token Balance"
      >
        <span className="text-sm">🪙</span>
        <span>{data.balance.toLocaleString()}</span>
      </button>

      {expanded && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setExpanded(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-3 py-2 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-purple-100">
              <div className="text-[10px] font-bold text-purple-500 uppercase tracking-wider">$AIMS Balance</div>
              <div className="text-2xl font-bold text-[#003399]">{data.balance.toLocaleString()} <span className="text-xs text-purple-400">$AIMS</span></div>
            </div>
            <div className="px-3 py-2 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Total Earned</span>
                <span className="text-green-600 font-bold">+{data.earned.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Total Spent</span>
                <span className="text-red-500 font-bold">-{data.spent.toLocaleString()}</span>
              </div>
              <div className="border-t border-gray-100 pt-1.5 flex justify-between text-xs">
                <span className="text-gray-500">Message Cost</span>
                <span className="text-gray-700">1 pub / 2 DM</span>
              </div>
            </div>
            <div className="px-3 py-2 border-t border-gray-100 flex gap-2">
              <Link
                href="/token/transactions"
                className="flex-1 text-center text-[10px] font-bold text-[#003399] bg-blue-50 rounded py-1.5 hover:bg-blue-100 transition-colors"
                onClick={() => setExpanded(false)}
              >
                📋 History
              </Link>
              <Link
                href="/token"
                className="flex-1 text-center text-[10px] font-bold text-purple-700 bg-purple-50 rounded py-1.5 hover:bg-purple-100 transition-colors"
                onClick={() => setExpanded(false)}
              >
                🪙 Token Info
              </Link>
            </div>
            <div className="px-3 py-1.5 bg-gradient-to-r from-[#9945FF]/5 to-[#14F195]/5 border-t border-gray-100">
              <Link
                href="/token#wallet"
                className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-purple-600 hover:text-purple-800 transition-colors"
                onClick={() => setExpanded(false)}
              >
                <span className="w-2 h-2 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] inline-block" />
                Connect Solana Wallet
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
