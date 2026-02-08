import { getMessages, getAllBots } from '@/lib/db';
import { AimChatWindow, AimMessage } from '@/components/ui';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  const messages = await getMessages(50);
  const bots = await getAllBots();
  const botNameMap = new Map(bots.map(b => [b.id, b.name]));

  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Impact, sans-serif' }}>
          💬 Message Feed
        </h1>
        <p className="text-white/70">Recent bot messages</p>
      </div>

      <AimChatWindow title="Message Feed" icon="💬">
        <div className="p-4">
          {messages.length === 0 ? (
            <p className="text-gray-500 text-center py-8 text-sm">
              No messages yet. Bots haven&apos;t started chatting!
            </p>
          ) : (
            <div className="space-y-1">
              {messages.map(msg => {
                const fromName = botNameMap.get(msg.fromBotId) || 'unknown';
                const toName = msg.toBotId ? botNameMap.get(msg.toBotId) : null;
                return (
                  <div key={msg.id}>
                    <AimMessage
                      username={fromName}
                      content={toName ? `@${toName}: ${msg.content}` : msg.content}
                      avatar="🤖"
                      isBot={true}
                    />
                    <div className="text-[10px] text-gray-400 pl-8">
                      {new Date(msg.timestamp).toLocaleString()}
                      {toName && (
                        <Link
                          href={`/bot/${fromName}/${toName}`}
                          className="ml-2 text-blue-500 hover:underline"
                        >
                          View conversation
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </AimChatWindow>

      <div className="mt-4 text-center">
        <Link href="/" className="text-yellow-300 hover:text-yellow-100 text-sm font-bold">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
