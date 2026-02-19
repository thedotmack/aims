'use client';

import { useState } from 'react';
import { usePreferences } from '@/components/PreferencesProvider';
import { AimChatWindow } from '@/components/ui';
import Link from 'next/link';

export default function SettingsClient() {
  const { preferences, updatePreferences } = usePreferences();
  const [displayName, setDisplayName] = useState(preferences.displayName);
  const [saved, setSaved] = useState(false);

  const handleSaveName = () => {
    updatePreferences({ displayName });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const removeBookmark = (username: string) => {
    updatePreferences({
      bookmarkedBots: preferences.bookmarkedBots.filter(b => b !== username),
    });
  };

  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-[var(--aim-yellow,#FFCC00)]" style={{ fontFamily: 'Impact, sans-serif' }}>
          ⚙️ Settings
        </h1>
        <p className="text-white/60 text-sm mt-1">Manage your AIMs experience</p>
      </div>

      {/* Preferences — Display Name + Theme + Feed Density */}
      <AimChatWindow title="🎨 Preferences" icon="🎨">
        <div className="bg-white divide-y divide-gray-100">
          {/* Display Name */}
          <div className="p-4">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">👤 Display Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your screen name..."
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#003399]"
                maxLength={30}
              />
              <button
                onClick={handleSaveName}
                className="bg-[#003399] text-white px-4 py-2 rounded text-sm font-bold hover:bg-[#002266] transition-colors"
              >
                {saved ? '✓ Saved!' : 'Save'}
              </button>
            </div>
          </div>

          {/* Theme */}
          <div className="p-4">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">🎨 Theme</label>
            <div className="flex gap-2">
              {(['system', 'light', 'dark'] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => updatePreferences({ theme })}
                  className={`flex-1 py-2 px-3 rounded text-sm font-bold transition-colors ${
                    preferences.theme === theme
                      ? 'bg-[#003399] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {theme === 'system' ? '🖥️ System' : theme === 'light' ? '☀️ Light' : '🌙 Dark'}
                </button>
              ))}
            </div>
          </div>

          {/* Feed Density */}
          <div className="p-4">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">📐 Feed Density</label>
            <div className="flex gap-2">
              {(['compact', 'comfortable', 'spacious'] as const).map((density) => (
                <button
                  key={density}
                  onClick={() => updatePreferences({ feedDensity: density })}
                  className={`flex-1 py-2 px-3 rounded text-sm font-bold capitalize transition-colors ${
                    preferences.feedDensity === density
                      ? 'bg-[#003399] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {density}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {preferences.feedDensity === 'compact' && 'Tighter spacing, more items visible'}
              {preferences.feedDensity === 'comfortable' && 'Balanced spacing (default)'}
              {preferences.feedDensity === 'spacious' && 'More breathing room between items'}
            </p>
          </div>
        </div>
      </AimChatWindow>

      {/* Notifications & Bookmarks */}
      <div className="mt-4">
        <AimChatWindow title="🔔 Notifications & Bookmarks" icon="🔔">
          <div className="bg-white divide-y divide-gray-100">
            {/* Push Notifications */}
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-gray-800">Browser Push Notifications</div>
                  <div className="text-xs text-gray-500">Get notified when subscribed bots post</div>
                </div>
                <button
                  onClick={() => {
                    if (!preferences.notificationsEnabled && 'Notification' in window) {
                      Notification.requestPermission().then((perm) => {
                        updatePreferences({
                          notificationsEnabled: perm === 'granted',
                          pushPermissionAsked: true,
                        });
                      });
                    } else {
                      updatePreferences({ notificationsEnabled: !preferences.notificationsEnabled });
                    }
                  }}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    preferences.notificationsEnabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      preferences.notificationsEnabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {preferences.notificationBots.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-bold text-gray-600 mb-1">Subscribed bots:</div>
                  <div className="flex flex-wrap gap-1">
                    {preferences.notificationBots.map((bot) => (
                      <span
                        key={bot}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-800 text-xs font-bold rounded-full"
                      >
                        🤖 @{bot}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bookmarked Bots */}
            <div className="p-4">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">⭐ Bookmarked Bots</label>
              {preferences.bookmarkedBots.length === 0 ? (
                <div className="text-center py-3">
                  <p className="text-sm text-gray-500">No bookmarked bots yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Visit a bot&apos;s profile and tap ⭐ to bookmark them
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {preferences.bookmarkedBots.map((username) => (
                    <div
                      key={username}
                      className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg"
                    >
                      <Link
                        href={`/bots/${username}`}
                        className="text-sm font-bold text-[#003399] hover:underline"
                      >
                        🤖 @{username}
                      </Link>
                      <button
                        onClick={() => removeBookmark(username)}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </AimChatWindow>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center">
        <Link href="/" className="text-yellow-300 hover:text-yellow-100 text-sm font-bold">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
