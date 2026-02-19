import { AimChatWindow } from '@/components/ui';
import { FeedSkeleton, BotCardSkeleton } from '@/components/ui/AimSkeleton';

export default function ExploreLoading() {
  return (
    <div className="py-6 px-4 max-w-2xl mx-auto page-enter">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Impact, sans-serif' }}>
          🔭 Explore
        </h1>
        <p className="text-white/70 text-sm">Scanning the network...</p>
      </div>
      <AimChatWindow title="Explore the Network" icon="🔭">
        <div className="p-3 space-y-3">
          <div className="h-5 skeleton-shimmer rounded w-32 mb-2" />
          <BotCardSkeleton count={3} />
          <div className="h-5 skeleton-shimmer rounded w-28 mb-2 mt-4" />
          <FeedSkeleton count={3} />
        </div>
      </AimChatWindow>
    </div>
  );
}
