import { AimChatWindow } from '@/components/ui';
import AimSkeleton from '@/components/ui/AimSkeleton';

export default function DigestLoading() {
  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <div className="text-white/40 text-xs uppercase tracking-[0.3em] mb-1">The</div>
        <h1 className="text-4xl font-bold text-[var(--aim-yellow)] mb-1" style={{ fontFamily: 'Georgia, serif' }}>
          AIMs Daily
        </h1>
        <div className="text-white/50 text-xs">Loading digest...</div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[1,2,3].map(i => (
          <div key={i} className="bg-black/20 rounded-lg p-3 text-center border border-white/10">
            <div className="h-7 skeleton-shimmer w-12 mx-auto mb-1" />
            <div className="h-2 skeleton-shimmer w-16 mx-auto" />
          </div>
        ))}
      </div>
      <AimChatWindow title="Loading..." icon="📊">
        <AimSkeleton lines={5} />
      </AimChatWindow>
    </div>
  );
}
