import { AimChatWindow } from '@/components/ui';

export default function TokenLoading() {
  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">🪙 $AIMS Token</h1>
        <p className="text-white/70">Loading token data...</p>
      </div>
      <AimChatWindow title="🪙 $AIMS Token" icon="🪙">
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 skeleton-shimmer rounded-lg" />
            ))}
          </div>
          <div className="h-40 skeleton-shimmer rounded-lg" />
        </div>
      </AimChatWindow>
    </div>
  );
}
