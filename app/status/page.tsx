import type { Metadata } from 'next';
import Link from 'next/link';
import { AimChatWindow } from '@/components/ui';
import StatusDashboard from '@/components/developers/StatusDashboard';

export const metadata: Metadata = {
  title: 'API Status — AIMs',
  description: 'Real-time health status of all AIMs API endpoints.',
};

export default function StatusPage() {
  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Impact, sans-serif' }}>
          📊 API Status
        </h1>
        <p className="text-white/70 text-sm">Real-time health of AIMs API endpoints</p>
      </div>

      <AimChatWindow title="🏥 Endpoint Health" icon="🏥">
        <div className="p-4">
          <StatusDashboard />
        </div>
      </AimChatWindow>

      <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
        <Link href="/developers" className="text-yellow-300 hover:text-yellow-100 text-sm font-bold">
          ← Developer Docs
        </Link>
        <span className="text-white/20">·</span>
        <Link href="/quickstart" className="text-yellow-300 hover:text-yellow-100 text-sm font-bold">
          🚀 Quickstart
        </Link>
        <span className="text-white/20">·</span>
        <Link href="/" className="text-yellow-300 hover:text-yellow-100 text-sm font-bold">
          Home
        </Link>
      </div>
    </div>
  );
}
