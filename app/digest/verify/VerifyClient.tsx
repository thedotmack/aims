'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AimChatWindow } from '@/components/ui';

export default function VerifyClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'already' | 'error'>('loading');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }

    fetch(`/api/v1/digest/verify?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setEmail(data.email || '');
          setStatus(data.alreadyVerified ? 'already' : 'success');
        } else {
          setStatus('error');
        }
      })
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="min-h-screen bg-[#1e1b4b] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {status === 'loading' && (
          <AimChatWindow title="⏳ Verifying..." icon="⏳">
            <div className="bg-white p-6 text-center">
              <p className="text-gray-600">Verifying your email...</p>
            </div>
          </AimChatWindow>
        )}

        {status === 'success' && (
          <AimChatWindow title="✅ Verified!" icon="✅">
            <div className="bg-white p-6 text-center">
              <span className="text-5xl block mb-3">✅</span>
              <h2 className="font-bold text-lg text-gray-800 mb-1" style={{ fontFamily: 'Georgia, serif' }}>
                Email Verified!
              </h2>
              <p className="text-sm text-gray-600">
                {email ? `${email} is now verified.` : 'Your email is now verified.'} You&apos;ll receive the AIMs digest.
              </p>
              <a
                href="/digest"
                className="inline-block mt-4 bg-[#FFCC00] text-black px-6 py-2 rounded font-bold text-sm hover:bg-yellow-300 transition-colors"
              >
                View Today&apos;s Digest →
              </a>
            </div>
          </AimChatWindow>
        )}

        {status === 'already' && (
          <AimChatWindow title="👍 Already Verified" icon="👍">
            <div className="bg-white p-6 text-center">
              <span className="text-5xl block mb-3">👍</span>
              <h2 className="font-bold text-lg text-gray-800 mb-1" style={{ fontFamily: 'Georgia, serif' }}>
                Already Verified!
              </h2>
              <p className="text-sm text-gray-600">
                {email ? `${email} was already verified.` : 'Your email was already verified.'} You&apos;re all set!
              </p>
              <a
                href="/digest"
                className="inline-block mt-4 bg-[#FFCC00] text-black px-6 py-2 rounded font-bold text-sm hover:bg-yellow-300 transition-colors"
              >
                View Today&apos;s Digest →
              </a>
            </div>
          </AimChatWindow>
        )}

        {status === 'error' && (
          <AimChatWindow title="❌ Verification Failed" icon="❌">
            <div className="bg-white p-6 text-center">
              <span className="text-5xl block mb-3">❌</span>
              <h2 className="font-bold text-lg text-gray-800 mb-1" style={{ fontFamily: 'Georgia, serif' }}>
                Invalid or Expired Link
              </h2>
              <p className="text-sm text-gray-600">
                This verification link is invalid or has already been used. Please subscribe again to get a new verification email.
              </p>
              <a
                href="/digest"
                className="inline-block mt-4 bg-[#FFCC00] text-black px-6 py-2 rounded font-bold text-sm hover:bg-yellow-300 transition-colors"
              >
                Subscribe Again →
              </a>
            </div>
          </AimChatWindow>
        )}
      </div>
    </div>
  );
}
