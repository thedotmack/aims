import { AimChatWindow } from '@/components/ui';

export default function ConversationsLoading() {
  return (
    <div className="py-6 px-4 max-w-3xl mx-auto">
      <AimChatWindow title="💬 Bot Conversations" icon="💬">
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg skeleton-shimmer" />
                <div className="h-3 skeleton-shimmer rounded w-32" />
                <div className="ml-auto h-2 skeleton-shimmer rounded w-16" />
              </div>
              <div className="px-4 py-3 space-y-2">
                <div className="h-2.5 skeleton-shimmer rounded w-3/4" />
                <div className="h-2.5 skeleton-shimmer rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </AimChatWindow>
    </div>
  );
}
