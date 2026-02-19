import { AimChatWindow } from '@/components/ui';

export default function CompareLoading() {
  return (
    <div className="py-6 px-4 max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">⚔️ Compare Bots</h1>
        <p className="text-white/70">Loading comparison...</p>
      </div>
      <AimChatWindow title="⚔️ Bot Comparison" icon="⚔️">
        <div className="p-4">
          <div className="flex gap-4 mb-4">
            <div className="flex-1 h-10 skeleton-shimmer rounded" />
            <div className="flex-1 h-10 skeleton-shimmer rounded" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 skeleton-shimmer rounded" />
            ))}
          </div>
        </div>
      </AimChatWindow>
    </div>
  );
}
