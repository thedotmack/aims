'use client';

import { useState, useEffect } from 'react';

const FOLLOWS_KEY = 'aims-subscriptions';

function getSessionFollows(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(FOLLOWS_KEY) || '[]');
  } catch { return []; }
}

function setSessionFollows(follows: string[]) {
  localStorage.setItem(FOLLOWS_KEY, JSON.stringify(follows));
}

export default function FollowButton({ username, apiKey }: { username: string; apiKey?: string }) {
  const [following, setFollowing] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    const follows = getSessionFollows();
    setFollowing(follows.includes(username));
    // Fetch current count
    fetch(`/api/v1/bots/${encodeURIComponent(username)}/subscribe`)
      .then(r => r.json())
      .then(d => { if (d.followers != null) setCount(d.followers); })
      .catch(() => {});
  }, [username]);

  const toggle = async () => {
    if (toggling) return;
    setToggling(true);
    const follows = getSessionFollows();
    const isNowFollowing = !following;

    // Optimistic update
    if (isNowFollowing) {
      setSessionFollows([...follows, username]);
      setCount(c => (c ?? 0) + 1);
    } else {
      setSessionFollows(follows.filter(f => f !== username));
      setCount(c => Math.max(0, (c ?? 1) - 1));
    }
    setFollowing(isNowFollowing);

    // Call server API if we have an API key
    if (apiKey) {
      try {
        const res = await fetch(`/api/v1/bots/${encodeURIComponent(username)}/subscribe`, {
          method: isNowFollowing ? 'POST' : 'DELETE',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await res.json();
        if (data.followers != null) setCount(data.followers);
        if (!res.ok) {
          // Revert optimistic update on failure
          if (isNowFollowing) {
            setSessionFollows(follows);
            setCount(c => Math.max(0, (c ?? 1) - 1));
          } else {
            setSessionFollows([...follows, username]);
            setCount(c => (c ?? 0) + 1);
          }
          setFollowing(!isNowFollowing);
        }
      } catch {
        // Silently keep optimistic state on network error
      }
    }

    // Haptic
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    setToggling(false);
  };

  return (
    <button
      onClick={toggle}
      disabled={toggling}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-70"
      style={{
        background: following
          ? 'linear-gradient(180deg, #e8e8e8 0%, #c0c0c0 100%)'
          : 'linear-gradient(180deg, #003399 0%, #002266 100%)',
        color: following ? '#333' : 'white',
        border: following ? '1px solid #999' : '1px solid #001a4d',
      }}
    >
      {following ? '✓ Following' : '+ Follow'}
      {count != null && (
        <span className="text-[10px] opacity-70">{count}</span>
      )}
    </button>
  );
}
