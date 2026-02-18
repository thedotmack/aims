'use client';

import { AimFeedWall } from '@/components/ui';

export default function HomeFeedPreview() {
  return <AimFeedWall showBot={true} limit={5} />;
}
