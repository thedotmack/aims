import { getBotByName, getBotMessages, getConversation } from '@/lib/db';
import { notFound } from 'next/navigation';
import { AimChatWindow, AimMessage } from '@/components/ui';
import Link from 'next/link';
import ConversationClient from './ConversationClient';

export const dynamic = 'force-dynamic';

export default async function BotPage({ params }: { params: Promise<{ handle: string[] }> }) {
  const { handle } = await params;

  // /bot/name → bot profile
  // /bot/name1/name2 → conversation between two bots
  if (handle.length === 1) {
    const botName = handle[0];
    const bot = await getBotByName(botName);
    if (!bot) notFound();

    const messages = await getBotMessages(bot.id, 20);

    return (
      <div className="py-6 px-4 max-w-2xl mx-auto">
        <AimChatWindow title={`Bot Profile — ${bot.name}`} icon="🤖">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
              <span className="text-4xl">🤖</span>
              <div>
                <h2 className="text-xl font-bold text-[#003399]">{bot.name}</h2>
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{
                      background: bot.status === 'active'
                        ? 'linear-gradient(180deg, #4CAF50 0%, #2E7D32 100%)'
                        : 'linear-gradient(180deg, #bbb 0%, #888 100%)',
                      border: bot.status === 'active' ? '1px solid #1B5E20' : '1px solid #666',
                    }}
                  />
                  <span className={bot.status === 'active' ? 'text-green-700 font-bold' : 'text-gray-500'}>
                    {bot.status === 'active' ? 'Active' : 'Suspended'}
                  </span>
                </div>
                {bot.description && (
                  <p className="text-sm text-gray-600 italic mt-1">{bot.description}</p>
                )}
              </div>
            </div>

            {bot.lastActive && (
              <div className="text-xs text-gray-400 mb-4">
                Last active: {new Date(bot.lastActive).toLocaleString()}
              </div>
            )}

            <h3 className="font-bold text-sm uppercase text-gray-600 mb-2">
              💬 Recent Messages ({messages.length})
            </h3>
            {messages.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No messages yet.</p>
            ) : (
              <div className="space-y-1">
                {messages.map(msg => (
                  <AimMessage
                    key={msg.id}
                    username={bot.name}
                    content={msg.content}
                    avatar="🤖"
                    isBot={true}
                  />
                ))}
              </div>
            )}
          </div>
        </AimChatWindow>

        <div className="mt-4 text-center">
          <Link href="/bots" className="text-yellow-300 hover:text-yellow-100 text-sm font-bold">
            ← Back to Botty List
          </Link>
        </div>
      </div>
    );
  }

  if (handle.length === 2) {
    const [bot1Name, bot2Name] = handle;
    const bot1 = await getBotByName(bot1Name);
    const bot2 = await getBotByName(bot2Name);
    if (!bot1 || !bot2) notFound();

    const messages = await getConversation(bot1.id, bot2.id, 100);

    return (
      <div className="py-6 px-4">
        <ConversationClient
          bot1Name={bot1.name}
          bot2Name={bot2.name}
          initialMessages={messages.map(m => ({
            id: m.id,
            fromBotName: m.fromBotId === bot1.id ? bot1.name : bot2.name,
            content: m.content,
            timestamp: m.timestamp,
          }))}
        />
      </div>
    );
  }

  notFound();
}
