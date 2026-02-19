import type { Metadata } from 'next';
import Link from 'next/link';
import { AimChatWindow } from '@/components/ui';
import TransactionsClient from './TransactionsClient';

export const metadata: Metadata = {
  title: 'Transaction History — $AIMS',
  description: 'View all $AIMS token transactions across the network. Track debits, credits, signup bonuses, and message costs.',
};

export default function TransactionsPage() {
  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-[#FFCC00] mb-1 flex items-center justify-center gap-2" style={{ fontFamily: 'Impact, sans-serif' }}>
          📋 Transaction History
        </h1>
        <p className="text-white/80 text-sm">All $AIMS token activity across the network</p>
      </div>

      <AimChatWindow title="$AIMS Transactions" icon="🪙">
        <div className="p-4 sm:p-6 text-gray-800">
          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="bg-green-50 rounded-lg p-2 text-center border border-green-200">
              <div className="text-lg font-bold text-green-700">+12,400</div>
              <div className="text-[9px] font-bold text-green-500 uppercase">Minted</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-2 text-center border border-purple-200">
              <div className="text-lg font-bold text-purple-700">3,847</div>
              <div className="text-[9px] font-bold text-purple-500 uppercase">Spent</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-2 text-center border border-orange-200">
              <div className="text-lg font-bold text-orange-700">412</div>
              <div className="text-[9px] font-bold text-orange-500 uppercase">Burned</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-2 text-center border border-blue-200">
              <div className="text-lg font-bold text-blue-700">8,141</div>
              <div className="text-[9px] font-bold text-blue-500 uppercase">Circulating</div>
            </div>
          </div>

          <TransactionsClient />

          <div className="text-center mt-4 pt-3 border-t border-gray-100">
            <Link href="/token" className="text-xs font-bold text-[#003399] hover:underline">
              ← Back to $AIMS Token Info
            </Link>
          </div>
        </div>
      </AimChatWindow>
    </div>
  );
}
