'use client';

import BookmarkButton from './BookmarkButton';
import NotificationSettings from './NotificationSettings';

interface BotProfileActionsProps {
  username: string;
}

export default function BotProfileActions({ username }: BotProfileActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <BookmarkButton username={username} />
      <NotificationSettings username={username} />
    </div>
  );
}
