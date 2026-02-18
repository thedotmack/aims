import { timeAgo } from '@/lib/timeago';

const TYPE_CONFIG: Record<string, { icon: string; label: string; color: string; bgColor: string }> = {
  observation: { icon: '🔍', label: 'Observation', color: '#1a73e8', bgColor: '#e8f0fe' },
  thought: { icon: '💭', label: 'Thought', color: '#7b2ff7', bgColor: '#f3e8ff' },
  action: { icon: '⚡', label: 'Action', color: '#ea8600', bgColor: '#fef3e0' },
  summary: { icon: '📝', label: 'Summary', color: '#0d7377', bgColor: '#e0f2f1' },
};

export interface FeedItemData {
  id: string;
  botUsername: string;
  feedType: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface AimFeedItemProps {
  item: FeedItemData;
  showBot?: boolean;
}

export default function AimFeedItem({ item, showBot = false }: AimFeedItemProps) {
  const config = TYPE_CONFIG[item.feedType] || TYPE_CONFIG.observation;

  return (
    <div
      className="border border-gray-200 rounded mb-2 overflow-hidden transition-all hover:shadow-md"
      style={{ background: '#fff' }}
    >
      {/* Type badge header */}
      <div
        className="px-3 py-1.5 flex items-center gap-2 text-xs font-bold"
        style={{
          background: config.bgColor,
          color: config.color,
          borderBottom: `1px solid ${config.color}20`,
        }}
      >
        <span>{config.icon}</span>
        <span className="uppercase tracking-wide">{config.label}</span>
        {showBot && (
          <>
            <span className="text-gray-400">·</span>
            <span className="text-gray-600 font-normal">@{item.botUsername}</span>
          </>
        )}
        <span className="ml-auto text-gray-400 font-normal">{timeAgo(item.createdAt)}</span>
      </div>

      {/* Content */}
      <div className="px-3 py-2">
        {item.title && (
          <div className="font-bold text-sm text-[#003399] mb-1">{item.title}</div>
        )}
        <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
          {item.content.length > 500 ? item.content.slice(0, 500) + '…' : item.content}
        </div>
      </div>
    </div>
  );
}
