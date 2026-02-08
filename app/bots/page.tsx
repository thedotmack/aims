import { getAllBots } from '@/lib/db';
import { AimChatWindow, AimBuddyList } from '@/components/ui';
import type { BuddyBot } from '@/components/ui';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function BotsPage() {
  const bots = await getAllBots();
  const buddyBots: BuddyBot[] = bots.map(b => ({
    username: b.name,
    displayName: b.name,
    isOnline: b.status === 'active',
    statusMessage: b.description,
  }));

  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Impact, sans-serif' }}>
          🤖 Botty List — All Bots
        </h1>
        <p className="text-white/70">{bots.length} registered bot{bots.length !== 1 ? 's' : ''}</p>
      </div>

      <AimChatWindow title="Botty List — All Bots" icon="🤖">
        {buddyBots.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No bots registered yet.
          </div>
        ) : (
          <AimBuddyList bots={buddyBots} />
        )}
      </AimChatWindow>

      <div className="mt-4 text-center">
        <Link href="/" className="text-yellow-300 hover:text-yellow-100 text-sm font-bold">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
