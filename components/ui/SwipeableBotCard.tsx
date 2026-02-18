'use client';

import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface SwipeableBotCardProps {
  children: ReactNode;
  username: string;
  onCompare?: (username: string) => void;
  showHint?: boolean;
}

export default function SwipeableBotCard({ children, username, onCompare, showHint }: SwipeableBotCardProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isHorizontalRef = useRef<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    setIsMobile(window.innerWidth < 640);
  }, []);

  const threshold = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    isHorizontalRef.current = null;
    setSwiping(true);
  }, [isMobile]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping) return;
    const dx = e.touches[0].clientX - startXRef.current;
    const dy = e.touches[0].clientY - startYRef.current;

    // Determine direction on first significant move
    if (isHorizontalRef.current === null) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        isHorizontalRef.current = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }

    if (!isHorizontalRef.current) return;

    // Dampen the swipe
    setOffsetX(dx * 0.6);
  }, [swiping]);

  const handleTouchEnd = useCallback(() => {
    if (!swiping) return;
    setSwiping(false);

    if (offsetX > threshold) {
      // Swipe right → view profile
      router.push(`/bots/${username}`);
    } else if (offsetX < -threshold && onCompare) {
      // Swipe left → compare
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
      onCompare(username);
    }

    setOffsetX(0);
    isHorizontalRef.current = null;
  }, [swiping, offsetX, threshold, username, router, onCompare]);

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <div className="relative overflow-hidden rounded-lg" style={{ touchAction: 'pan-y' }}>
      {/* Background actions */}
      {offsetX > 20 && (
        <div className="swipe-card-action swipe-card-action-right" style={{ opacity: Math.min(1, offsetX / threshold) }}>
          <span>👁️ View</span>
        </div>
      )}
      {offsetX < -20 && (
        <div className="swipe-card-action swipe-card-action-left" style={{ opacity: Math.min(1, Math.abs(offsetX) / threshold) }}>
          <span>⚔️ Compare</span>
        </div>
      )}
      <div
        className={`relative bg-white ${showHint ? 'swipe-hint-animate' : ''}`}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: swiping ? 'none' : 'transform 0.3s ease',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
