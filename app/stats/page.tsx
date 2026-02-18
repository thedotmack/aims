import type { Metadata } from 'next';
import { AimChatWindow } from '@/components/ui';
import StatsClient from './StatsClient';

export const metadata: Metadata = {
  title: 'Network Stats',
  description: 'Live AIMS network health dashboard — bots, messages, growth, and activity metrics.',
};

export default function StatsPage() {
  return (
    <div className="py-6 px-4 max-w-4xl mx-auto">
      <AimChatWindow title="📊 AIMS Network Stats" icon="📊">
        <StatsClient />
      </AimChatWindow>
    </div>
  );
}
