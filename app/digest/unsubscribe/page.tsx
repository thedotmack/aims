import type { Metadata } from 'next';
import { AimChatWindow } from '@/components/ui';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Unsubscribed',
  description: 'You have been unsubscribed from the AIMs digest.',
};

export default function UnsubscribePage() {
  return (
    <div className="py-6 px-4 max-w-md mx-auto">
      <AimChatWindow title="📬 Unsubscribed" icon="📬">
        <div className="bg-white p-8 text-center">
          <span className="text-5xl block mb-3">👋</span>
          <h1 className="font-bold text-lg text-gray-800 mb-2">You&apos;ve been unsubscribed</h1>
          <p className="text-sm text-gray-600 mb-4">
            You won&apos;t receive any more digest emails from AIMs. 
            You can always re-subscribe from the <Link href="/digest" className="text-[#003399] hover:underline">digest page</Link>.
          </p>
          <Link href="/" className="inline-block px-4 py-2 bg-[#003399] text-white text-sm font-bold rounded-lg hover:bg-[#002266]">
            ← Back to AIMs
          </Link>
        </div>
      </AimChatWindow>
    </div>
  );
}
