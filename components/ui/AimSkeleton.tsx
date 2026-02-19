export default function AimSkeleton({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`p-4 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full skeleton-shimmer" />
          <div className="flex-1">
            <div className="h-3 skeleton-shimmer rounded w-1/3 mb-1" />
            <div className="h-2 skeleton-shimmer rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700" style={{ animationDelay: `${i * 100}ms` }}>
          <div className="px-3 py-1.5 flex items-center gap-2 bg-gray-50 dark:bg-gray-800">
            <div className="w-4 h-4 rounded skeleton-shimmer" />
            <div className="h-2.5 skeleton-shimmer rounded w-16" />
            <div className="ml-auto h-2 skeleton-shimmer rounded w-12" />
          </div>
          <div className="px-3 py-2.5 bg-white dark:bg-gray-900 space-y-2">
            <div className="h-3 skeleton-shimmer rounded w-2/5" />
            <div className="h-2.5 skeleton-shimmer rounded w-full" />
            <div className="h-2.5 skeleton-shimmer rounded w-4/5" />
          </div>
          <div className="px-3 py-1.5 flex items-center justify-between bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
            <div className="flex gap-1">
              {[1,2,3].map(j => <div key={j} className="w-5 h-4 skeleton-shimmer rounded" />)}
            </div>
            <div className="h-2 skeleton-shimmer rounded w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BotListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="py-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-4 py-1.5" style={{ animationDelay: `${i * 80}ms` }}>
          <div className="w-5 h-5 rounded-full skeleton-shimmer" />
          <div className="h-3 skeleton-shimmer rounded w-24" />
          <div className="h-2 skeleton-shimmer rounded w-32 flex-1" />
        </div>
      ))}
    </div>
  );
}

export function BotCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="p-2.5 space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-lg skeleton-shimmer flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="h-4 skeleton-shimmer rounded w-28" />
                <div className="h-4 skeleton-shimmer rounded-full w-10" />
              </div>
              <div className="h-2.5 skeleton-shimmer rounded w-16 mb-2" />
              <div className="h-2.5 skeleton-shimmer rounded w-40 mb-2" />
              <div className="flex gap-3">
                <div className="h-2.5 skeleton-shimmer rounded w-20" />
                <div className="h-2.5 skeleton-shimmer rounded w-16" />
              </div>
            </div>
            <div className="w-[50px] h-5 skeleton-shimmer rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-lg skeleton-shimmer flex-shrink-0" />
        <div className="flex-1">
          <div className="h-5 skeleton-shimmer rounded w-32 mb-2" />
          <div className="h-3 skeleton-shimmer rounded w-20 mb-2" />
          <div className="h-3 skeleton-shimmer rounded w-48" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-8 skeleton-shimmer rounded-lg flex-1" />
        <div className="h-8 skeleton-shimmer rounded-lg flex-1" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[1,2,3].map(i => (
          <div key={i} className="p-3 rounded-lg border border-gray-200">
            <div className="h-6 skeleton-shimmer rounded w-12 mx-auto mb-1" />
            <div className="h-2.5 skeleton-shimmer rounded w-16 mx-auto" />
          </div>
        ))}
      </div>
      <FeedSkeleton count={3} />
    </div>
  );
}
