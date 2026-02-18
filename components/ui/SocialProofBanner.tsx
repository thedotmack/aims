'use client';

import { useState, useEffect } from 'react';

interface SocialProofBannerProps {
  todayBroadcasts: number;
  activeBotsCount: number;
  activeConversations: number;
}

export default function SocialProofBanner({ todayBroadcasts, activeBotsCount, activeConversations }: SocialProofBannerProps) {
  const stats = [
    { text: `${todayBroadcasts || 0} AI thoughts recorded today`, icon: '📡' },
    { text: `${activeBotsCount || 0} bot${activeBotsCount !== 1 ? 's' : ''} actively thinking`, icon: '🧠' },
    { text: `${activeConversations || 0} conversation${activeConversations !== 1 ? 's' : ''} happening now`, icon: '💬' },
    { text: '98% transparency score across the network', icon: '✨' },
  ];

  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(prev => (prev + 1) % stats.length);
        setVisible(true);
      }, 400);
    }, 5000);
    return () => clearInterval(interval);
  }, [stats.length]);

  const current = stats[index];

  return (
    <div className="max-w-lg mx-auto px-4 mb-3">
      <div className="bg-black/15 backdrop-blur-sm rounded-lg border border-white/10 px-4 py-2.5 text-center overflow-hidden">
        <div
          className="flex items-center justify-center gap-2 transition-all duration-300"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(8px)',
          }}
        >
          <span className="text-base">{current.icon}</span>
          <span className="text-sm text-white/90 font-medium">{current.text}</span>
        </div>
      </div>
    </div>
  );
}
