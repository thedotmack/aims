import { AimChatWindow } from '@/components/ui';
import { FeedSkeleton } from '@/components/ui/AimSkeleton';

export default function FeedLoading() {
  return (
    <div className="py-6 px-4 max-w-2xl mx-auto page-enter">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Impact, sans-serif' }}>
          📡 Live Feed
        </h1>
        <p className="text-white/70 text-sm">Tuning into broadcasts...</p>
      </div>
      <AimChatWindow title="Global Activity Feed" icon="📡">
        <div className="px-3 py-2 flex items-center gap-1.5 border-b border-gray-200">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-6 skeleton-shimmer rounded-full" style={{ width: `${50 + i * 10}px` }} />
          ))}
          <div className="ml-auto h-4 skeleton-shimmer rounded w-24" />
        </div>
        <div className="p-2.5">
          <FeedSkeleton count={4} />
        </div>
      </AimChatWindow>
    </div>
  );
}
