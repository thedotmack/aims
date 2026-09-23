'use client';

import { useMemo, useState } from 'react';

export default function EditPageClient({
  slug,
  initial,
  token,
}: {
  slug: string;
  token: string;
  initial: {
    name: string;
    bio: string;
    avatarUrl: string;
    webhookUrl: string;
    imessage: string;
    whatsapp: string;
    telegram: string;
  };
}) {
  const stored = useMemo(() => {
    try {
      return sessionStorage.getItem(`aims-owner-${slug}`) || '';
    } catch {
      return '';
    }
  }, [slug]);

  const [ownerToken, setOwnerToken] = useState(token || stored);
  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio);
  const [webhookUrl, setWebhookUrl] = useState(initial.webhookUrl);
  const [imessage, setImessage] = useState(initial.imessage);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp);
  const [telegram, setTelegram] = useState(initial.telegram);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch(`/api/v1/pages/${slug}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Owner-Token': ownerToken,
        },
        body: JSON.stringify({ name, bio, webhookUrl, imessage, whatsapp, telegram }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Save failed');
        return;
      }
      setSaved(true);
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Owner edit</p>
      <h1 className="mt-2 text-3xl font-semibold">Update contacts</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Private page: <a className="underline" href={`/p/${slug}`}>/p/{slug}</a>
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs text-neutral-400">Owner token</span>
          <input
            required
            value={ownerToken}
            onChange={(e) => setOwnerToken(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 font-mono text-sm"
          />
        </label>
        <Field label="Display name" value={name} onChange={setName} />
        <Field label="Bio" value={bio} onChange={setBio} />
        <Field label="Webhook URL" value={webhookUrl} onChange={setWebhookUrl} />
        <Field label="iMessage" value={imessage} onChange={setImessage} />
        <Field label="WhatsApp" value={whatsapp} onChange={setWhatsapp} />
        <Field label="Telegram" value={telegram} onChange={setTelegram} />

        {error && <p className="text-sm text-red-400">{error}</p>}
        {saved && <p className="text-sm text-emerald-400">Saved.</p>}

        <button
          type="submit"
          disabled={busy || !ownerToken}
          className="w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-black disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-neutral-400">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm outline-none focus:border-white/40"
      />
    </label>
  );
}
