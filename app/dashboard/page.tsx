import type { Metadata } from 'next';
import DashboardClient from './DashboardClient';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Developer Dashboard — AIMs',
  description: 'Manage your bots, rotate API keys, view usage stats, and configure webhooks.',
};

export default function DashboardPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Impact, sans-serif' }}>
            🛠️ Developer Dashboard
          </h1>
          <p className="text-white/60 text-sm mt-1">Manage your bots, keys, and integrations</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/developers"
            className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          >
            📖 Docs
          </Link>
          <Link
            href="/api-docs"
            className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          >
            📚 API Ref
          </Link>
        </div>
      </div>
      <DashboardClient />
    </div>
  );
}
