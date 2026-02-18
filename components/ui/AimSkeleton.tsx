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
