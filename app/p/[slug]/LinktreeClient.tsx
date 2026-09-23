'use client';

import { useState } from 'react';
import type { PublicContactPage } from '@/lib/contact-pages';

const ICONS: Record<string, string> = {
  imessage: '💬',
  whatsapp: '🟢',
  telegram: '✈️',
  cli: '⌘',
};

export default function LinktreeClient({ page }: { page: PublicContactPage }) {
  const [cliOpen, setCliOpen] = useState(false);
  const [from, setFrom] = useState('visitor-bot');
  const [content, setContent] = useState('hello from aims.bot');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const initial = (page.name.trim()[0] || 'A').toUpperCase();

  const humanContacts = page.contacts.filter((c) => c.kind === 'deeplink');
  const cli = page.contacts.find((c) => c.id === 'cli');

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult('');
    try {
      const res = await fetch(page.urls.message, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, content }),
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setResult(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center px-4 py-16 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-neutral-700 text-3xl font-semibold text-black">
        {page.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={page.avatarUrl} alt="" className="h-24 w-24 rounded-full object-cover" />
        ) : (
          initial
        )}
      </div>
      <h1 className="mt-6 text-2xl font-semibold">{page.name}</h1>
      {page.bio && <p className="mt-2 text-sm text-neutral-400">{page.bio}</p>}

      <div className="mt-10 w-full space-y-3">
        {humanContacts.map((c) => (
          <a
            key={c.id}
            href={c.href}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-neutral-900 px-5 py-4 text-sm font-medium hover:bg-neutral-800"
          >
            <span>{ICONS[c.id]}</span>
            {c.label}
          </a>
        ))}

        {cli && (
          <button
            type="button"
            onClick={() => setCliOpen((v) => !v)}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-4 text-sm font-semibold text-black"
          >
            <span>{ICONS.cli}</span>
            {cli.label}
            {!cli.available && <span className="text-xs font-normal text-neutral-500"> (webhook not set)</span>}
          </button>
        )}
      </div>

      {cliOpen && (
        <div className="mt-6 w-full rounded-3xl border border-white/10 bg-neutral-900 p-5 text-left">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Bot2bot</p>
          <pre className="mt-3 overflow-x-auto text-xs leading-6 text-neutral-200">
{`curl -sS ${page.urls.message} \\
  -H 'Content-Type: application/json' \\
  -d '{"from":"visitor-bot","content":"hello"}'`}
          </pre>
          <p className="mt-3 text-xs text-neutral-500">
            Discover: <code>{page.urls.contact}</code>
          </p>

          <form onSubmit={sendMessage} className="mt-5 space-y-3">
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm"
              placeholder="your bot name"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm"
              rows={3}
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
            >
              {busy ? 'Sending…' : 'Send test message'}
            </button>
          </form>
          {result && (
            <pre className="mt-3 overflow-x-auto text-xs text-amber-100">{result}</pre>
          )}
        </div>
      )}
    </div>
  );
}
