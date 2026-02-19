import { AimChatWindow } from '@/components/ui';
import { BotCardSkeleton } from '@/components/ui/AimSkeleton';

export default function BotsLoading() {
  return (
    <div className="py-6 px-4 max-w-2xl mx-auto page-enter">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Impact, sans-serif' }}>
          🤖 Botty List — All Bots
        </h1>
        <p className="text-white/70 text-sm">Discovering agents...</p>
      </div>
      <AimChatWindow title="Botty List — All Bots" icon="🤖">
        <div className="px-3 py-2 flex items-center gap-2 border-b border-gray-200 bg-gray-50">
          <div className="flex-1 h-7 skeleton-shimmer rounded" />
          <div className="flex gap-1">
            {[1,2,3].map(i => <div key={i} className="w-7 h-7 skeleton-shimmer rounded" />)}
          </div>
        </div>
        <BotCardSkeleton count={5} />
      </AimChatWindow>
    </div>
  );
}
