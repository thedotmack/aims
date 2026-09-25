# aims.bot ↔ Discord two-way (shared bot + mention wake)

Date: 2026-09-25 (rewritten after Alex rejected one-way webhooks)
Status: **awaiting Alex green** (house ship gate — do not implement until this plan is approved)
Depends on: `plans/2026-09-23-aims-linktree.md` (already live)

Alex’s framing: aims.bot exists to open a **two-way channel** between humans, bots, and groups. A Discord bot joins a server. When anyone `@mention`s a Grok bot’s name (e.g. `@botlord`), that message is routed through aims.bot into the page owner’s **existing bot2bot webhook wake**. The Grok bot’s reply posts back into the same channel or thread.

---

## Recommendation

**One shared Discord application (`aims` / aims.bot).** A tiny always-on **gateway worker on Railway Free ($0/month, $1 included usage)** forwards mention events to Vercel. Vercel reuses today’s `deliverOwnerWebhook` in `lib/contact-pages.ts`. Replies go back to Discord via REST (and a per-page channel webhook so the reply **displays as `botlord`**, not as `@aims`).

| Decision | Pick | Why |
|---|---|---|
| Shared app vs per-owner tokens | **Shared aims.bot app** | “Add to Discord” is one OAuth install. One gateway socket. Per-owner tokens mean every Grok owner creates an app, toggles intents, and we run N Identify connections (and hold N bot secrets). |
| How `@botlord` resolves | **Mentionable role + handle map** (see Discord realities) | A single Discord app has **one username**. `@botlord` as a *user* mention is impossible on a shared bot. A mentionable role named `botlord` (0 human members, assigned to the aims bot) is a real `@botlord` mention. Replies use a channel webhook `username: botlord`. Fallback: `@aims botlord …` if role create fails. |
| Listener | **Hybrid (c)** | Mentions are Gateway `MESSAGE_CREATE`, not HTTP interactions. Worker holds the WebSocket; Vercel keeps DB, wake, OAuth, slash `/aims`, and Discord REST. |
| Host | **Railway Free, $0/mo** | Always-on, no sleep. $1/mo usage credit covers a <100 MB raw-WS process. Fallback: Fly.io `shared-cpu-1x` 256 MB = **$1.94/mo** ([fly.io/pricing](https://fly.io/pricing/)). |
| Intents | `GUILDS` + `GUILD_MESSAGES` + `MESSAGE_CONTENT` | Mention-only **filter** (we drop everything else). `MESSAGE_CONTENT` is required so `@botlord hello` (role mention, no `@aims`) still has `content`. |
| Reply path | **Both** sync `{ ack }` and async `reply.url` | Today’s 8s webhook already returns `ack`. Slow Grok bots POST to a reply callback. `message.replyTo` is set to that callback on Discord-originated wakes so existing bots that call `replyTo` keep working. |

The rejected one-way incoming-webhook plan is dead. Incoming webhooks cannot receive `@mentions`.

**Connect UX (locked to the auth review):** a Grok bot calls the aims API, gets a **claim + Discord install URL**, and the human does **one** Discord Authorize click. Details: [§ Bot auth review](#bot-auth-review-adversarial) and [`plans/2026-09-25-bot-auth-review.md`](./2026-09-25-bot-auth-review.md).

---

## Discord realities (honest)

A single Discord **application** has a single **bot user**. In a guild that bot has **one username** (globally unique) and **one nickname**. You cannot make the same app appear as both `@botlord` and `@grok` as *user* mentions.

| Trick | What Discord actually does |
|---|---|
| Nickname | One per guild. Not per page. |
| `/aims botlord hello` | Works, no privileged intent. Not an `@mention`. Keep as a **secondary** invoke (slash on Vercel). |
| Text prefix `botlord:` | Fragile, needs `MESSAGE_CONTENT` for every message if we scan the channel. Violates mention-only. **No.** |
| Webhook display names | Replies can look like `botlord`. Inbound still hits the shared bot / a role. **Use for outbound.** |
| Mentionable **role** `botlord` | `@botlord` is a real mention (`mention_roles`). 0 human members ⇒ no mass ping. Bot must have `MANAGE_ROLES` and a role **below** the aims bot’s top role. Role names are unique per guild. **This is the inbound `@botlord` path.** |
| Per-owner bot token | Each Grok is a real `@botlord` user. Owner creates an app, enables intents, pastes a token. We run one gateway Identify **per token**. “Add to Discord” is no longer one link. **Reject for v1.** |

**Mention content without reading the channel**

Discord’s [You might not need a privileged intent](https://docs.discord.com/developers/gateway/you-might-not-need-a-privileged-intent) (2026): without `MESSAGE_CONTENT`, `content` / `embeds` / `attachments` / `components` / `poll` are emptied **except** messages the app sent, DMs, messages that **@mention the app**, and some replies to the app.

A **role-only** `@botlord` (no `@aims`) is **not** listed as an exception. The `mentions` / `mention_roles` arrays still arrive (those are not content fields). So we can *see that* `@botlord` was mentioned and still get **empty text** unless we enable `MESSAGE_CONTENT`.

That is why this plan enables `MESSAGE_CONTENT` but **filters to mention-only**. We do not store or wake on unmentioned messages.

**Verification threshold (updated June 10, 2026):** privileged-intent review is triggered at **10,000 unique users** who can see the app, not 100 servers. Under that, the Developer Portal toggle is enough. Source: [Privileged Intent Review](https://support-dev.discord.com/hc/en-us/articles/5324827539479-Message-Content-Intent-Review-Policy) and [June 2026 announcement](https://support-dev.discord.com/hc/en-us/articles/40281523410967-Changes-to-Privileged-Intent-Access-for-Discord-Apps). aims.bot will not hit 10k users on day one. If it ever does, keep the mention-only filter so a review has a clean story — or fall back to “must also @aims” and drop the privileged intent.

---

## Listener host (costs, current)

Vercel serverless **cannot** hold `wss://gateway.discord.gg`. Compare:

| Option | Can receive `@mentions`? | Monthly cost (sources) | Notes |
|---|---|---|---|
| **(a) Interactions / HTTP only** (slash, message commands → Vercel) | **No.** Mentions are not interactions. | $0 (already on Vercel) | Keep slash `/aims here` as **connect + fallback invoke**. Cannot be the only listener. |
| **(b) Always-on gateway worker** | Yes | See rows below | Required for `@mention`. |
| **(c) Hybrid** | Yes | Worker cost + existing Vercel | **Pick this.** Worker is a dumb forwarder. |

**Always-on prices (checked 2026-09-25):**

| Host | Always-on? | Money | Source |
|---|---|---|---|
| **Railway Free** | Yes (does **not** sleep). Stops for the rest of the month if usage exceeds the $1 credit; must redeploy after reset. | **$0/mo** + $1 included usage. RAM $10/GB-mo, CPU $20/vCPU-mo. A <100 MB raw-WS process fits the $1. Trial is $5 / 30 days, then Free. | [railway.com/pricing](https://railway.com/pricing), [Railway Free plan post](https://blog.railway.com/p/free-plan), [Railway station: exceed $1 → stop](https://station.railway.com/billing/inquiry-about-free-plan-after-30-day-tri-309629ee) |
| Railway Hobby | Yes | **$5/mo** floor (includes $5 usage) | Same pricing page |
| **Fly.io** `shared-cpu-1x` 256 MB | Yes | **$1.94/mo** (US `iad`/`ewr`); **$2.19/mo from 2026-10-01**. Card required on org. | [fly.io/pricing](https://fly.io/pricing/), [Oct 2026 update](https://fly.io/pricing-update/) |
| Render Free web | **No** — free web services spin down; not a gateway. Paid compute starts **$7/mo** (0.5 CPU / 512 MB). | $0 sleeps; $7 if paid | [render.com/pricing](https://render.com/pricing) |
| Cloudflare Workers + Durable Object | Maybe | **Free plan $0** (100k Worker req/day; DO 13,000 GB-s/day). Paid Workers **$5/mo** floor. An **outbound** Discord gateway socket keeps a DO in memory ([DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/): outbound WS incurs duration; ~11k GB-s/day at 128 MB — under the free 13k/day, tight). Free Worker CPU **10 ms/invocation** is risky for Identify/Resume. Hibernation does **not** help an outbound gateway the way inbound client sockets do. | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) (updated 2026-08-28), DO pricing (updated 2026-08-25) |

**Pick: Railway Free ($0/month).** Implement the worker as a tiny Bun/Node `ws` Identify + heartbeat + mention filter (not full discord.js) so RSS stays under the $1 credit. If Railway stops the box or the credit is too tight, move the same Docker image to Fly.io at $1.94/mo — do not redesign.

Do **not** pick interactions-only. Do **not** pick Render Free. Do **not** pick CF DO for v1 (cheaper-looking, higher chance of a broken resume loop).

---

## Phase 0 — documentation discovery

### Existing aims.bot (read, cite)

| Concern | File | Today |
|---|---|---|
| Tables | `lib/db.ts` `ensureContactTables()` (≈317–363), called from `initDB()` (314) | `contact_pages` (`slug`, `owner_token`, `webhook_url`, `webhook_secret`, contacts), `contact_messages`, `webhook_inbox`. New columns via `ALTER TABLE … ADD COLUMN IF NOT EXISTS` (e.g. line 155 `token_balance`). |
| Relay | `lib/contact-pages.ts` | `isSafeWebhookUrl`; `createContactMessage`; `ownerWebhookPayload` (`event: contact.message`, `version: 1`); `deliverOwnerWebhook` — `POST` owner URL, 8s timeout, `redirect: 'error'`, reads `{ ack }` / `{ message }` / short text; `X-Aims-Event` + optional `X-Aims-Secret`. |
| Message API | `app/api/v1/pages/[slug]/message/route.ts` | `LIMITS.CONTACT_MESSAGE` (40/min). **409 if no `webhookUrl`.** Persist → `deliverOwnerWebhook` → `{ delivered, ack, message }`. **This is the wake to reuse.** |
| Inbox (proof stand-in) | `app/api/v1/inbox/[token]/route.ts` | `POST` stores payload, returns `{ ack: "inbox-received" }`. `scripts/bot2bot-proof.sh` already uses this. |
| Create / PATCH page | `app/api/v1/pages/route.ts`, `app/api/v1/pages/[slug]/route.ts` | Owner token; public JSON has no secrets. |
| Contact menu | `app/api/v1/pages/[slug]/contact/route.ts`, `lib/contact-pages.ts` `buildContactOptions` | iMessage / WhatsApp / Telegram / CLI. |
| UI | `app/CreatePageClient.tsx`, `app/p/[slug]/edit/EditPageClient.tsx`, `app/p/[slug]/LinktreeClient.tsx` | Add “Add to Discord” on **edit**, Discord row on the menu when bound. |
| Health | `app/api/v1/health/route.ts` | `{ status, version, product: linktree, linktreeVersion, db, timestamp }`. `/health` and `/api/health` 404 today. |
| Middleware | `middleware.ts` | `X-AIMS-Version` only on `/api/*`. `/health` must set the header in-handler (v1 already does). |
| Rate limits | `lib/ratelimit.ts` `LIMITS` | Add a Discord-specific limiter (e.g. 20 wakes / page / minute). |
| Env | `.env.example` | Linktree today: `DATABASE_URL` only. This ship **does** add runtime Discord secrets on Vercel + worker (see Needs). |
| Proof to copy | `scripts/bot2bot-proof.sh` | Inbox + page + POST message + assert wake + ack. |

### Official Discord docs (read)

| Topic | Source | Contract we use |
|---|---|---|
| Gateway | [Gateway](https://discord.com/developers/docs/events/gateway) | Connect `wss://gateway.discord.gg/?v=10&encoding=json`. Opcode 2 **Identify** with `token`, `intents`, `properties`. Opcode 1 heartbeat (`heartbeat_interval` from Hello). Opcode 6 Resume on disconnect. Event `MESSAGE_CREATE` is a message object. |
| Intents | [Gateway intents](https://discord.com/developers/docs/events/gateway#gateway-intents) | `GUILDS` = `1 << 0`, `GUILD_MESSAGES` = `1 << 9`, `MESSAGE_CONTENT` = `1 << 15` (privileged). **Do not** request `GUILD_MEMBERS` or `GUILD_PRESENCES`. Identify `intents` = `1 \| 512 \| 32768`. |
| Privileged content | [You might not need…](https://docs.discord.com/developers/gateway/you-might-not-need-a-privileged-intent) | Content emptied without the intent except app-sent, DMs, **@mention the app**, some replies. Role-only `@botlord` needs the intent for text. Review at **10k users** ([policy](https://support-dev.discord.com/hc/en-us/articles/5324827539479-Message-Content-Intent-Review-Policy)). |
| Interactions (slash, HTTP) | [Receiving and Responding](https://discord.com/developers/docs/interactions/receiving-and-responding) | Discord `POST`s to the Interactions Endpoint URL. Type `1` PING → `{ type: 1 }`. Type `2` APPLICATION_COMMAND. Verify Ed25519 with the app public key. **3s** to first response. Use for `/aims here` and `/aims ask` only — **not** @mentions. |
| OAuth2 bot install | [OAuth2](https://discord.com/developers/docs/topics/oauth2) | `https://discord.com/oauth2/authorize?client_id={id}&scope=bot%20applications.commands&permissions={bits}&redirect_uri={cb}&response_type=code&state={nonce}`. Scope `bot` adds the bot to the selected guild; redirect includes `guild_id`. Use `state` (CSRF). Token URL `POST https://discord.com/api/oauth2/token` (`application/x-www-form-urlencoded`). |
| Create Message | [Create Message](https://discord.com/developers/docs/resources/message#create-message) | `POST /channels/{channel.id}/messages`, `Authorization: Bot {token}`. `content` ≤ **2000**. `message_reference` for replies/threads. |
| Execute Webhook (display name) | [Execute Webhook](https://discord.com/developers/docs/resources/webhook#execute-webhook) | `POST /webhooks/{id}/{token}?wait=true`. `username` override (≤80, no `discord`/`clyde`). Same 2000-char `content`. |
| Get Channel Messages (proof) | [Get Channel Messages](https://discord.com/developers/docs/resources/message#get-channel-messages) | `GET /channels/{channel.id}/messages?limit=5` with the bot token. |
| Create Role / channel webhook | [Create Guild Role](https://discord.com/developers/docs/resources/guild#create-guild-role), [Create Webhook](https://discord.com/developers/docs/resources/webhook#create-webhook) | Role: `name`, `mentionable: true`. Webhook: `POST /channels/{channel.id}/webhooks` `{ name }` → store URL server-side only. |
| Rate limits | [Rate Limits](https://discord.com/developers/docs/topics/rate-limits) | Do not hard-code buckets. Honor `retry_after` on 429. Global 50 req/s per token. 10k invalid (401/403/429) / 10 min → Cloudflare ban. Stop using a 404 webhook. |

### Allowed APIs (this ship)

- One shared Discord app; bot install OAuth; slash `/aims`.
- Gateway worker: Identify with the three intents above; forward **mention** `MESSAGE_CREATE` only.
- Vercel: `POST /api/v1/discord/events` (worker), Interactions endpoint, OAuth callback, bind APIs, reuse `deliverOwnerWebhook`, Discord REST + per-page webhook execute for replies.
- Health aliases `/health` and `/api/health`.
- Additive `discord_bindings` (+ message hop/reply columns).

### Anti-patterns

- ❌ One-way incoming webhook as the product (Alex rejected; cannot receive mentions).
- ❌ Per-page Discord bot tokens in v1.
- ❌ Interactions-only “listener”.
- ❌ `MESSAGE_CONTENT` used to ingest the whole channel. Filter is mention-only.
- ❌ `GUILD_MEMBERS` / `GUILD_PRESENCES`.
- ❌ Putting bot token, client secret, worker secret, or webhook URLs in public JSON, Linktree HTML, or proof script output.
- ❌ Logging those secrets. Proof scripts read env only; never `echo` them.
- ❌ Storing `DISCORD_WEBHOOK_URL` (house proof webhook) on Vercel — that is a **box/proof** secret, not an app secret.
- ❌ Putting the **bot token** only on the worker — Vercel needs it for REST replies and OAuth-adjacent REST. It **is** a Vercel runtime secret (see Needs).
- ❌ discord.js monolith on Railway Free (memory). Raw `ws` / `@discordjs/ws` only.
- ❌ Retry Discord 404 webhooks; `@everyone` from visitor text (`allowed_mentions.parse = []` unless the owner ack explicitly mentions a mapped role for bot-to-bot).
- ❌ Prisma. Tagged `sql` only.
- ❌ Implementing in this plan PR.

---

## Architecture

```
Human / bot / group in Discord
        │  @botlord hello     (role mention)  or  @aims botlord hello
        ▼
Railway gateway worker (Identify, heartbeat, mention filter)
        │  POST /api/v1/discord/events   (HMAC DISCORD_WORKER_SECRET)
        ▼
Vercel  resolve (guild_id, role_id|handle|single-channel) → contact_pages
        persist contact_messages (source=discord, hop, ids)
        deliverOwnerWebhook  ── existing 8s wake ──►  Grok owner webhook
        │                                              (or /api/v1/inbox/:token)
        │  sync { ack }  and/or  async POST reply.url
        ▼
Discord  channel webhook as username=botlord  (or Bot Create Message fallback)
         same channel / thread, message_reference = source
```

### Loop guards (humans, bots, groups)

Bot A `@botlord` → botlord ack `@otherbot` → otherbot ack `@botlord` is a **feature** until it loops.

1. **Ignore self:** drop if `author.id === botUserId`, or `webhook_id` is one of our stored reply webhooks, or `author.application_id === our app id`.
2. **Hop:** `contact_messages.hop` (0 = human or external). If the author is a Discord bot **or** a webhook whose username matches another binding handle, `hop = parent.hop + 1`. Drop if `hop > 3`.
3. **Pair cooldown:** 30s silence for the same `(guild_id, from_key, to_page_id, sha256(content))`.
4. **Rate:** `LIMITS.DISCORD_WAKE` ≈ 20 / page / minute; 5 / (page, author) / minute. Discord 429: one retry if `retry_after < 2s`.
5. **Mention fan-out:** if one message mentions two handles, wake both independently; each reply default `allowed_mentions.parse = []`. If the Grok `ack` contains `<@&role>` / `<@user>` for **mapped** targets, allow those only (bot-to-bot). Never allow `@everyone` / `@here`.
6. **Do not wake on our own replies** even if someone replies with ping-on-reply and the hop would increment — require an **additional** mapped mention to continue the chain.

---

## Data model

New table (additive, `ensureContactTables`):

```sql
CREATE TABLE IF NOT EXISTS discord_bindings (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES contact_pages(id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  mention_handle TEXT NOT NULL,          -- lowercase 'botlord'
  mention_role_id TEXT,                  -- nullable if role create failed
  reply_webhook_url TEXT,                -- SECRET, never public
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (guild_id, mention_handle),
  UNIQUE (guild_id, channel_id, page_id)
);
CREATE INDEX IF NOT EXISTS idx_discord_bind_lookup
  ON discord_bindings (guild_id, channel_id);

CREATE TABLE IF NOT EXISTS discord_claims (
  code TEXT PRIMARY KEY,                 -- 'AIMS-7K2P'
  page_id TEXT NOT NULL REFERENCES contact_pages(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

`contact_messages` ALTERs:

- `source TEXT NOT NULL DEFAULT 'api'` (`api` \| `discord`)
- `hop INT NOT NULL DEFAULT 0`
- `discord_guild_id TEXT`
- `discord_channel_id TEXT`
- `discord_thread_id TEXT`
- `discord_source_message_id TEXT`
- `discord_reply_message_id TEXT`
- `reply_token TEXT` (hashed at rest if easy; else random `rpl_` + timing-safe compare)
- `reply_expires_at TIMESTAMPTZ`

**Resolution order** for an inbound mention in `(guild, channel)`:

1. Any `mention_roles` that match a binding `mention_role_id` in this guild (may be several).
2. Else if the **bot user** is in `mentions`: parse the first whitespace token after the mention as a handle; match `mention_handle` in this guild (prefer this channel).
3. Else if the bot user is mentioned and this channel has **exactly one** binding → that page.
4. Else drop (no wake).

---

## API shapes (exact)

### Owner webhook wake (Discord-originated)

Same event as today’s bot2bot. Additive fields only. `message.replyTo` becomes the aims reply callback so existing Grok bots that POST to `replyTo` work.

```json
{
  "event": "contact.message",
  "version": 1,
  "page": { "slug": "abc123", "name": "botlord" },
  "message": {
    "id": "cmsg_…",
    "from": "alex",
    "content": "hello",
    "replyTo": "https://aims.bot/api/v1/pages/abc123/messages/cmsg_…/reply",
    "createdAt": "2026-09-25T21:00:00.000Z"
  },
  "discord": {
    "guildId": "111",
    "channelId": "222",
    "threadId": null,
    "sourceMessageId": "333",
    "handle": "botlord",
    "hop": 0
  },
  "reply": {
    "url": "https://aims.bot/api/v1/pages/abc123/messages/cmsg_…/reply",
    "token": "rpl_…",
    "expiresAt": "2026-09-26T21:00:00.000Z"
  }
}
```

Sync reply (existing): HTTP 200 `{ "ack": "hi from grok" }` within 8s → post that string to Discord. Also accept `{ "message": "…" }` (already parsed).

Async reply:

```
POST /api/v1/pages/:slug/messages/:id/reply
X-Aims-Reply-Token: rpl_…
Content-Type: application/json

{ "content": "hi from grok" }
```

→ `{ "success": true, "discord": { "messageId": "444", "channelId": "222" } }`

401 bad token, 404 unknown, 410 expired, 409 if we want single-reply-only (v1: allow up to 5 follow-ups / 10 minutes). Content ≤ 2000 after trim (Discord); store full 4000 on the message row if needed but **post truncated**.

### Worker → Vercel

```
POST /api/v1/discord/events
X-Aims-Worker-Secret: …
Content-Type: application/json

{
  "type": "MESSAGE_CREATE",
  "message": { /* Discord message object, as received */ }
}
```

Vercel returns `{ "ok": true, "wakes": 1 }` or `{ "ok": true, "ignored": "no_mention" }`. Never echo secrets.

### Owner / bot connect (claim — self-serve)

Grok-style “connect me up with aims” (bot automates; human does one Discord click):

```
POST /api/v1/pages
{ "name": "botlord", "webhookUrl": "https://grok.example/aims" }
→ { ownerToken, page }

POST /api/v1/pages/:slug/connect
X-Owner-Token: own_…
{ "channels": ["discord"] }
```

```json
{
  "success": true,
  "claim": "AIMS-7K2P",
  "expiresAt": "2026-09-25T22:00:00.000Z",
  "discord": {
    "installUrl": "https://discord.com/oauth2/authorize?client_id=…&scope=bot%20applications.commands&permissions=…&redirect_uri=https%3A%2F%2Faims.bot%2Fapi%2Fv1%2Fdiscord%2Foauth%2Fcallback&response_type=code&state=<signed claim>"
  }
}
```

OAuth callback `GET /api/v1/discord/oauth/callback?code&guild_id&state`:

- Verify signed claim (single-use, 30 min).
- Exchange code (if needed) / trust `guild_id` from Discord’s bot install redirect ([OAuth2](https://discord.com/developers/docs/topics/oauth2)).
- Bind `guild_id` + **`system_channel_id`** (or first text channel the bot can `SEND_MESSAGES` in). Handle = slugged page name.
- Create mentionable role + channel webhook.
- `POST` owner webhook:

```json
{
  "event": "connect.ready",
  "version": 1,
  "page": { "slug": "abc123", "name": "botlord" },
  "discord": {
    "connected": true,
    "guildId": "111",
    "channelId": "222",
    "handle": "botlord",
    "mention": "@botlord",
    "roleId": "555"
  }
}
```

Human-facing success page: “`@botlord` is live. Wrong channel? Type `/aims here` there.”

Manual / rebind (bot or edit UI, **no** second OAuth if the shared bot is already in the guild):

```
POST /api/v1/pages/:slug/discord
X-Owner-Token: own_…
{ "guildId": "111", "channelId": "222", "handle": "botlord" }
```

`GET /api/v1/claims/AIMS-7K2P` → `{ status: "pending"|"bound"|"expired", discord? }` (no secrets).  
`DELETE /api/v1/pages/:slug/discord` + owner token unbinds (delete role/webhook we created).

Edit-screen **Add to Discord** is the same `installUrl` (claim minted server-side).

### Slash commands

HTTP interactions on Vercel ([Receiving and Responding](https://discord.com/developers/docs/interactions/receiving-and-responding)):

- `/aims here [handle]` — move/create binding for **this** channel. Works after the bot is in the guild. Handle defaults to the page already bound to this guild, else the claim’s page.
- `/aims claim AIMS-7K2P` — backup if the human has the code but used a vanilla invite (no `state`). Same bind as the OAuth callback.
- `/aims ask [handle] [text]` — fallback invoke (not the mention path).

### Public contact

`buildContactOptions` adds `{ id: 'discord', label: 'Discord', href: inviteOrMessageUrl, available: true, kind: 'deeplink'|'api' }` when a binding exists. No tokens.

---

## Owner connect flow (locked)

Matches rank-1 in [`plans/2026-09-25-bot-auth-review.md`](./2026-09-25-bot-auth-review.md).

1. **Bot (automated):** `POST /api/v1/pages` then `POST /api/v1/pages/:slug/connect { channels: ["discord"] }`. Shows the human `discord.installUrl` (and claim `AIMS-7K2P` as backup).
2. **Human (unavoidable, 1 click):** open the link → pick server → Authorize. Discord will not add a bot without this ([OAuth2 bot scope](https://discord.com/developers/docs/topics/oauth2)).
3. **aims (automated):** bind `guild_id` + default channel, create role + reply webhook, `connect.ready` wake.
4. **Human (optional):** `/aims here` if the default channel is wrong.

Permissions bits (install): `VIEW_CHANNEL`, `SEND_MESSAGES`, `SEND_MESSAGES_IN_THREADS`, `EMBED_LINKS`, `READ_MESSAGE_HISTORY` (proof + reply context), `MANAGE_ROLES`, `MANAGE_WEBHOOKS`, `USE_APPLICATION_COMMANDS` (via scope). Document the integer in code from Discord’s calculator; do not guess in the `/do`.

---

## Bot auth review (adversarial)

Full review (Discord, Slack, Telegram, WhatsApp, iMessage, MCP OAuth 2.1 / RFC 7591 / CIMD, OpenAI/Claude/Grok signed webhooks, RFC 8628 device code, magic-link claims, email/SMS A2P 10DLC, **Photon / Spectrum**, **Bird / MessageBird**), ranked flows, and empty red-team slots (Photon + Bird are in that red-team scope):

**[`plans/2026-09-25-bot-auth-review.md`](./2026-09-25-bot-auth-review.md)**

### Red-team findings

_(empty — second, different-model agent attacks the review next, including Photon and Bird)_

### Resolution

_(empty — fold red-team findings here)_

---

## Implementation phases (later `/do`)

### Phase 1 — schema + wake reuse

**What:** `discord_bindings` + `discord_claims` + message ALTERs in `ensureContactTables()`. Extend `ownerWebhookPayload` with optional `discord` + `reply` (only when source is Discord). `connect.ready` payload. `createReplyToken()` / `createClaim()`. Loop-guard helpers.

**Copy from:** `lib/db.ts` ALTER pattern; `ownerWebhookPayload` / `deliverOwnerWebhook` in `lib/contact-pages.ts`.

**Verify:** payload tests still pass for non-Discord; Discord payload includes `reply.url` and does not leak `reply_webhook_url`.

**Guards:** do not change `event` name or drop `ack` parsing.

### Phase 2 — Vercel Discord HTTP

**What:**

- `app/api/v1/discord/events/route.ts` — HMAC, mention resolve, persist, `deliverOwnerWebhook`, post ack to Discord.
- `app/api/v1/pages/[slug]/messages/[id]/reply/route.ts` — async reply.
- `app/api/v1/pages/[slug]/connect/route.ts` — mint claim + Discord `installUrl`.
- `app/api/v1/pages/[slug]/discord/route.ts` + oauth callback (claim in `state`, default-channel bind).
- `app/api/v1/claims/[code]/route.ts` — poll `pending|bound|expired`.
- `app/api/v1/discord/interactions/route.ts` — PING + `/aims here` + `/aims claim` + `/aims ask`.
- `lib/discord.ts` — REST helpers (create message, execute webhook, create role, create webhook, list channels). Redact URLs. `allowed_mentions` policy.

Set Vercel **Interactions Endpoint URL** to `https://aims.bot/api/v1/discord/interactions`.

**Copy from:** `message/route.ts` persist+deliver; `isSafeWebhookUrl` (do not use it for Discord’s own API — we call `discord.com` with the bot token).

**Verify:** unit tests with mocked `fetch`: mention → inbox-shaped wake; sync ack → Discord POST; no mention → ignored; self author → ignored; hop 4 → dropped; public GET page has no webhook URL / token.

**Guards:** worker secret timing-safe; no raw webhook in JSON.

### Phase 3 — gateway worker

**What:** `discord-gateway/` (or `apps/discord-gateway`) — Hello, Identify (`intents = 33281`), heartbeat, Resume, filter `MESSAGE_CREATE` through the same mention predicate (bot id, role ids optional cache, else forward all mentions of the bot and any role — Vercel decides). `POST` to `AIMS_EVENTS_URL`. `/health` on the worker (`{ status, gateway: "ready"|"connecting" }`). Dockerfile. Railway `railway.toml` + Fly `fly.toml` (same image).

**Verify:** local test with a mocked gateway or a recorded Hello/Dispatch fixture. Worker health 200 when Identify succeeds.

**Guards:** never log the token; never persist Discord at rest on the worker.

### Phase 4 — UI + Linktree Discord row

**What:** Edit page: Add to Discord + connected state (guild/channel/handle, no secrets). Linktree: Discord contact when bound.

**Verify:** edit page source has no token; contact JSON has `discord`.

### Phase 5 — health aliases

**What:** Extract `getHealthResponse()` from `app/api/v1/health/route.ts` into `lib/health.ts`. Re-export from:

- `app/api/v1/health/route.ts`
- `app/api/health/route.ts` (new)
- `app/health/route.ts` (new)

Same JSON, 200/503, `Cache-Control: no-cache`, `X-AIMS-Version`.

**Verify:** `tests/api/health.test.ts` hits all three modules.

**Guards:** one payload only.

### Phase 6 — tests + automatable proof script (pre-prod)

**What:** `scripts/discord-proof.sh` (copy `scripts/bot2bot-proof.sh`).

Env (never printed, never committed):

- `DISCORD_BOT_TOKEN` — house box secret
- `DISCORD_WEBHOOK_URL` — house box secret (channel incoming webhook for the **proof channel**)
- `AIMS_BASE_URL` default `https://aims.bot`
- Optional `DISCORD_PROOF_CHANNEL_ID` if not parseable

Script must `set +x` around secret use; redact URLs in all `echo`.

**Automated path (no human typing, gateway optional):**

1. Curl `/api/v1/health`, `/api/health`, `/health` — 200, `product=linktree`, `db=connected`.
2. `POST /api/v1/inbox` → owner stand-in (returns `ack: inbox-received`).
3. `POST /api/v1/pages` with that inbox as `webhookUrl`, name `botlord`.
4. Bind Discord via owner API (`POST …/discord`) **or** `POST …/connect` + signed events (proof guild already has the bot). If bind needs a live guild, the house token’s bot must already be in that server (see Needs).
5. Simulate inbound: `POST /api/v1/discord/events` with a signed fake `MESSAGE_CREATE` that `@mention`s the binding (role id or bot id + content `hello from discord-proof`). This proves Vercel wake **without** the worker.
6. Assert inbox payload is `contact.message`, `discord.handle=botlord`, `reply.url` present.
7. Inbox already returned `ack: inbox-received` on the wake — Vercel should have posted that string to Discord.
8. `GET https://discord.com/api/v10/channels/{id}/messages?limit=5` with `Authorization: Bot $DISCORD_BOT_TOKEN` — assert a message contains `inbox-received`. **Do not print the token.**
9. Optional second step: `POST $DISCORD_WEBHOOK_URL?wait=true` with content mentioning the bot/role, then wait for the **live worker** to forward a real `MESSAGE_CREATE`, then GET messages again. Skip (exit 0 with `WORKER_E2E_SKIPPED`) if worker health is down — do not fail the Vercel-path proof.

**Human E2E (required for ship):** Alex types `@botlord ping` in the proof channel; the inbox (or the real Grok webhook) wakes; the reply appears in-channel / thread.

**Guards:** `grep` the script for `echo "$DISCORD` — must not exist. CI runs unit tests only (no Discord token in GitHub).

---

## Final phase — production verification

After `/do` merge + worker deploy:

1. Vercel project `aims`, production **Ready**.
2. All three health URLs 200, same JSON.
3. Worker `/health` 200, `gateway: ready`.
4. `scripts/discord-proof.sh` against production (env from the house box, not the repo).
5. Human: `@botlord` in the real channel → wake in inbox/Grok → reply visible in Discord.
6. Regression: `scripts/bot2bot-proof.sh https://aims.bot`.

---

## Ship steps (later `/do`, after Alex greens)

1. Branch from latest `main` (`cursor/aims-discord-twoway-77d4` or the `/do` convention).
2. Implement Phases 1–6. Commit as you go.
3. Set Vercel env (see Needs) — required runtime secrets, **not** `DISCORD_WEBHOOK_URL`.
4. Open implementation PR; wait for `.github/workflows/ci.yml` (tsc, vitest, next build).
5. Merge to `main` (aims.bot deploys on push).
6. Babysit Vercel **Ready**.
7. Deploy `discord-gateway` to Railway (same secrets minus client secret). Confirm worker health.
8. Register slash commands (`PUT /applications/{id}/commands`) and set Interactions URL.
9. Run health curls + `discord-proof.sh` + human `@mention` + `bot2bot-proof.sh`.

---

## Needs from humans

True minimum. For each: what, where it goes, whether an agent can do it.

1. **Create the Discord application** (Developer Portal → New Application, name e.g. `aims`).
   - **Human only.** Discord has no supported public API to create apps without a logged-in browser session. Agent cannot.
   - After create: agent can use the IDs/secrets the human copies.

2. **Enable Privileged Intent `MESSAGE CONTENT INTENT`** on the Bot page (and the Bot itself if not already).
   - **Human only** (portal toggle). No first-party API. Under 10k users, no review form.
   - Also turn on the Bot → Privileged Gateway Intents checkbox so Identify with `1<<15` is accepted.

3. **Copy four values out of the portal** (once):
   - Bot token → **`DISCORD_BOT_TOKEN`**
   - Application / Client ID → **`DISCORD_CLIENT_ID`**
   - Client secret → **`DISCORD_CLIENT_SECRET`**
   - Public key (Interactions) → **`DISCORD_PUBLIC_KEY`**
   - **Human copies.** Agent **can** then write them to Vercel env (`vercel env add` / Vercel API / dashboard) and Railway/Fly env **if** the agent already has those CLIs authenticated. Agent must never commit them or paste them into the PR.
   - **Vercel runtime secrets (required):** `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_PUBLIC_KEY`, plus a generated `DISCORD_WORKER_SECRET`.
   - **Worker runtime secrets (required):** `DISCORD_BOT_TOKEN`, `DISCORD_WORKER_SECRET`, `AIMS_EVENTS_URL=https://aims.bot/api/v1/discord/events`.
   - **Not on Vercel:** `DISCORD_WEBHOOK_URL` (proof-only box secret).

4. **Authorize the bot on one proof server** (click the OAuth “Add to Discord” URL the agent generates).
   - **Human click required.** Discord forbids installing a bot to a guild without a user authorization. Agent generates the URL; cannot complete the consent screen.
   - After this, channel bind + `/aims here` can be done by Alex or by the agent via `POST …/discord` if Alex pastes `guild_id` + `channel_id`.

5. **Railway account** (Free plan; no card for trial, card not required for Free).
   - **Human signup + login** (`railway login` / browser). Agent **can** `railway up` after `RAILWAY_TOKEN` exists. If Alex refuses a new account, use Fly.io instead ($1.94/mo, card required on org — also a human signup).
   - Agent should prefer Railway Free to keep cash at $0.

6. **House box secrets for proof** (already planned): `DISCORD_WEBHOOK_URL` now, `DISCORD_BOT_TOKEN` soon.
   - **Human/box.** Scripts read env only. Agent uses them at proof time; never prints, logs, or commits. Token is **also** a Vercel/worker runtime secret (item 3). The webhook URL is **not**.

**Not needed from humans:** creating per-Grok Discord apps; MESSAGE_CONTENT verification form (under 10k users); paying for Render/CF Workers Paid; putting the proof webhook on Vercel.

---

## Out of scope

- Per-owner Discord bot tokens.
- Reading or logging unmentioned channel messages.
- Voice, DMs as v1 product, forum channels without `thread_id`.
- Replacing iMessage / WhatsApp / Telegram / CLI bot2bot.
- Changing `event: contact.message` for non-Discord wakes.
