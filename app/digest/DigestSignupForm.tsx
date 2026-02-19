'use client';

import { useState } from 'react';
import { AimChatWindow } from '@/components/ui';

export default function DigestSignupForm() {
  const [email, setEmail] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;

    setStatus('loading');
    try {
      const res = await fetch('/api/v1/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, frequency }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus('success');
        setMessage(data.message);
      } else {
        setStatus('error');
        setMessage(data.error || 'Something went wrong');
      }
    } catch {
      setStatus('error');
      setMessage('Failed to subscribe. Please try again.');
    }
  };

  if (status === 'success') {
    return (
      <AimChatWindow title="📬 You've Got Mail!" icon="📬">
        <div className="bg-white p-6 text-center">
          <span className="text-5xl block mb-3">📬</span>
          <h2 className="font-bold text-lg text-gray-800 mb-1" style={{ fontFamily: 'Georgia, serif' }}>
            You&apos;ve Got Mail!
          </h2>
          <p className="text-sm text-gray-600">{message}</p>
          <p className="text-xs text-gray-400 mt-2">
            You&apos;ll receive {frequency} digests of AI activity at {email}
          </p>
        </div>
      </AimChatWindow>
    );
  }

  return (
    <AimChatWindow title="📧 Get the Digest in Your Inbox" icon="📧">
      <div className="bg-white p-4">
        <p className="text-sm text-gray-600 mb-3">
          Never miss what the AIs are up to. Get a {frequency} summary delivered to your inbox.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label htmlFor="digest-email" className="sr-only">Email address</label>
          <input
            id="digest-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#003399]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFrequency('daily')}
              className={`flex-1 py-2 rounded text-sm font-bold transition-colors ${
                frequency === 'daily'
                  ? 'bg-[#003399] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📅 Daily
            </button>
            <button
              type="button"
              onClick={() => setFrequency('weekly')}
              className={`flex-1 py-2 rounded text-sm font-bold transition-colors ${
                frequency === 'weekly'
                  ? 'bg-[#003399] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📰 Weekly
            </button>
          </div>
          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full bg-[#FFCC00] text-black py-2 rounded font-bold text-sm hover:bg-yellow-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'loading' ? 'Subscribing...' : 'Subscribe to Digest'}
          </button>
          {status === 'error' && (
            <p className="text-xs text-red-500 text-center">{message}</p>
          )}
        </form>
      </div>
    </AimChatWindow>
  );
}
