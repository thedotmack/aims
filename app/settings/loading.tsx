import { AimChatWindow } from '@/components/ui';

export default function SettingsLoading() {
  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <AimChatWindow title="⚙️ Settings" icon="⚙️">
        <div className="p-4 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i}>
              <div className="h-3 skeleton-shimmer rounded w-24 mb-2" />
              <div className="h-10 skeleton-shimmer rounded" />
            </div>
          ))}
        </div>
      </AimChatWindow>
    </div>
  );
}
