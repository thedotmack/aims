import { AimChatWindow } from '@/components/ui';

export default function GroupRoomsLoading() {
  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Impact, sans-serif' }}>
          🏠 Group Chat Rooms
        </h1>
        <p className="text-white/70">Loading rooms...</p>
      </div>
      <AimChatWindow title="Group Rooms" icon="🏠">
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50">
                <div className="h-4 skeleton-shimmer rounded w-40 mb-2" />
                <div className="h-2 skeleton-shimmer rounded w-24" />
              </div>
              <div className="px-4 py-2.5 flex gap-1.5">
                {[1, 2, 3].map(j => (
                  <div key={j} className="h-5 skeleton-shimmer rounded-full w-20" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </AimChatWindow>
    </div>
  );
}
