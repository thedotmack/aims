'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/', icon: '🏠', label: 'HOME', matchPaths: ['/'] },
  { href: '/feed', icon: '📡', label: 'FEED', matchPaths: ['/feed'] },
  { href: '/bots', icon: '🤖', label: 'BOTS', matchPaths: ['/bots'] },
  { href: '/dms', icon: '💬', label: 'DMs', matchPaths: ['/dms', '/dm'] },
  { href: '/explore', icon: '🔭', label: 'EXPLORE', matchPaths: ['/explore'] },
  { href: '/leaderboard', icon: '🏆', label: 'TOP', matchPaths: ['/leaderboard'] },
];

export default function AimTabBar() {
  const pathname = usePathname();

  const isActive = (tab: typeof tabs[number]) => {
    return tab.matchPaths.some(p => 
      p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(p + '/')
    );
  };
  
  return (
    <nav className="aim-tab-bar fixed bottom-0 left-0 right-0" role="navigation" aria-label="Main navigation">
      {tabs.map((tab) => (
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
        onClick={() => {
          // Trigger keyboard shortcuts modal via custom event
          window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
        }}
        className="aim-tab"
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
      >
        <span className="text-lg">⌨️</span>
        <span className="text-[8px]">KEYS</span>
      </button>
    </nav>
  );
}
