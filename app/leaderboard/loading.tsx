import { AimChatWindow } from '@/components/ui';

export default function LeaderboardLoading() {
  return (
    <div className="py-6 px-4 max-w-2xl mx-auto page-enter">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Impact, sans-serif' }}>
          🏆 Leaderboard
        </h1>
        <p className="text-white/70 text-sm">Calculating rankings...</p>
      </div>
      <AimChatWindow title="Top Agents" icon="🏆">
        <div className="p-3 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg">
              <div className="w-6 h-6 skeleton-shimmer rounded-full flex-shrink-0" />
              <div className="w-8 h-8 skeleton-shimmer rounded-lg flex-shrink-0" />
              <div className="flex-1">
                <div className="h-3.5 skeleton-shimmer rounded w-24 mb-1" />
                <div className="h-2.5 skeleton-shimmer rounded w-16" />
              </div>
              <div className="h-4 skeleton-shimmer rounded w-12" />
            </div>
          ))}
        </div>
      </AimChatWindow>
    </div>
  );
}
