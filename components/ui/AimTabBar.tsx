'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const primaryTabs = [
  { href: '/', icon: '🏠', label: 'HOME', matchPaths: ['/'] },
  { href: '/feed', icon: '📡', label: 'FEED', matchPaths: ['/feed'] },
  { href: '/bots', icon: '🤖', label: 'BOTS', matchPaths: ['/bots'] },
];

const secondaryTabs = [
  { href: '/dms', icon: '💬', label: 'DMs', matchPaths: ['/dms', '/dm'] },
  { href: '/explore', icon: '🔭', label: 'EXPLORE', matchPaths: ['/explore'] },
  { href: '/leaderboard', icon: '🏆', label: 'TOP', matchPaths: ['/leaderboard'] },
  { href: '/digest', icon: '📰', label: 'DIGEST', matchPaths: ['/digest'] },
];

const allTabs = [...primaryTabs, ...secondaryTabs];

export default function AimTabBar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (tab: { matchPaths: string[] }) => {
    return tab.matchPaths.some(p =>
      p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(p + '/')
    );
  };

  const secondaryActive = secondaryTabs.some(t => isActive(t));

  return (
    <>
      {/* More menu overlay */}
      {moreOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute bottom-16 right-2 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {secondaryTabs.map(tab => (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => setMoreOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-bold transition-colors ${
                  isActive(tab) ? 'bg-blue-50 text-[#003399]' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Desktop: show all tabs */}
      <nav className="aim-tab-bar fixed bottom-0 left-0 right-0 hidden sm:flex" role="navigation" aria-label="Main navigation">
        {allTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`aim-tab ${isActive(tab) ? 'active' : ''}`}
            aria-current={isActive(tab) ? 'page' : undefined}
            aria-label={tab.label}
          >
            <span className="text-lg">{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        ))}
      </nav>

      {/* Mobile: 3 primary + More button */}
      <nav className="aim-tab-bar fixed bottom-0 left-0 right-0 flex sm:hidden" role="navigation" aria-label="Main navigation">
        {primaryTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`aim-tab ${isActive(tab) ? 'active' : ''}`}
            aria-current={isActive(tab) ? 'page' : undefined}
            aria-label={tab.label}
          >
            <span className="text-lg">{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        ))}
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          className={`aim-tab ${secondaryActive ? 'active' : ''}`}
          aria-label="More"
        >
          <span className="text-lg">{moreOpen ? '✕' : '•••'}</span>
          <span>MORE</span>
        </button>
      </nav>
    </>
  );
}
