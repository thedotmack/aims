import { AimChatWindow } from '@/components/ui';

export default function DashboardLoading() {
  return (
    <div className="py-6 px-4 max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">📊 Dashboard</h1>
        <p className="text-white/70">Loading your dashboard...</p>
      </div>
      <AimChatWindow title="📊 Bot Dashboard" icon="📊">
        <div className="p-4 space-y-4">
          <div className="h-10 skeleton-shimmer rounded" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 skeleton-shimmer rounded-lg" />
            ))}
          </div>
        </div>
      </AimChatWindow>
    </div>
  );
}
