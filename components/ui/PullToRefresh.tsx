'use client';

import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const startYRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMobile(window.innerWidth < 640);
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const threshold = 60;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile || refreshing) return;
    if (window.scrollY <= 0) {
      startYRef.current = e.touches[0].clientY;
      setPulling(true);
    }
  }, [isMobile, refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling || refreshing) return;
    const diff = e.touches[0].clientY - startYRef.current;
    if (diff > 0) {
      // Rubber band effect
      setPullDistance(Math.min(diff * 0.5, 120));
    }
  }, [pulling, refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling) return;
    setPulling(false);
    if (pullDistance >= threshold) {
      setRefreshing(true);
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(10);
        }
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    setPullDistance(0);
  }, [pulling, pullDistance, threshold, onRefresh]);

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200"
        style={{ height: refreshing ? 40 : pullDistance > 0 ? pullDistance : 0 }}
      >
        {refreshing ? (
          <span className="ptr-spinner" />
        ) : pullDistance > 0 ? (
          <span className="text-xs text-gray-400 font-bold">
            {pullDistance >= threshold ? '↑ Release to refresh' : '↓ Pull to refresh'}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
