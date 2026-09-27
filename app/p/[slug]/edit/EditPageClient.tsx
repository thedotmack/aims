'use client';

import { useMemo, useState } from 'react';

export default function EditPageClient({
  slug,
  initial,
  token,
  discord,
  handleHint,
}: {
  slug: string;
  token: string;
  handleHint: string;
  discord: { guildId: string; channelId: string; handle: string } | null;
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
  const [discordState, setDiscordState] = useState(discord);
  const [installUrl, setInstallUrl] = useState('');
  const [claimCode, setClaimCode] = useState('');
  const [discordBusy, setDiscordBusy] = useState(false);
  const [discordError, setDiscordError] = useState('');

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

        <div className="rounded-3xl border border-white/10 bg-neutral-950 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Discord</p>
          {discordState ? (
            <div className="mt-3 space-y-1 text-sm">
              <p>Connected as <code>@aims {discordState.handle}</code></p>
              <p className="text-neutral-400">Guild {discordState.guildId} · channel {discordState.channelId}</p>
              <p className="text-neutral-500">People mention <code>@aims {discordState.handle}</code> — not a fake @{discordState.handle} user.</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-400">
              Add the shared <code>aims</code> bot. Mentions look like <code>@aims {handleHint.toLowerCase()}</code>.
            </p>
          )}
          <button
            type="button"
            disabled={discordBusy || !ownerToken}
            onClick={async () => {
              setDiscordBusy(true);
              setDiscordError('');
              try {
                const res = await fetch(`/api/v1/pages/${slug}/connect`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Owner-Token': ownerToken,
                  },
                  body: JSON.stringify({ channels: ['discord'] }),
                });
                const data = await res.json();
                if (!res.ok) {
                  setDiscordError(data.error || 'Could not mint Discord install link');
                  return;
                }
                setClaimCode(data.claim || '');
                setInstallUrl(data.discord?.installUrl || '');
                if (data.discord?.installUrl) window.open(data.discord.installUrl, '_blank', 'noopener');
              } catch {
                setDiscordError('Network error');
              } finally {
                setDiscordBusy(false);
              }
            }}
            className="mt-4 w-full rounded-full border border-white/20 px-5 py-3 text-sm font-semibold disabled:opacity-40"
          >
            {discordBusy ? 'Preparing…' : discordState ? 'Re-add to Discord' : 'Add to Discord'}
          </button>
          {installUrl && (
            <p className="mt-3 break-all text-xs text-neutral-400">
              Authorize URL ready. Backup claim: <code>{claimCode}</code>
            </p>
          )}
          {discordError && <p className="mt-2 text-sm text-red-400">{discordError}</p>}
        </div>

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
