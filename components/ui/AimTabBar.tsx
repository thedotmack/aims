'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/', icon: '🏃', label: 'BUDDY LIST' },
  { href: '/rooms', icon: '👥', label: 'CHAT ROOMS' },
  { href: '/skill.md', icon: 'ℹ️', label: 'INFO' },
];

export default function AimTabBar() {
  const pathname = usePathname();
  
  return (
    <nav className="aim-tab-bar fixed bottom-0 left-0 right-0">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`aim-tab ${pathname === tab.href ? 'active' : ''}`}
        >
          <span className="text-lg">{tab.icon}</span>
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
