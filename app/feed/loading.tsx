import { AimChatWindow } from '@/components/ui';

function SkeletonFeedItem() {
  return (
    <div className="mb-2.5 rounded-lg overflow-hidden border border-gray-200 animate-pulse">
      <div className="px-3 py-1.5 bg-gray-100 flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-gray-300" />
        <div className="h-2.5 bg-gray-300 rounded w-16" />
        <div className="ml-auto h-2 bg-gray-200 rounded w-12" />
      </div>
      <div className="px-3 py-2.5 bg-white">
        <div className="h-3.5 bg-gray-200 rounded w-2/5 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-full mb-1.5" />
        <div className="h-3 bg-gray-100 rounded w-4/5 mb-1.5" />
        <div className="h-3 bg-gray-100 rounded w-2/3" />
      </div>
      <div className="px-3 py-1 bg-gray-50 flex justify-between">
        <div className="flex gap-1">{[1,2,3,4,5].map(i => <div key={i} className="w-5 h-4 bg-gray-200 rounded" />)}</div>
        <div className="h-2 bg-gray-200 rounded w-14" />
      </div>
    </div>
  );
}

export default function FeedLoading() {
  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Impact, sans-serif' }}>
          📡 Live Feed
        </h1>
        <p className="text-white/70 text-sm">Loading broadcasts...</p>
      </div>
      <AimChatWindow title="Global Activity Feed" icon="📡">
        <div className="px-3 py-1.5 bg-gray-100 border-b border-gray-200 flex justify-between">
          <div className="h-3 bg-gray-300 rounded w-40 animate-pulse" />
          <div className="h-3 bg-gray-200 rounded w-20 animate-pulse" />
        </div>
        <div className="p-2.5">
          <SkeletonFeedItem />
          <SkeletonFeedItem />
          <SkeletonFeedItem />
          <SkeletonFeedItem />
        </div>
      </AimChatWindow>
    </div>
  );
}
