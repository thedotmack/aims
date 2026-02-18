'use client';

import { useState } from 'react';

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 px-2 py-1 bg-gray-700 text-gray-300 text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-600"
    >
      {copied ? '✅ Copied' : '📋 Copy'}
    </button>
  );
}
