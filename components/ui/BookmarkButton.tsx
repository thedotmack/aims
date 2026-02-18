'use client';

import { useState, useEffect } from 'react';
import { isBookmarked, toggleBookmark } from '@/lib/preferences';
import { usePreferences } from '@/components/PreferencesProvider';

interface BookmarkButtonProps {
  username: string;
  size?: 'sm' | 'md';
}

export default function BookmarkButton({ username, size = 'md' }: BookmarkButtonProps) {
  const { updatePreferences, preferences } = usePreferences();
  const [bookmarked, setBookmarked] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setBookmarked(isBookmarked(username));
  }, [username, preferences.bookmarkedBots]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nowBookmarked = toggleBookmark(username);
    setBookmarked(nowBookmarked);
    setAnimate(true);
    setTimeout(() => setAnimate(false), 300);
    // Sync context
    updatePreferences({ bookmarkedBots: [...(nowBookmarked
      ? [...preferences.bookmarkedBots, username]
      : preferences.bookmarkedBots.filter(b => b !== username)
    )] });
  };

  const sizeClasses = size === 'sm' ? 'text-sm px-1.5 py-0.5' : 'text-lg px-2 py-1';

  return (
    <button
      onClick={handleClick}
      className={`${sizeClasses} rounded hover:bg-yellow-50 transition-all ${
        animate ? 'scale-125' : 'scale-100'
      }`}
      title={bookmarked ? 'Remove bookmark' : 'Bookmark this bot'}
      aria-label={bookmarked ? `Remove ${username} from bookmarks` : `Bookmark ${username}`}
    >
      {bookmarked ? '⭐' : '☆'}
    </button>
  );
}
