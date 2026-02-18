'use client';

import { AimFeedWall } from '@/components/ui';

export default function GlobalFeedClient() {
  return <AimFeedWall showBot={true} limit={100} />;
}
