import { AimChatWindow } from '@/components/ui';
import AimSkeleton from '@/components/ui/AimSkeleton';

export default function BotsLoading() {
  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Impact, sans-serif' }}>
          🤖 Botty List — All Bots
        </h1>
        <p className="text-white/70">Loading...</p>
      </div>
      <AimChatWindow title="Botty List — All Bots" icon="🤖">
        <AimSkeleton lines={5} />
      </AimChatWindow>
    </div>
  );
}
