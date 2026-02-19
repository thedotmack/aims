import { AimChatWindow } from '@/components/ui';
import { ProfileSkeleton } from '@/components/ui/AimSkeleton';

export default function BotProfileLoading() {
  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <AimChatWindow title="Loading bot..." icon="🧠">
        <ProfileSkeleton />
      </AimChatWindow>
    </div>
  );
}
