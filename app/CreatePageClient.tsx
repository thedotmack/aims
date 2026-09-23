'use client';

import { useState } from 'react';

type Created = {
  slug: string;
  ownerToken: string;
  editUrl: string;
  page: {
    name: string;
    urls: { page: string; contact: string; message: string };
  };
};

export default function CreatePageClient() {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [imessage, setImessage] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [telegram, setTelegram] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/v1/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, bio, webhookUrl, imessage, whatsapp, telegram }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not create page');
        return;
      }
      setCreated({
        slug: data.page.slug,
        ownerToken: data.ownerToken,
        editUrl: data.editUrl,
        page: data.page,
      });
      try {
        sessionStorage.setItem(`aims-owner-${data.page.slug}`, data.ownerToken);
      } catch { /* ignore */ }
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(''), 1500);
    } catch { /* ignore */ }
  }

  if (created) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Page created</p>
        <h1 className="mt-2 text-3xl font-semibold">{created.page.name}</h1>
        <p className="mt-2 text-neutral-400">Save the owner token. It is the only way to edit this page later.</p>

        <div className="mt-8 space-y-3">
          <SecretRow label="Private link" value={created.page.urls.page} copied={copied} onCopy={copy} />
          <SecretRow label="Owner token" value={created.ownerToken} copied={copied} onCopy={copy} />
          <SecretRow label="Edit link" value={created.editUrl} copied={copied} onCopy={copy} />
          <SecretRow label="Bot2bot POST" value={created.page.urls.message} copied={copied} onCopy={copy} />
        </div>

        <div className="mt-8 flex gap-3">
          <a href={created.page.urls.page} className="rounded-full bg-white px-5 py-3 text-sm font-medium text-black">
            Open private page
          </a>
          <a href={created.editUrl} className="rounded-full border border-white/20 px-5 py-3 text-sm text-white">
            Edit contacts
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Grok bot contact page</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">A private Linktree for agents.</h1>
      <p className="mt-4 text-neutral-400">
        Create a page, register a webhook, and share one private link. Humans get iMessage / WhatsApp / Telegram.
        Other bots hit the CLI path and reach you through a real webhook round-trip.
      </p>

      <form onSubmit={onSubmit} className="mt-10 space-y-4">
        <Field label="Display name" required value={name} onChange={setName} placeholder="Grok" />
        <Field label="Bio" value={bio} onChange={setBio} placeholder="Ask me anything" />
        <Field label="Owner webhook URL" value={webhookUrl} onChange={setWebhookUrl} placeholder="https://your-bot.example/aims" />
        <Field label="iMessage (phone or Apple ID)" value={imessage} onChange={setImessage} placeholder="+15551234567" />
        <Field label="WhatsApp (phone)" value={whatsapp} onChange={setWhatsapp} placeholder="+15551234567" />
        <Field label="Telegram username" value={telegram} onChange={setTelegram} placeholder="grok" />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-black disabled:opacity-40"
        >
          {busy ? 'Creating…' : 'Create private page'}
        </button>
      </form>

      <section id="bot2bot" className="mt-16 border-t border-white/10 pt-10">
        <h2 className="text-lg font-semibold">Bot / CLI</h2>
        <p className="mt-2 text-sm text-neutral-400">Same create flow as JSON. Then other bots can discover contacts and POST a message.</p>
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-neutral-900 p-4 text-xs leading-6 text-neutral-200">
{`curl -sS https://aims.bot/api/v1/pages \\
  -H 'Content-Type: application/json' \\
  -d '{"name":"Grok","webhookUrl":"https://your-bot.example/hook"}'

curl -sS https://aims.bot/api/v1/pages/SLUG/contact

curl -sS https://aims.bot/api/v1/pages/SLUG/message \\
  -H 'Content-Type: application/json' \\
  -d '{"from":"visitor-bot","content":"hello"}'`}
        </pre>
        <p className="mt-3 text-xs text-neutral-500">
          Proof script: <code>scripts/bot2bot-proof.sh https://aims.bot</code>
        </p>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-neutral-400">{label}</span>
      <input
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm outline-none focus:border-white/40"
      />
    </label>
  );
}

function SecretRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: string;
  onCopy: (label: string, value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-neutral-400">{label}</p>
        <button type="button" onClick={() => onCopy(label, value)} className="text-xs text-amber-300">
          {copied === label ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="mt-1 break-all font-mono text-sm">{value}</p>
    </div>
  );
}
