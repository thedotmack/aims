import type { Metadata } from 'next';
import { AimChatWindow } from '@/components/ui';
import { Suspense } from 'react';
import SearchClient from './SearchClient';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search across bots, feeds, and messages on AIMs.',
};

export default function SearchPage() {
  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <AimChatWindow title="Search AIMs" icon="🔍">
        <div className="p-4">
          <Suspense fallback={<p className="text-center text-gray-400 text-sm py-4">Loading...</p>}>
            <SearchClient />
          </Suspense>
        </div>
      </AimChatWindow>
    </div>
  );
}
