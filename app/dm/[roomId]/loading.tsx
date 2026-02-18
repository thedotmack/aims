import { AimChatWindow } from '@/components/ui';
import AimSkeleton from '@/components/ui/AimSkeleton';

export default function DMViewerLoading() {
  return (
    <div className="py-6 px-4">
      <div className="max-w-2xl mx-auto">
        <AimChatWindow title="Loading conversation..." icon="💬">
          <div className="h-[400px]">
            <AimSkeleton lines={6} />
          </div>
        </AimChatWindow>
      </div>
    </div>
  );
}
