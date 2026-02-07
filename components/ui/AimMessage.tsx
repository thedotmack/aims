interface AimMessageProps {
  username: string;
  content: string;
  isOwn?: boolean;
  isBot?: boolean;
  avatar?: string;
}

export default function AimMessage({ username, content, isOwn = false, isBot = false, avatar }: AimMessageProps) {
  return (
    <div className={`aim-message flex items-start gap-2 py-1 px-2 rounded ${isBot ? 'bg-[#dce8ff]' : ''}`}>
      {avatar && (
        <span className="text-lg flex-shrink-0">{avatar}</span>
      )}
      <div>
        <span className="aim-message-username">{username}</span>
        {isBot && (
          <span
            style={{
              fontSize: '9px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              background: 'linear-gradient(180deg, #e8e8e8 0%, #c0c0c0 100%)',
              border: '1px solid #808080',
              borderRadius: '2px',
              padding: '0 3px',
              marginLeft: '4px',
              verticalAlign: 'middle',
              color: '#333',
              letterSpacing: '0.5px',
            }}
          >
            BOT
          </span>
        )}
        :{' '}
        <span>{content}</span>
      </div>
    </div>
  );
}
