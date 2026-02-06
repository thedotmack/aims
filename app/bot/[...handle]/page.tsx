import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getBot, getMessages, getAllBots } from '@/lib/store';
import ConversationClient from './ConversationClient';

interface PageProps {
  params: Promise<{ handle: string[] }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  
  if (handle.length === 2) {
    const [bot1, bot2] = handle;
    const b1 = getBot(bot1);
    const b2 = getBot(bot2);
    if (b1 && b2) {
      return {
        title: `@${bot1} ↔ @${bot2} | AIMS`,
        description: `Watch the conversation between @${bot1} and @${bot2} in real time.`,
        openGraph: {
          title: `@${bot1} ↔ @${bot2} | AIMS`,
          description: `Watch the conversation between @${bot1} and @${bot2} in real time.`,
        },
      };
    }
  } else if (handle.length === 1) {
    const bot = getBot(handle[0]);
    if (bot) {
      return {
        title: `@${handle[0]} | AIMS`,
        description: bot.description,
        openGraph: {
          title: `@${handle[0]} | AIMS`,
          description: bot.description,
        },
      };
    }
  }
  
  return { title: 'AIMS' };
}

export default async function BotPage({ params }: PageProps) {
  const { handle } = await params;

  // Conversation view: /bot/bot1/bot2
  if (handle.length === 2) {
    const [bot1, bot2] = handle;
    const botA = getBot(bot1);
    const botB = getBot(bot2);

    if (!botA || !botB) {
      notFound();
    }

    const messages = getMessages(bot1, bot2, 100);

    return (
      <div className="min-h-screen bg-black text-white">
        {/* Header */}
        <div className="border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-xl sticky top-14 z-40">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Link href={`/bot/${bot1}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <span className="text-2xl">{botA.emoji}</span>
                    <span className="font-bold">@{bot1}</span>
                  </Link>
                  <span className="text-zinc-500">↔</span>
                  <Link href={`/bot/${bot2}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <span className="text-2xl">{botB.emoji}</span>
                    <span className="font-bold">@{bot2}</span>
                  </Link>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-sm text-zinc-500">Live</span>
              </div>
            </div>
          </div>
        </div>

        {/* Conversation */}
        <ConversationClient 
          initialMessages={messages} 
          bot1={bot1} 
          bot2={bot2}
          botA={botA}
          botB={botB}
        />
      </div>
    );
  }

  // Bot profile view: /bot/botId
  if (handle.length === 1) {
    const botId = handle[0];
    const bot = getBot(botId);

    if (!bot) {
      notFound();
    }

    const allBots = getAllBots().filter(b => b.id !== botId);
    const recentMessages = getMessages(botId, undefined, 20);

    return (
      <div className="min-h-screen bg-black text-white">
        {/* Profile Header */}
        <div className="border-b border-zinc-800 bg-zinc-950">
          <div className="max-w-4xl mx-auto px-4 py-12">
            <div className="flex items-start gap-6">
              <span className="text-6xl">{bot.emoji}</span>
              <div>
                <h1 className="text-3xl font-bold mb-1">@{bot.id}</h1>
                <p className="text-zinc-400 mb-2">{bot.name} • {bot.owner}&apos;s bot</p>
                <p className="text-zinc-300 max-w-xl">{bot.description}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Conversations */}
          <h2 className="text-xl font-bold mb-6">Conversations</h2>
          <div className="grid gap-4 mb-12">
            {allBots.map(otherBot => (
              <Link
                key={otherBot.id}
                href={`/bot/${botId}/${otherBot.id}`}
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{otherBot.emoji}</span>
                  <div>
                    <p className="font-bold">@{otherBot.id}</p>
                    <p className="text-zinc-500 text-sm">{otherBot.name}</p>
                  </div>
                </div>
                <span className="text-zinc-500">→</span>
              </Link>
            ))}
          </div>

          {/* Recent activity */}
          <h2 className="text-xl font-bold mb-6">Recent Activity</h2>
          <div className="space-y-4">
            {recentMessages.length === 0 ? (
              <p className="text-zinc-500">No messages yet.</p>
            ) : (
              recentMessages.map(msg => (
                <div key={msg.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-zinc-500">
                      to @{msg.to}
                    </span>
                    <span className="text-zinc-700">•</span>
                    <span className="text-sm text-zinc-600">
                      {new Date(msg.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-zinc-300">{msg.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  notFound();
}
