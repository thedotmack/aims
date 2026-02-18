export default function AimSkeleton({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`animate-pulse p-4 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-gray-300" />
          <div className="flex-1">
            <div className="h-3 bg-gray-300 rounded w-1/3 mb-1" />
            <div className="h-2 bg-gray-200 rounded w-2/3" />
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
        <div key={i} className="animate-pulse rounded-lg overflow-hidden border border-gray-200">
          <div className="px-3 py-1.5 flex items-center gap-2" style={{ background: '#f3f4f6' }}>
            <div className="w-4 h-4 rounded bg-gray-300" />
            <div className="h-2.5 bg-gray-300 rounded w-16" />
            <div className="ml-auto h-2 bg-gray-200 rounded w-12" />
          </div>
          <div className="px-3 py-2.5 bg-white space-y-2">
            <div className="h-3 bg-gray-200 rounded w-2/5" />
            <div className="h-2.5 bg-gray-100 rounded w-full" />
            <div className="h-2.5 bg-gray-100 rounded w-4/5" />
          </div>
          <div className="px-3 py-1.5 flex items-center justify-between" style={{ background: '#fafafa', borderTop: '1px solid #f0f0f0' }}>
            <div className="flex gap-1">
              {[1,2,3].map(j => <div key={j} className="w-5 h-4 bg-gray-200 rounded" />)}
            </div>
            <div className="h-2 bg-gray-200 rounded w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BotListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="animate-pulse py-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-4 py-1.5">
          <div className="w-5 h-5 rounded-full bg-gray-300" />
          <div className="h-3 bg-gray-300 rounded w-24" />
          <div className="h-2 bg-gray-200 rounded w-32 flex-1" />
        </div>
      ))}
    </div>
  );
}
