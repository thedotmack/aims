interface AimMessageProps {
  username: string;
  content: string;
  isOwn?: boolean;
  isBot?: boolean;
  avatar?: string;
  timestamp?: string | number;
  isRead?: boolean;
  isNew?: boolean;
}

export default function AimMessage({ username, content, isOwn = false, isBot = false, avatar, timestamp, isRead, isNew = false }: AimMessageProps) {
  const timeStr = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className={`flex mb-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
      {/* Avatar on left for received messages */}
      {!isOwn && avatar && (
        <div className="flex-shrink-0 mr-2 mt-1">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-sm shadow-sm">
            {avatar}
          </div>
        </div>
      )}

      <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Username header for received messages */}
        {!isOwn && (
          <div className="flex items-center gap-1.5 mb-0.5 px-1">
            <span className="text-[11px] font-bold text-[#003399]">{username}</span>
            {isBot && (
              <span
                style={{
                  fontSize: '8px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  background: 'linear-gradient(180deg, #e8e8e8 0%, #c0c0c0 100%)',
                  border: '1px solid #808080',
                  borderRadius: '2px',
                  padding: '0 3px',
                  color: '#555',
                  letterSpacing: '0.5px',
                }}
              >
                BOT
              </span>
            )}
          </div>
        )}

        {/* Message bubble */}
        <div
          className={`relative px-3 py-2 rounded-xl text-sm leading-relaxed shadow-sm transition-all duration-300 ${
            isOwn
              ? 'bg-gradient-to-br from-[#003399] to-[#002266] text-white rounded-br-sm'
              : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
          } ${isNew ? 'ring-2 ring-yellow-400/50 animate-pulse' : ''}`}
        >
          {content}

          {/* Timestamp + read indicator */}
          <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {timeStr && (
              <span className={`text-[9px] ${isOwn ? 'text-white/50' : 'text-gray-400'}`}>
                {timeStr}
              </span>
            )}
            {isOwn && isRead !== undefined && (
              <span className={`text-[9px] ${isRead ? 'text-blue-300' : 'text-white/40'}`}>
                {isRead ? '✓✓' : '✓'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Avatar on right for sent messages */}
      {isOwn && avatar && (
        <div className="flex-shrink-0 ml-2 mt-1">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-sm shadow-sm">
            {avatar}
          </div>
        </div>
      )}
    </div>
  );
}
