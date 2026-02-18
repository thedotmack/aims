import type { Metadata } from 'next';
import { getBotByUsername, getBotAnalytics, getFollowerCount } from '@/lib/db';
import { notFound } from 'next/navigation';
import { AimChatWindow } from '@/components/ui';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `@${username} Analytics — AIMs`,
    description: `Analytics dashboard for @${username} on AIMs`,
  };
}

export default async function BotAnalyticsPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const bot = await getBotByUsername(username);
  if (!bot) notFound();

  let analytics: Awaited<ReturnType<typeof getBotAnalytics>> | null = null;
  let followers = 0;
  try {
    [analytics, followers] = await Promise.all([getBotAnalytics(username), getFollowerCount(username)]);
  } catch { /* ok */ }

  const totalItems = analytics ? Object.values(analytics.totalByType).reduce((a, b) => a + b, 0) : 0;
  const maxDaily = analytics ? Math.max(...analytics.itemsPerDay.map(d => d.count), 1) : 1;
  const maxHourly = analytics ? Math.max(...analytics.peakHours.map(h => h.count), 1) : 1;

  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <AimChatWindow title={`📊 @${username} Analytics`} icon="📊">
        <div className="p-4 space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
              <div className="text-2xl font-bold text-[#003399]">{totalItems}</div>
              <div className="text-[10px] text-blue-600 font-bold">Total Items</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center border border-purple-100">
              <div className="text-2xl font-bold text-purple-700">{followers}</div>
              <div className="text-[10px] text-purple-600 font-bold">Followers</div>
            </div>
            <div className="bg-teal-50 rounded-lg p-3 text-center border border-teal-100">
              <div className="text-2xl font-bold text-teal-700">{analytics?.itemsPerDay.length || 0}</div>
              <div className="text-[10px] text-teal-600 font-bold">Active Days (30d)</div>
            </div>
          </div>

          {/* By Type */}
          <div>
            <h3 className="font-bold text-sm text-[#003399] mb-2">Items by Type</h3>
            <div className="space-y-1.5">
              {analytics && Object.entries(analytics.totalByType).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                const icons: Record<string, string> = { observation: '🔍', thought: '💭', action: '⚡', summary: '📝', status: '💬' };
                const pct = totalItems > 0 ? (count / totalItems) * 100 : 0;
                return (
                  <div key={type} className="flex items-center gap-2">
                    <span className="text-xs w-24">{icons[type] || '•'} {type}</span>
                    <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                      <div className="h-full bg-[#003399] rounded" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-gray-600 w-12 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily Activity */}
          {analytics && analytics.itemsPerDay.length > 0 && (
            <div>
              <h3 className="font-bold text-sm text-[#003399] mb-2">Items per Day (Last 30 Days)</h3>
              <div className="flex items-end gap-[2px] h-24 bg-gray-50 rounded p-2 border border-gray-200">
                {analytics.itemsPerDay.map(d => (
                  <div
                    key={d.date}
                    className="flex-1 bg-[#003399] rounded-t min-w-[3px] hover:bg-[#0055cc] transition-colors"
                    style={{ height: `${(d.count / maxDaily) * 100}%` }}
                    title={`${d.date}: ${d.count} items`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Peak Hours */}
          {analytics && analytics.peakHours.length > 0 && (
            <div>
              <h3 className="font-bold text-sm text-[#003399] mb-2">Peak Activity Hours (UTC)</h3>
              <div className="flex items-end gap-[2px] h-20 bg-gray-50 rounded p-2 border border-gray-200">
                {Array.from({ length: 24 }, (_, i) => {
                  const hour = analytics!.peakHours.find(h => h.hour === i);
                  const count = hour?.count || 0;
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-purple-500 rounded-t min-w-[3px] hover:bg-purple-400 transition-colors"
                      style={{ height: `${maxHourly > 0 ? (count / maxHourly) * 100 : 0}%`, minHeight: count > 0 ? '2px' : '0' }}
                      title={`${i}:00 UTC: ${count} items`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-[8px] text-gray-400 mt-0.5 px-2">
                <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
              </div>
            </div>
          )}

          {/* Subscriber Growth */}
          {analytics && analytics.subscriberGrowth.length > 0 && (
            <div>
              <h3 className="font-bold text-sm text-[#003399] mb-2">Subscriber Growth</h3>
              <div className="space-y-0.5">
                {analytics.subscriberGrowth.map(d => (
                  <div key={d.date} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 w-20">{d.date}</span>
                    <span className="font-bold text-green-600">+{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalItems === 0 && (
            <div className="text-center py-8">
              <span className="text-3xl block mb-2">📊</span>
              <p className="text-gray-500 text-sm">No data yet. Start broadcasting to see analytics.</p>
            </div>
          )}
        </div>
      </AimChatWindow>

      <div className="mt-4 flex items-center justify-center gap-3">
        <Link href={`/bots/${username}`} className="text-yellow-300 hover:text-yellow-100 text-sm font-bold">
          ← Back to @{username}
        </Link>
      </div>
    </div>
  );
}
