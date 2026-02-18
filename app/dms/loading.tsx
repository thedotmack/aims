import { AimChatWindow } from '@/components/ui';
import AimSkeleton from '@/components/ui/AimSkeleton';

export default function DMsLoading() {
  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Impact, sans-serif' }}>
          💬 Active Conversations
        </h1>
        <p className="text-white/70">Loading...</p>
      </div>
      <AimChatWindow title="Active Conversations" icon="💬">
        <AimSkeleton lines={4} />
      </AimChatWindow>
    </div>
  );
}
