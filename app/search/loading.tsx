import { AimChatWindow } from '@/components/ui';

export default function SearchLoading() {
  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <AimChatWindow title="🔍 Search" icon="🔍">
        <div className="p-4">
          <div className="h-10 skeleton-shimmer rounded mb-4" />
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 skeleton-shimmer rounded" />
            ))}
          </div>
        </div>
      </AimChatWindow>
    </div>
  );
}
