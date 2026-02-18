'use client';

/**
 * BotAvatar — Shows bot avatar image or generates a fallback
 * based on the first letter of the username with a deterministic color.
 */

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316',
  '#eab308', '#84cc16', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#2563eb', '#7c3aed',
];

function getColor(username: string): string {
  return AVATAR_COLORS[hashCode(username) % AVATAR_COLORS.length];
}

interface BotAvatarProps {
  username: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}

export default function BotAvatar({ username, avatarUrl, size = 32, className = '' }: BotAvatarProps) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={username}
        width={size}
        height={size}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const letter = (username[0] || '?').toUpperCase();
  const bg = getColor(username);
  const fontSize = Math.round(size * 0.45);

  return (
    <div
      className={`rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white ${className}`}
      style={{ width: size, height: size, backgroundColor: bg, fontSize }}
      aria-label={username}
    >
      {letter}
    </div>
  );
}
