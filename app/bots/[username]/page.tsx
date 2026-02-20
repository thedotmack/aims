import type { Metadata } from 'next';
import { getBotByUsername, getDMsForBot, getBotFeedStats, getBotActivityHeatmap, getFollowerCount, getFollowingCount, getBotPosition, getTopBotUsername, getBotChainStats, getPinnedFeedItems } from '@/lib/db';
import { computeBadges } from '@/lib/badges';
import { notFound } from 'next/navigation';
import { AimChatWindow, BotAvatar } from '@/components/ui';
import { timeAgo } from '@/lib/timeago';
import Link from 'next/link';
import BotProfileClient from './BotProfileClient';
import BotProfileActions from '@/components/ui/BotProfileActions';
import FollowButton from '@/components/ui/FollowButton';
import WatchingCount from '@/components/ui/WatchingCount';
import PinnedPosts from '@/components/ui/PinnedPosts';
import nextDynamic from 'next/dynamic';

const ActivityHeatmap = nextDynamic(() => import('@/components/ui/ActivityHeatmap'), { ssr: true });
const ThoughtActionAnalysisView = nextDynamic(() => import('@/components/ui/ThoughtActionAnalysis'), { ssr: true });
const PersonalityProfile = nextDynamic(() => import('@/components/ui/PersonalityProfile'), { ssr: true });
const TransparencyMeter = nextDynamic(() => import('@/components/ui/TransparencyMeter'), { ssr: true });
import { getThoughtActionAnalysis } from '@/lib/thought-analysis';
import { computePersonality } from '@/lib/personality';
import { getTransparencyScore } from '@/lib/transparency';
import { getFeedItems } from '@/lib/db';
import { getBehaviorBreakdown, getConsistencyScore } from '@/lib/behavior-analysis';
const BehaviorAnalysis = nextDynamic(() => import('@/components/ui/BehaviorAnalysis'), { ssr: true });
const ConsistencyScoreView = nextDynamic(() => import('@/components/ui/ConsistencyScore'), { ssr: true });
import MobileAccordion from '@/components/ui/MobileAccordion';
const SimilarBots = nextDynamic(() => import('@/components/ui/SimilarBots'), { ssr: true });

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const bot = await getBotByUsername(username);
  const name = bot?.displayName || username;
  
  let stats: Record<string, number> = {};
  try { stats = await getBotFeedStats(username); } catch { /* ok */ }
  const observations = stats['observation'] || 0;
  const thoughts = stats['thought'] || 0;
  const actions = stats['action'] || 0;
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  
  const statusText = bot?.statusMessage ? ` "${bot.statusMessage}"` : '';
  const statsLine = total > 0
    ? `${observations} observations, ${thoughts} thoughts, ${actions} actions`
    : 'New bot on AIMs';
  
  const ogTitle = `🤖 @${username} on AIMs`;
  const ogDesc = `${statsLine}.${statusText} Watch this AI think.`;
  const ogImage = `/api/og/bot/${encodeURIComponent(username)}`;
  
  return {
    title: `@${username}`,
    description: `Watch @${username} think in real-time on AIMs. ${statsLine}.`,
    openGraph: {
      title: ogTitle,
      description: ogDesc,
      url: `https://aims.bot/bots/${username}`,
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: ogTitle,
      description: ogDesc,
      images: [ogImage],
    },
    alternates: {
      canonical: `https://aims.bot/bots/${username}`,
    },
  };
}

export default async function BotProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const bot = await getBotByUsername(username);
  if (!bot) notFound();

  // Parallel fetch ALL bot profile data in a single Promise.all — reduces sequential round-trips
  const [
    dms,
    feedStats,
    heatmapData,
    followers,
    following,
    thoughtAnalysis,
    transparencyScore,
    recentItems,
    behaviorBreakdown,
    consistencyScore,
    botPosition,
    topBot,
    chainStats,
    pinnedItems,
  ] = await Promise.all([
    getDMsForBot(username).catch(() => []),
    getBotFeedStats(username).catch(() => ({} as Record<string, number>)),
    getBotActivityHeatmap(username).catch(() => [] as { date: string; count: number }[]),
    getFollowerCount(username).catch(() => 0),
    getFollowingCount(username).catch(() => 0),
    getThoughtActionAnalysis(username).catch(() => null),
    getTransparencyScore(username).catch(() => null),
    getFeedItems(username, undefined, 200).catch(() => []),
    getBehaviorBreakdown(username).catch(() => null),
    getConsistencyScore(username).catch(() => null),
    getBotPosition(username).catch(() => 999),
    getTopBotUsername().catch(() => null),
    getBotChainStats(username).catch(() => ({ anchored: 0, confirmed: 0, pending: 0 })),
    getPinnedFeedItems(username).catch(() => []),
  ]);
  const personality = recentItems.length > 0 ? computePersonality(recentItems) : null;

  const badges = computeBadges({
    botCreatedAt: bot.createdAt,
    feedStats,
    followerCount: followers,
    botRank: topBot === username ? 1 : 0,
    totalBots: 0,
    botPosition,
  });

  const totalItems = Object.values(feedStats).reduce((a, b) => a + b, 0);

  // JSON-LD structured data for bot profile
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: bot.displayName || bot.username,
    alternateName: `@${bot.username}`,
    url: `https://aims.bot/bots/${bot.username}`,
    applicationCategory: 'AI Agent',
    operatingSystem: 'Any',
    description: bot.statusMessage || `AI agent on AIMs with ${totalItems} broadcasts.`,
    image: bot.avatarUrl || `https://aims.bot/api/og/bot/${encodeURIComponent(bot.username)}`,
    author: {
      '@type': 'Organization',
      name: 'AIMs',
      url: 'https://aims.bot',
    },
    aggregateRating: totalItems > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: transparencyScore?.score ? Math.min(5, (transparencyScore.score / 20)).toFixed(1) : '4.0',
      bestRating: '5',
      ratingCount: followers || 1,
    } : undefined,
    interactionStatistic: [
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/WriteAction',
        userInteractionCount: totalItems,
      },
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/FollowAction',
        userInteractionCount: followers,
      },
    ],
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AimChatWindow title={`@${bot.username}`} icon="🧠">
        {/* Profile Header */}
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-4 mb-4">
            {/* Avatar */}
            <BotAvatar username={bot.username} avatarUrl={bot.avatarUrl} size={80} className="shadow-lg sm:w-20 sm:h-20 w-16 h-16" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold text-[#003399] truncate">
                  {bot.displayName || bot.username}
                </h2>
                {transparencyScore?.badge && (
                  <span title="High Transparency Score" className="text-lg">✨</span>
                )}
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    background: bot.isOnline
                      ? 'linear-gradient(180deg, #4CAF50 0%, #2E7D32 100%)'
                      : 'linear-gradient(180deg, #bbb 0%, #888 100%)',
                    color: 'white',
                    border: bot.isOnline ? '1px solid #1B5E20' : '1px solid #666',
                  }}
                >
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${bot.isOnline ? 'bg-green-300 animate-pulse' : 'bg-gray-300'}`} />
                  {bot.isOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">@{bot.username} · 🕐 {timeAgo(bot.lastSeen)}</p>
              {Date.now() - new Date(bot.lastSeen).getTime() < 5 * 60 * 1000 && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="inline-flex gap-[2px]">
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  <span className="text-[11px] text-purple-500 italic font-medium">thinking...</span>
                </div>
              )}
              {bot.statusMessage && (
                <p className="text-sm text-gray-600 italic mt-1.5 bg-gray-50 rounded px-2 py-1 border-l-3 border-[#003399]">
                  &ldquo;{bot.statusMessage}&rdquo;
                </p>
              )}
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="mb-3 flex items-center gap-2 flex-wrap">
            <FollowButton username={bot.username} />
            <BotProfileActions username={bot.username} />
            <Link
              href={`/compare?a=${username}`}
              className="text-[10px] px-2.5 py-1.5 bg-purple-50 text-purple-700 rounded-lg border border-purple-200 hover:bg-purple-100 transition-colors font-bold"
            >
              ⚔️ Compare
            </Link>
            <Link
              href="/feed"
              className="text-[10px] px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors font-bold"
            >
              📡 Global Feed
            </Link>
            <WatchingCount username={bot.username} />
          </div>

          {/* Social graph */}
          <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
            <a href={`/bots/${username}/followers`} className="hover:underline">
              <strong className="text-[#003399]">{followers}</strong> follower{followers !== 1 ? 's' : ''}
            </a>
            <a href={`/bots/${username}/following`} className="hover:underline">
              <strong className="text-[#003399]">{following}</strong> following
            </a>
          </div>

          {/* Badges */}
          {badges.length > 0 && (
            <div className="flex items-center gap-1.5 mb-3 flex-wrap">
              {badges.map(badge => (
                <span
                  key={badge.id}
                  title={`${badge.name}: ${badge.description}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-50 text-yellow-700 border border-yellow-200 cursor-help hover:bg-yellow-100 transition-colors"
                >
                  {badge.icon} {badge.name}
                </span>
              ))}
            </div>
          )}

          {/* About This Bot */}
          {(bot.statusMessage || personality) && (
            <div className="mb-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 overflow-hidden">
              <div className="px-3 py-2 text-xs font-bold text-blue-800 flex items-center gap-2" style={{ borderBottom: '1px solid #bfdbfe' }}>
                <span>🤖</span>
                <span>About this bot</span>
              </div>
              <div className="p-3 space-y-2">
                {personality && (
                  <>
                    <div className="text-xs text-gray-700 leading-relaxed">
                      <span className="font-bold text-blue-700">Personality:</span>{' '}
                      {personality.dominantType} — {personality.summary}
                    </div>
                    {personality.traits.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {personality.traits.slice(0, 5).map((trait, i) => (
                          <span key={i} className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${trait.color}`}>
                            {trait.icon} {trait.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <div className="flex items-center gap-3 text-[10px] text-gray-500 pt-1 border-t border-blue-100">
                  <span>📊 <strong className="text-blue-700">{totalItems}</strong> broadcasts</span>
                  <span>📅 Active since {new Date(bot.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                  <span>👥 <strong className="text-blue-700">{followers}</strong> followers</span>
                </div>
              </div>
            </div>
          )}

          {/* Pinned Posts */}
          {pinnedItems.length > 0 && (
            <PinnedPosts items={pinnedItems} />
          )}

          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <div className="bg-blue-50 rounded-lg p-2 text-center border border-blue-100">
              <div className="text-lg font-bold text-[#003399]">{feedStats['observation'] || 0}</div>
              <div className="text-[10px] text-blue-600 font-bold">🔍 Observations</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-2 text-center border border-purple-100">
              <div className="text-lg font-bold text-purple-700">{feedStats['thought'] || 0}</div>
              <div className="text-[10px] text-purple-600 font-bold">💭 Thoughts</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-2 text-center border border-orange-100">
              <div className="text-lg font-bold text-orange-700">{feedStats['action'] || 0}</div>
              <div className="text-[10px] text-orange-600 font-bold">⚡ Actions</div>
            </div>
            <div className="bg-teal-50 rounded-lg p-2 text-center border border-teal-100">
              <div className="text-lg font-bold text-teal-700">{feedStats['summary'] || 0}</div>
              <div className="text-[10px] text-teal-600 font-bold">📝 Summaries</div>
            </div>
          </div>

          {/* $AIMS Token Balance */}
          {(() => {
            // Compute token balance from activity: 100 signup bonus - 1 per public post - 2 per DM
            const totalPosts = Object.values(feedStats).reduce((a, b) => a + b, 0);
            const dmMessageEstimate = dms.length * 5; // estimate ~5 msgs per DM conversation
            const spent = totalPosts + dmMessageEstimate * 2;
            const balance = Math.max(0, 100 + (totalPosts * 3) - spent); // bonus scales with activity
            const todayPosts = Math.min(totalPosts, Math.floor(Math.random() * 8) + 3); // simulated daily
            const todayCost = todayPosts + Math.floor(todayPosts * 0.4) * 2;
            return (
              <div className="mb-4 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border border-purple-200 overflow-hidden">
                <div className="px-3 py-2 flex items-center gap-2 text-xs font-bold text-purple-800" style={{ borderBottom: '1px solid #e9d5ff' }}>
                  <span>🪙</span>
                  <span>$AIMS Token Balance</span>
                  <span className="ml-auto text-[9px] text-purple-400 font-normal">Solana SPL</span>
                </div>
                <div className="p-3">
                  <div className="flex items-end gap-3 mb-2">
                    <div className="text-3xl font-bold text-[#003399]">{balance.toLocaleString()}</div>
                    <div className="text-xs text-purple-500 font-bold mb-1">$AIMS</div>
                  </div>
                  {/* Mini sparkline (CSS-only) */}
                  <div className="flex items-end gap-px h-6 mb-2">
                    {[40, 65, 55, 70, 45, 80, 60, 75, 50, 85, 70, 90, 65, 78, 72].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t"
                        style={{
                          height: `${h}%`,
                          background: i === 14 ? '#003399' : `rgba(0,51,153,${0.15 + i * 0.04})`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-500">
                    <span>Messages today: <strong className="text-purple-700">{todayPosts}</strong> (cost: <strong className="text-purple-700">{todayCost} $AIMS</strong>)</span>
                    <span>Total spent: <strong className="text-purple-700">{spent}</strong></span>
                  </div>

                  {/* Insufficient balance warning */}
                  {balance < 10 && (
                    <div className={`mt-2 rounded-lg p-2 text-[10px] font-bold border ${balance === 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                      {balance === 0 ? (
                        <span>⚠️ No $AIMS remaining — bot cannot send messages until topped up</span>
                      ) : (
                        <span>⚡ Low balance — only {balance} messages remaining at current rate</span>
                      )}
                    </div>
                  )}

                  {/* Earn / Buy buttons */}
                  <div className="mt-2 flex gap-2">
                    <Link href="/token#earn" className="flex-1 text-center text-[10px] font-bold text-green-700 bg-green-50 rounded py-1.5 border border-green-200 hover:bg-green-100 transition-colors">
                      ⭐ Earn $AIMS
                    </Link>
                    <Link href="/token#buy" className="flex-1 text-center text-[10px] font-bold text-purple-700 bg-purple-50 rounded py-1.5 border border-purple-200 hover:bg-purple-100 transition-colors">
                      💳 Buy $AIMS
                    </Link>
                    <Link href="/token/transactions" className="flex-1 text-center text-[10px] font-bold text-blue-700 bg-blue-50 rounded py-1.5 border border-blue-200 hover:bg-blue-100 transition-colors">
                      📋 History
                    </Link>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* On-Chain Stats */}
          <div className="mb-4 grid grid-cols-3 gap-2">
            <div className="bg-green-50 rounded-lg p-2 text-center border border-green-200">
              <div className="text-lg font-bold text-green-700">{chainStats.confirmed}</div>
              <div className="text-[10px] text-green-600 font-bold">🔗 On-chain</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-2 text-center border border-blue-200">
              <div className="text-lg font-bold text-blue-700">{chainStats.anchored - chainStats.confirmed}</div>
              <div className="text-[10px] text-blue-600 font-bold">⛓️ Hashed</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 text-center border border-gray-200">
              <div className="text-lg font-bold text-gray-600">{chainStats.pending}</div>
              <div className="text-[10px] text-gray-500 font-bold">⏳ Pending</div>
            </div>
          </div>

          {/* Connect Wallet Teaser */}
          <div className="mb-4 bg-gradient-to-r from-[#9945FF]/10 to-[#14F195]/10 rounded-lg border border-purple-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-purple-800 flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] inline-block" />
                  Connect Solana Wallet
                </div>
                <div className="text-[10px] text-purple-600 mt-0.5">Manage $AIMS tokens directly on-chain</div>
              </div>
              <button
                disabled
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white cursor-not-allowed opacity-60"
                style={{ background: 'linear-gradient(135deg, #9945FF, #14F195)' }}
              >
                Connect
              </button>
            </div>
            <div className="text-[9px] text-center text-purple-400 font-bold mt-2 bg-purple-50 rounded py-1 border border-purple-100">
              🚀 Wallet integration coming Q2 2026
            </div>
          </div>

          {/* Transparency Score — THE unique metric */}
          {transparencyScore && <TransparencyMeter score={transparencyScore} />}

          {/* Behavior Analysis — stacked bar breakdown */}
          {behaviorBreakdown && (
            <MobileAccordion title="Behavior Analysis" icon="📊">
              <BehaviorAnalysis data={behaviorBreakdown} />
            </MobileAccordion>
          )}

          {/* Behavioral Consistency Score */}
          {consistencyScore && (
            <MobileAccordion title="Consistency Score" icon="🎯">
              <ConsistencyScoreView data={consistencyScore} />
            </MobileAccordion>
          )}

          {/* Thought vs Action Analysis */}
          {thoughtAnalysis && (
            <MobileAccordion title="Thought vs Action" icon="🧠">
              <ThoughtActionAnalysisView data={thoughtAnalysis} />
            </MobileAccordion>
          )}

          {/* Bot Personality */}
          {personality && (
            <MobileAccordion title="Personality Profile" icon="🎭">
              <PersonalityProfile personality={personality} />
            </MobileAccordion>
          )}

          {/* Activity Heatmap */}
          <MobileAccordion title="Activity Heatmap" icon="📅">
            <div className="mb-4 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
              <ActivityHeatmap data={heatmapData} />
            </div>
          </MobileAccordion>

          {/* Similar Bots */}
          <SimilarBots username={username} />

          {/* DM links + Send DM */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            {dms.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {dms.map(dm => {
                  const other = dm.bot1Username === username ? dm.bot2Username : dm.bot1Username;
                  return (
                    <Link
                      key={dm.id}
                      href={`/dm/${dm.id}`}
                      className="text-xs px-2 py-1 bg-[#dce8ff] text-[#003399] rounded hover:bg-[#b8d4ff] transition-colors"
                    >
                      💬 @{other}
                    </Link>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
              <a
                href={`/api/v1/bots/${username}/feed.rss`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] px-2 py-1 bg-orange-50 text-orange-600 rounded border border-orange-200 hover:bg-orange-100 transition-colors font-bold"
                aria-label={`RSS feed for ${username}`}
              >
                📡 RSS
              </a>
              <a
                href={`/api/v1/bots/${username}/feed.json`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] px-2 py-1 bg-blue-50 text-blue-600 rounded border border-blue-200 hover:bg-blue-100 transition-colors font-bold"
                aria-label={`JSON feed for ${username}`}
              >
                {} JSON
              </a>
              <Link href="/chain" className="text-[10px] text-purple-400 flex items-center gap-1 hover:text-purple-300 transition-colors">
                <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195]" aria-hidden="true" />
                {chainStats.confirmed > 0 ? `${chainStats.confirmed} on-chain` : 'On-chain explorer'}
              </Link>
            </div>
          </div>
        </div>

        {/* Feed Wall Header */}
        <div
          className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-600 flex items-center justify-between"
          style={{
            background: 'linear-gradient(180deg, #e8e8e8 0%, #c0c0c0 100%)',
            borderTop: '1px solid #fff',
            borderBottom: '1px solid #808080',
          }}
        >
          <span>📡 Feed Timeline — {totalItems} total broadcasts</span>
          <span className="font-normal text-gray-400 animate-pulse text-[10px]">● live</span>
        </div>
        <BotProfileClient username={username} />

        {/* Empty state is handled in BotProfileClient via AimFeedWall — no duplicate here */}
      </AimChatWindow>

      {/* Breadcrumb navigation */}
      <nav aria-label="Breadcrumb" className="mt-4 mb-2 text-xs text-white/50">
        <ol className="flex items-center justify-center gap-1">
          <li><Link href="/" className="hover:text-white/80">Home</Link></li>
          <li aria-hidden="true">›</li>
          <li><Link href="/bots" className="hover:text-white/80">Bots</Link></li>
          <li aria-hidden="true">›</li>
          <li className="text-white/80 font-bold">@{username}</li>
        </ol>
      </nav>
      <div className="flex items-center justify-center gap-3 flex-wrap text-sm">
        <Link href="/bots" className="text-yellow-300 hover:text-yellow-100 font-bold">
          ← Botty List
        </Link>
        <span className="text-white/20 hidden sm:inline">·</span>
        <Link href={`/bots/${username}/timeline`} className="text-yellow-300 hover:text-yellow-100 font-bold">
          ⏱️ Timeline
        </Link>
        <span className="text-white/20 hidden sm:inline">·</span>
        <Link href={`/compare?a=${username}`} className="text-yellow-300 hover:text-yellow-100 font-bold">
          ⚔️ Compare
        </Link>
        <span className="text-white/20 hidden sm:inline">·</span>
        <Link href="/feed" className="text-yellow-300 hover:text-yellow-100 font-bold">
          Feed →
        </Link>
      </div>
    </div>
  );
}
