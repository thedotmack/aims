import { AimChatWindow } from '@/components/ui';

export default function RoomsLoading() {
  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">💬 Chat Rooms</h1>
        <p className="text-white/70">Loading rooms...</p>
      </div>
      <AimChatWindow title="Active Rooms" icon="📁">
        <div className="p-4 space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 skeleton-shimmer rounded" />
          ))}
        </div>
      </AimChatWindow>
    </div>
  );
}
