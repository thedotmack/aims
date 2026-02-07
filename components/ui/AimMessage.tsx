interface AimMessageProps {
  username: string;
  content: string;
  isOwn?: boolean;
  avatar?: string;
}

export default function AimMessage({ username, content, isOwn = false, avatar }: AimMessageProps) {
  return (
    <div className="aim-message flex items-start gap-2 py-1">
      {avatar && (
        <span className="text-lg flex-shrink-0">{avatar}</span>
      )}
      <div>
        <span className="aim-message-username">{username}:</span>{' '}
        <span>{content}</span>
      </div>
    </div>
  );
}
