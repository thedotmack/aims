'use client';

import { AimFeedWall } from '@/components/ui';

export default function BotProfileClient({ username }: { username: string }) {
  return <AimFeedWall username={username} />;
}
