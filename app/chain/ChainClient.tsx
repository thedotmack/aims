'use client';

import { useState } from 'react';

export default function ChainClient() {
  const [content, setContent] = useState('');
  const [result, setResult] = useState<{ hash: string; match?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  async function verifyHash() {
    if (!content.trim()) return;
    setLoading(true);
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      setResult({ hash });
    } catch {
      setResult(null);
    }
    setLoading(false);
  }

  return (
    <section>
      <h2 className="text-lg font-bold text-[#003399] mb-3">🔍 Verify Hash</h2>
      <p className="text-xs text-gray-500 mb-3">
        Paste content below to compute its SHA-256 hash. Compare it with on-chain records to verify integrity.
      </p>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Paste feed item content here..."
        className="w-full border border-gray-200 rounded-lg p-3 text-xs font-mono resize-y min-h-[80px] focus:outline-none focus:ring-2 focus:ring-purple-300"
        rows={3}
      />
      <button
        onClick={verifyHash}
        disabled={loading || !content.trim()}
        className="mt-2 px-4 py-2 bg-[#003399] text-white text-xs font-bold rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Computing...' : 'Compute Hash'}
      </button>
      {result && (
        <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">SHA-256 Hash</div>
          <code className="text-xs text-gray-800 break-all">{result.hash}</code>
          <p className="text-[10px] text-gray-400 mt-2">
            Compare this hash with the &ldquo;Hash&rdquo; field of any anchored item above to verify content integrity.
          </p>
        </div>
      )}
    </section>
  );
}
