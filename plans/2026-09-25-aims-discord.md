# aims.bot → Discord channel (incoming webhook)

Date: 2026-09-25
Status: **awaiting Alex green** (house ship gate — do not implement until this plan is approved)
Depends on: `plans/2026-09-23-aims-linktree.md` (already live)

## Goal

Let a page owner (a bot, or Alex by hand) connect a Discord **channel** to a private `/p/:slug` page so that visitor messages sent through aims.bot land in that channel end to end. Cheap extra: show Discord as a contact option on the Linktree menu.

Also add health aliases: `/health` and `/api/health` must return the same JSON as `/api/v1/health` (monitors currently 404).

## Recommendation

**Use Discord incoming webhook URLs (path a). Do not add a Discord bot token.**

A page owner pastes a channel webhook URL (Channel Settings → Integrations → Webhooks → Copy Webhook URL). aims.bot stores it as an owner secret and, on `POST /api/v1/pages/:slug/message`, executes that webhook with `?wait=true`. Discord returns the created message `id`. That is the proof.

| Path | What it is | Fits the goal? | Cost |
|---|---|---|---|
| **(a) Incoming webhook URL** | `POST https://discord.com/api/webhooks/{id}/{token}?wait=true` — no bot, post-only | Yes. Owner connects a channel; messages land there. | Zero new Vercel env. Per-page secret, same shape as today's `webhookUrl`. |
| (b) Bot token + channel id | `POST /channels/{channel.id}/messages` with `Authorization: Bot …` | Yes for post, and two-way is *possible* later | Shared `DISCORD_BOT_TOKEN` in Vercel, Discord Application + invite + `Send Messages` on every target server, channel id per page. Two-way needs a Gateway / Interactions listener we do not have. |

Path (b) is the right later step if Alex wants Discord users to talk *back* through aims.bot. It is not needed to land messages in a channel. Path (a) is the real, smallest, already-official Discord API for exactly this.

Do **not** reuse `contact_pages.webhook_url` as the Discord URL. That field is the owner bot2bot hook (`contact.message` JSON + ack). Discord expects `{ content, username, … }` and cannot return an aims ack. A page may have both.

---

## Phase 0 — documentation discovery

### Existing aims.bot surfaces (read, cite)

| Concern | File | What it does today |
|---|---|---|
| Table create | `lib/db.ts` `ensureContactTables()` (lines 317–363) | Additive `CREATE TABLE IF NOT EXISTS contact_pages` (`slug`, `owner_token`, `webhook_url`, `webhook_secret`, `imessage`, `whatsapp`, `telegram`). `contact_messages` + `webhook_inbox`. Called from `initDB()` (line 314) and on every contact helper. Existing tables get new columns via `ALTER TABLE … ADD COLUMN IF NOT EXISTS` (same file, e.g. bots `token_balance` at line 155). |
| Page model + relay | `lib/contact-pages.ts` | `ContactPage`, `CreatePageInput` / `UpdatePageInput`, `isSafeWebhookUrl` (HTTPS + no private hosts), `buildContactOptions` (iMessage / WhatsApp / Telegram / CLI), `toPublicPage` (no secrets), `createContactPage` / `updateContactPage`, `createContactMessage`, `deliverOwnerWebhook` (`POST` JSON `event: contact.message`, 8s timeout, `redirect: 'error'`), `ownerWebhookPayload`. |
| Create page | `app/api/v1/pages/route.ts` | `POST` name + optional `webhookUrl` + contact fields. Validates webhook with `isSafeWebhookUrl`. Returns `ownerToken` + public page. |
| Public / owner update | `app/api/v1/pages/[slug]/route.ts` | `GET` public JSON; owner token adds `webhookUrl` + phones. `PATCH` with `X-Owner-Token`. |
| Contact discovery | `app/api/v1/pages/[slug]/contact/route.ts` | Public contacts + `bot2bot` + `messageUrl`. No secrets. |
| Message relay | `app/api/v1/pages/[slug]/message/route.ts` | Rate limit `LIMITS.CONTACT_MESSAGE` (40/min, `lib/ratelimit.ts`). **409 if `webhookUrl` is missing.** Content max 4000. Persists, `deliverOwnerWebhook`, returns `{ delivered, ack, message }`. |
| Health | `app/api/v1/health/route.ts` | `{ status, version, product: 'linktree', linktreeVersion, uptime, db, timestamp }`. 200 if DB connected, else 503. |
| Health tests | `tests/api/health.test.ts`, `tests/api/response-shapes.test.ts` | Only import `/api/v1/health`. |
| UI create / edit / menu | `app/CreatePageClient.tsx`, `app/p/[slug]/edit/EditPageClient.tsx`, `app/p/[slug]/edit/page.tsx`, `app/p/[slug]/LinktreeClient.tsx` | Fields for webhook + iMessage / WhatsApp / Telegram. Menu icons for those + CLI. |
| Proof | `scripts/bot2bot-proof.sh` | Inbox + page + `POST …/message` + assert webhook payload + ack. Copy this shape. |
| Tests to extend | `tests/lib/contact-pages.test.ts`, `tests/api/pages-bot2bot.test.ts` | `isSafeWebhookUrl`, public JSON never leaks webhook URL, create + deliver + 409-no-webhook. |
| Middleware | `middleware.ts` | Adds `X-AIMS-Version` only for `/api/*`. `/health` (no `/api`) must set the same header in the handler (v1 already does). |
| Env | `.env.example` | Linktree needs only `DATABASE_URL`. Keep it that way. |

### Official Discord docs (read)

| API | Source | Exact contract |
|---|---|---|
| **Execute Webhook (recommended)** | [Execute Webhook](https://discord.com/developers/docs/resources/webhook#execute-webhook) | `POST /webhooks/{webhook.id}/{webhook.token}` → `https://discord.com/api/webhooks/{id}/{token}`. Query: `wait` (bool; default `false` → `204` and a dropped message is **not** an error), optional `thread_id`. JSON: at least one of `content` / `embeds` / `components` / `file` / `poll`. **`content` up to 2000 characters.** Optional `username`, `avatar_url`, `tts`, `allowed_mentions`. With `wait=true`, response is the created **message object** (`id`, `channel_id`, `content`, …). Forum/media channels require `thread_id` or `thread_name` — **out of scope** (proof uses a normal text channel). |
| Get Webhook Message (proof read-back) | [Get Webhook Message](https://discord.com/developers/docs/resources/webhook#get-webhook-message) | `GET /webhooks/{webhook.id}/{webhook.token}/messages/{message.id}` — no bot token. Returns the same message object. Use this in `scripts/discord-proof.sh` after aims returns `discord.messageId`. |
| Create Message (path b only, rejected) | [Create Message](https://discord.com/developers/docs/resources/message#create-message) | `POST /channels/{channel.id}/messages` with `Authorization: Bot <token>`. Same 2000-char `content` limit. Requires a bot in the guild with `SEND_MESSAGES`. Reading back needs `GET /channels/{channel.id}/messages` and usually the `MESSAGE_CONTENT` privileged intent. |
| Rate limits | [Rate Limits](https://discord.com/developers/docs/topics/rate-limits) | Do **not** hard-code bucket sizes. Parse `X-RateLimit-*` and on `429` honor `retry_after` (seconds, float). Top-level resource for webhooks is `webhook_id` or `webhook_id + webhook_token`. Unauthenticated requests share the **IP** global cap (50 req/s). Invalid 401/403/429 storms → Cloudflare ban at 10k invalid / 10 min. **If a webhook 404s, stop using it** (Discord's documented rule). |
| Incoming webhook object | [Webhook Resource](https://discord.com/developers/docs/resources/webhook) | Type `1` Incoming. Token is the secret. UI-copied URL is `https://discord.com/api/webhooks/{id}/{token}`. Anyone with the URL can post to the channel. |

Community writeups often quote “~30/min per webhook” and “5/5s per channel”. Official docs say those numbers change — implementation must follow headers, not folklore.

### Allowed APIs (this ship)

- Validate + store a per-page Discord **incoming webhook URL** (owner secret).
- `POST {url}?wait=true` with `{ content, username?, allowed_mentions }` from the serverless message route.
- `GET {url}/messages/{id}` **only inside the proof script**, using the same URL Alex passed in (not from a public API).
- Health alias routes that call the existing health handler.
- Additive DB column(s) via `ALTER TABLE … IF NOT EXISTS`.

### Anti-patterns (do not do)

- ❌ Discord bot token / `DISCORD_BOT_TOKEN` / Gateway / Interactions / OAuth invite flow.
- ❌ Reuse `webhook_url` as the Discord URL (wrong payload, breaks bot2bot ack).
- ❌ Put the raw webhook URL in public JSON, Linktree HTML, contact discovery, or client-visible create-success fields.
- ❌ Accept arbitrary URLs as “Discord” (SSRF). Must be `https://discord.com/api/webhooks/{snowflake}/{token}` (see validation).
- ❌ Execute without `wait=true` (default `204` can hide a dropped message).
- ❌ Hard-code Discord rate-limit sleeps; ignore `429` / `retry_after`.
- ❌ Retry a webhook that returned **404** (Discord invalid-request ban).
- ❌ `@everyone` / role pings from visitor content — send `allowed_mentions: { parse: [] }`.
- ❌ Forum/media webhook without `thread_id` (will 400). v1 = text channels only.
- ❌ New required Vercel env vars.
- ❌ Prisma / ORM. This repo uses `@neondatabase/serverless` tagged `sql`.
- ❌ Implement anything in the plan-only PR.

---

## Decision detail

### Why webhook URL wins

1. **Matches the product.** Owner connects a channel; aims posts; done. Two-way is not in the goal.
2. **No shared secret.** Each page brings its own URL. Compromising one page does not give a bot that can speak as “aims” in every server.
3. **Proof is first-class.** `wait=true` returns `id`; Get Webhook Message confirms content without a bot.
4. **Same UX as today's owner webhook.** Bot `POST /api/v1/pages` or Alex pastes in `/p/:slug/edit`.
5. **Linktree menu is cheap.** If a Discord webhook is connected, add a `discord` contact option. Optional public invite URL if the owner wants a click-through; otherwise the option is receive-only (`kind: 'api'`, href = message URL).

### What we will not ask humans for (product)

No Discord Application, no bot invite, no Vercel `DISCORD_*` env. The only human artifact is a channel webhook URL **at proof time** (see Needs from humans).

---

## Implementation phases (for the later `/do` — not this PR)

### Phase 1 — schema + validation (lib)

**What**

1. In `ensureContactTables()` (`lib/db.ts`), after the existing `contact_pages` create:

   ```sql
   ALTER TABLE contact_pages
     ADD COLUMN IF NOT EXISTS discord_webhook_url TEXT;
   ALTER TABLE contact_pages
     ADD COLUMN IF NOT EXISTS discord_invite TEXT NOT NULL DEFAULT '';
   ALTER TABLE contact_messages
     ADD COLUMN IF NOT EXISTS discord_message_id TEXT;
   ```

   `discord_invite` is optional public (`https://discord.gg/…` or `https://discord.com/invite/…` or a `discord.com/channels/…` link) for the menu deeplink. Empty = menu still shows Discord as connected/receive-only.

2. Extend `ContactPage` / create / update / `rowToPage` in `lib/contact-pages.ts`.

3. Add `isDiscordWebhookUrl(raw)`:
   - First run `isSafeWebhookUrl` (HTTPS, no localhost/private).
   - Hostname **only** `discord.com` or legacy `discordapp.com`.
   - Path must match `/api/webhooks/{id}/{token}` or `/api/v{n}/webhooks/{id}/{token}`.
   - `{id}` = 17–20 digit snowflake; `{token}` = `[A-Za-z0-9_-]+` (length ≥ 20).
   - Reject extra path (`/github`, `/slack`, `/messages/…`).
   - Strip query + hash. Persist the canonical `https://discord.com/api/webhooks/{id}/{token}` (normalize `discordapp.com` → `discord.com`, drop `/vN`).
   - Error string: `discordWebhookUrl must be a discord.com/api/webhooks/{id}/{token} URL`.

4. Add `redactDiscordWebhookUrl(url)` → `https://discord.com/api/webhooks/{id}/••••`. Never return the token in public or owner JSON.

5. Add `deliverDiscordWebhook(page, message)`:
   - `POST ${url}?wait=true`
   - Headers: `Content-Type: application/json`, `User-Agent: aims.bot-linktree/1.0`
   - Body:
     - `content`: `**{from}** via aims.bot\n{body}` truncated to **2000** chars (Discord limit; aims still stores up to 4000).
     - `username`: sanitize `fromName` to 1–80 chars; strip case-insensitive `discord` / `clyde` (webhook name rules). Fallback `aims.bot`.
     - `allowed_mentions`: `{ "parse": [] }`
   - `AbortSignal.timeout(8000)`, `redirect: 'error'` (copy `deliverOwnerWebhook`).
   - Success: HTTP 200 + JSON `id` (snowflake). Persist `discord_message_id`.
   - 404: mark `discord_gone`, do not retry.
   - 429: one retry after `retry_after` if `< 2s`; otherwise fail `discord_rate_limited`. Do not loop.
   - Other errors: `discord_http_{status}` / `discord_unreachable`.

6. `buildContactOptions`: if `discord_webhook_url` or `discord_invite` is set, push

   ```ts
   { id: 'discord', label: 'Discord', href: invite || `/api/v1/pages/${slug}/message`, available: true, kind: invite ? 'deeplink' : 'api' }
   ```

   Public JSON: `discord: true` (boolean connected). Never the webhook URL.

**Copy from:** `isSafeWebhookUrl`, `deliverOwnerWebhook`, `ensureContactTables` ALTER pattern in `lib/db.ts`.

**Verify**

- [ ] `isDiscordWebhookUrl` accepts a real-shaped URL; rejects `https://evil.com/api/webhooks/1/x`, `http://…`, `https://discord.com/api/webhooks/1/x/github`, private IPs.
- [ ] `redactDiscordWebhookUrl` contains `••••` and not the token.
- [ ] `toPublicPage` / `JSON.stringify` never includes `discord.com/api/webhooks` token material.
- [ ] `buildContactOptions` includes `discord` when connected.

**Guards:** no raw URL in `PublicContactPage`; no `console.log` of the URL.

### Phase 2 — API routes

**What**

1. `POST /api/v1/pages` (`app/api/v1/pages/route.ts`): accept `discordWebhookUrl` and optional `discordInvite` (also under `contacts.discord` / `contacts.discordWebhookUrl` if cheap). Validate invite as `https` public URL whose host is `discord.gg` or `discord.com` (path `/invite/…` or `/channels/…`). Do not treat invite as a secret.

2. `PATCH` + owner `GET` (`app/api/v1/pages/[slug]/route.ts`): same fields. Owner payload:
   - `discordConnected: boolean`
   - `discordWebhookUrlRedacted: string | null`
   - `discordInvite` (public)
   - **Never** echo the raw webhook URL (even to the owner). Edit form: empty input = keep existing; send `null` / `""` to clear.

3. `GET …/contact`: include `discord` in `contacts` when connected. No secret.

4. `POST …/message`:
   - Delivery is allowed if `webhookUrl` **or** `discordWebhookUrl` is set. 409 only when **neither** is set.
   - After persist: existing owner webhook (if set) **and** Discord (if set). Independent; one failure does not skip the other.
   - Response (backward compatible):
     ```json
     {
       "success": true,
       "delivered": true,
       "ack": "…",
       "discord": { "delivered": true, "messageId": "123…", "status": 200 },
       "message": { "id": "cmsg_…", "deliveryStatus": "delivered", "discordMessageId": "123…" }
     }
     ```
   - `delivered` / `success` are true if **any** configured destination succeeded. If Discord is the only destination, `ack` may be `discord:{messageId}`.
   - If Discord fails and owner webhook succeeds, HTTP 200 with `discord.delivered: false` (bot2bot still worked). If Discord is the only dest and it fails, 502.

**Copy from:** existing validation in `app/api/v1/pages/route.ts` lines 51–58; message persist+deliver in `message/route.ts`.

**Verify**

- [ ] Create with Discord URL → 201; public body has `contacts` id `discord`, no token.
- [ ] Create with junk Discord URL → 400.
- [ ] Owner GET/PATCH never includes the raw token.
- [ ] Message with Discord-only (no `webhookUrl`) → 200 + `discord.messageId` (mock fetch).
- [ ] Message with neither dest → 409.
- [ ] Existing bot2bot test still passes (owner webhook + ack).

**Guards:** do not change the `contact.message` owner payload. Do not send Discord the aims JSON blob.

### Phase 3 — UI (cheap)

**What**

1. `CreatePageClient.tsx` + `EditPageClient.tsx`: fields “Discord webhook URL” (password-ish / not shown after save) and optional “Discord invite (public)”.
2. `LinktreeClient.tsx`: icon for `discord` (e.g. `🎮` or a simple mark). Deeplink opens invite; `kind: 'api'` can reuse the CLI panel copy (“messages land in the owner’s Discord”).
3. `app/p/[slug]/edit/page.tsx`: pass `discordConnected` / redacted / invite, never the raw URL.

**Verify:** create + edit forms submit the new fields; public `/p/:slug` shows Discord when connected; page source has no webhook token.

**Guards:** do not `sessionStorage` the Discord webhook URL.

### Phase 4 — health aliases

**What**

Extract the current `GET` body of `app/api/v1/health/route.ts` into `lib/health.ts` `getHealthResponse(): Promise<Response>` (or a named export). Three routes import it:

- `app/api/v1/health/route.ts` (unchanged URL)
- `app/api/health/route.ts` (**new**)
- `app/health/route.ts` (**new**)

Same JSON, same 200/503, same `Cache-Control: no-cache` + `X-AIMS-Version`.

**Verify**

- [ ] Unit tests call all three modules and assert identical JSON keys (`status`, `version`, `product`, `linktreeVersion`, `db`, `timestamp`).
- [ ] `tests/api/health.test.ts` covers the aliases.

**Guards:** do not invent a second health payload. Do not cache.

### Phase 5 — tests + proof script (pre-prod)

**What**

1. Extend `tests/lib/contact-pages.test.ts` and `tests/api/pages-bot2bot.test.ts` as above. Mock `fetch` for Discord: 200 `{ id: '111', content: '…' }`.
2. New `scripts/discord-proof.sh` (copy `scripts/bot2bot-proof.sh`):

   ```bash
   # Usage: DISCORD_WEBHOOK_URL='https://discord.com/api/webhooks/…' scripts/discord-proof.sh [https://aims.bot]
   ```

   Steps:
   1. `GET` `/api/v1/health`, `/api/health`, `/health` — all 200, `product=linktree`, `db=connected`.
   2. `POST /api/v1/pages` with `name`, `discordWebhookUrl=$DISCORD_WEBHOOK_URL` (no owner webhook required).
   3. Assert create JSON has no raw URL; contact list includes `discord`.
   4. `POST /api/v1/pages/:slug/message` `{ from: "discord-proof", content: "hello from discord-proof" }`.
   5. Assert `discord.delivered==true` and `discord.messageId` is a digit snowflake.
   6. `GET "$DISCORD_WEBHOOK_URL/messages/$MESSAGE_ID"` — assert `content` contains `hello from discord-proof`.
   7. Print `PASS discord e2e` + slug (no webhook URL in the success lines).

   If `DISCORD_WEBHOOK_URL` is unset, exit 2 with a one-line “needs a channel webhook URL” — do not hit Discord.

**Verify:** script is executable; comments say not to commit the URL.

**Guards:** proof must not print the webhook token (redact in echoes).

---

## Final phase — production verification (after deploy)

Run only after `/do` has merged to `main` and Vercel is Ready.

1. Vercel project `aims`, production deploy for the merge commit = **Ready**.
2. All three health paths 200, same JSON:
   - `https://aims.bot/api/v1/health`
   - `https://aims.bot/api/health`
   - `https://aims.bot/health`
3. `DISCORD_WEBHOOK_URL=… scripts/discord-proof.sh https://aims.bot`
4. Alex can open the Discord channel and see the proof line. Script already proved `messageId` via Get Webhook Message.

Keep `scripts/bot2bot-proof.sh` green as a regression.

---

## Ship steps (later `/do`, after Alex greens this plan)

1. Branch from latest `main`: `cursor/aims-discord-webhook-77d4` (or the `/do` branch convention).
2. Implement Phases 1–5. Commit as you go. Do not add Vercel env vars.
3. Open PR (implementation only; this plan file may stay as-is).
4. Wait for GitHub CI (`.github/workflows/ci.yml`: tsc + vitest + next build).
5. Merge to `main` (aims.bot deploys on push to `main`, Vercel project `aims`).
6. Babysit Vercel until production **Ready**.
7. Curl the three health URLs.
8. Run `scripts/discord-proof.sh` against `https://aims.bot` with Alex’s webhook URL.
9. Run `scripts/bot2bot-proof.sh https://aims.bot` once to confirm no regression.

---

## Needs from humans

Minimum ask. The product itself needs **no** new Vercel env and **no** Discord bot token.

1. **Production proof only — one Discord incoming webhook URL** for a text channel Alex (or the `/do` operator) controls.
   - Where to get it: Discord desktop/web → Server → target **text** channel → Edit Channel → **Integrations** → **Webhooks** → New Webhook → **Copy Webhook URL**.
   - Shape: `https://discord.com/api/webhooks/{id}/{token}`.
   - Where it goes: shell env for the proof script only, e.g.  
     `DISCORD_WEBHOOK_URL='https://discord.com/api/webhooks/…' scripts/discord-proof.sh https://aims.bot`  
     **Not** a Vercel env var. **Not** committed. **Not** stored in `.env` on the app. After proof, Alex may delete the webhook in Discord.
   - Channel must be a normal text channel (not a forum/media channel).

No other human setup. No Discord Application, no bot invite, no `DISCORD_BOT_TOKEN`.

---

## Out of scope (say no unless Alex asks)

- Discord → aims two-way (would be path b + Gateway or Interactions).
- Editing / deleting Discord messages from aims.
- File uploads, embeds, components, polls.
- Forum/media channels / threads.
- Replacing iMessage / WhatsApp / Telegram.
- Changing the owner `contact.message` contract.
