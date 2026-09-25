# aims.bot ↔ Discord two-way (shared bot + mention wake)

Date: 2026-09-25 (rewritten after Alex rejected one-way webhooks; resolved after red-team `d46fe50`)
Status: **resolved after red-team; awaiting Alex green** (do not implement until this revision is approved)
Depends on: `plans/2026-09-23-aims-linktree.md` (already live)

Alex’s framing: aims.bot exists to open a **two-way channel** between humans, bots, and groups. A Discord bot joins a server. When anyone `@mention`s a Grok bot’s name (e.g. `@botlord`), that message is routed through aims.bot into the page owner’s **existing bot2bot webhook wake**. The Grok bot’s reply posts back into the same channel or thread.

---

## Recommendation

**One shared Discord application (`aims` / aims.bot).** A tiny always-on **gateway worker on Fly.io (`shared-cpu-1x` 256 MB, $2.19/mo from 2026-10-01)** forwards **`@aims` mentions** to Vercel. Vercel reuses today’s `deliverOwnerWebhook` (after SSRF harden). Replies go back via Bot REST as **`@aims`**, with the page handle in the text (`**botlord:** …`). No mentionable roles. No reply webhooks.

| Decision | Pick | Why |
|---|---|---|
| Shared app vs per-owner tokens | **Shared aims.bot app** | One install link. One gateway socket. Per-owner tokens mean N apps, N intents, N secrets. |
| How `botlord` resolves | **`@aims botlord` or `/aims ask botlord`** | One app = one username. Role/webhook impersonation is confusable and needs `MANAGE_ROLES` / `MANAGE_WEBHOOKS` / `MESSAGE_CONTENT`. App mentions include content without the privileged intent. |
| Listener | **Hybrid (c)** | Mentions are Gateway `MESSAGE_CREATE`. Worker holds the WebSocket; Vercel keeps DB, wake, OAuth, slash `/aims`, Discord REST. |
| Host | **Fly.io $2.19/mo primary** | Widened comparison: Fly is the cheapest **reliable** always-on host we already have. House box is $0 extra but restarts with Grok updates (no SLA). GCP e2-micro is Always Free but credits are unclaimed and it is a new billing project. See [Gateway host comparison](#gateway-host-comparison-widened-alex-2026-09-25). |
| Intents | `GUILDS` + `GUILD_MESSAGES` only (`1 \| 512 = 513`) | Filter to messages that **@mention the app**. No `MESSAGE_CONTENT`. |
| Reply path | **Both** sync `{ ack }` and async `reply.url` | Today’s 8s webhook already returns `ack`. `message.replyTo` is set on Discord-originated wakes. |
| Connect | **Advanced OAuth code grant** | Ordinary bot install is callback-less. Scopes `bot applications.commands identify` + Require OAuth2 Code Grant. Verify membership via REST. |

The rejected one-way incoming-webhook plan is dead. Incoming webhooks cannot receive `@mentions`.

**Connect UX:** Grok bot mints a hashed claim + advanced OAuth `installUrl`. Human picks a server and Authorizes. Optional `/aims here`. Details: [§ Bot auth review](#bot-auth-review-adversarial) and [`plans/2026-09-25-bot-auth-review.md`](./2026-09-25-bot-auth-review.md).

**Ship vs rank:** Telegram is cheaper and fewer taps. **Discord still ships first** (Alex): group channels and multi-bot rooms are the core use case.

---

## Discord realities (honest)

A single Discord **application** has a single **bot user**. In a guild that bot has **one username** (globally unique) and **one nickname**. You cannot make the same app appear as both `@botlord` and `@grok` as *user* mentions.

| Trick | What Discord actually does |
|---|---|
| Nickname | One per guild. Not per page. |
| `/aims ask botlord hello` | Works, no privileged intent. **Primary slash invoke** (HTTP on Vercel). |
| Text prefix `botlord:` on unmentioned messages | Would need `MESSAGE_CONTENT` for every message. **No.** |
| Webhook display names | Confusable; needs `MANAGE_WEBHOOKS`. **Do not use.** |
| Mentionable **role** `botlord` | Confusable (duplicate names allowed; authority is snowflake). Needs `MANAGE_ROLES` + `MESSAGE_CONTENT` for role-only text. **Do not use.** |
| **`@aims botlord hello`** | App is mentioned ⇒ `content` is present **without** `MESSAGE_CONTENT`. First token after the mention is the handle. **This is the inbound path.** |
| Per-owner bot token | Real `@botlord` user, N gateways, N secrets. **Reject for v1.** |

**Mention content without reading the channel**

Discord’s [You might not need a privileged intent](https://docs.discord.com/developers/gateway/you-might-not-need-a-privileged-intent) (2026): without `MESSAGE_CONTENT`, content is emptied **except** messages the app sent, DMs, messages that **@mention the app**, and some replies to the app.

v1 **only** wakes when the app is mentioned (or via `/aims ask`). We do **not** enable `MESSAGE_CONTENT`. We do not store or wake on unmentioned messages.

**Two scale gates (both real):**

1. Privileged-intent review at **10,000 unique reachable users** ([policy](https://support-dev.discord.com/hc/en-us/articles/5324827539479-Message-Content-Intent-Review-Policy)). Avoided in v1 by not requesting the intent.
2. **App verification past 100 servers** ([verification](https://support-dev.discord.com/hc/en-us/articles/23926564536471-How-Do-I-Get-My-App-Verified)). House task if we grow; not day one.

---

## Listener shape (unchanged)

| Option | Can receive `@mentions`? | Monthly cost | Notes |
|---|---|---|---|
| **(a) Interactions / HTTP only** (slash, message commands → Vercel) | **No.** Mentions are not interactions. | $0 (already on Vercel) | Keep slash `/aims here` as **connect + fallback invoke**. Cannot be the only listener. |
| **(b) Always-on gateway worker** | Yes | See host comparison below | Required for `@mention`. |
| **(c) Hybrid** | Yes | Worker cost + existing Vercel | **Pick this.** Worker is a dumb forwarder. Vercel stays the HTTP host. |

---

## Gateway host comparison (widened, Alex 2026-09-25)

Alex asked why the last pass was only Vercel vs Fly. This section compares every host he named. Official pricing/docs only. Prefer **free and reliable**. Worker needs **outbound** WebSocket + HTTPS only (no public inbound IP). Same tiny Bun/Node `ws` Identify + heartbeat + Resume + `@aims`-mention filter (not discord.js). Do not redesign the image when moving hosts.

### House credits (do not invent money)

| Source | Status | Count it? |
|---|---|---|
| **Vercel** | `aims` already runs here. Alex will pay. Treat as a **stable** HTTP host. A Vercel OSS **$3,600** platform-credit application is **pending, not applied**. | Yes as the existing app host. **No** as free Gateway money. |
| **Fly.io** | Account exists. **$0 credits.** Card on file. | Yes. After green the agent runs `flyctl auth login` (Continue with Google). Escalate only on 2FA/passkey. |
| **AWS $5k / Azure $5k+ / GCP $2k** | Identified, **not claimed**. | Mention only. Do **not** spend or assume them. |
| **Alibaba $200 coupon** | Expires **2026-09-26**. | **Ignore.** |

**Cloudflare is excluded.** The house Cloudflare account is capped and unpaid right now, so Workers / Durable Objects are not a candidate.

### Discord rules that every host must satisfy

One persistent client WebSocket: Hello → heartbeat every `heartbeat_interval` (~45s) → Identify (opcode 2) → Ready → Resume (opcode 6) on drop. ([Connection lifecycle](https://docs.discord.com/developers/events/gateway#connection-lifecycle), [heartbeats](https://docs.discord.com/developers/events/gateway#sending-heartbeats))

`session_start_limit.total` **1000** (example `reset_after` 4 h). Large bots: **1000/day**. Small-bot `max_concurrency` is **1**. Concurrent Identify → Invalid Session opcode 9. ([Get Gateway Bot](https://docs.discord.com/developers/events/gateway#get-gateway-bot), [Session Start Limit](https://docs.discord.com/developers/events/gateway#session-start-limit-object), [Rate Limiting](https://docs.discord.com/developers/events/gateway#rate-limiting))

Resume can replay missed events **only** if the same `session_id` + seq are still valid. Identify starts a **new** session and does **not** replay the gap. Two Identifies at once is worse than one restart.

### Vercel options (kept from prior research)

Treat Vercel as a stable host (Alex can pay; the hold is about credits). Personal account is Hobby; team tier unread (403). Hobby is **non-commercial** ([Fair Use](https://vercel.com/docs/limits/fair-use-guidelines), [Hobby plan](https://vercel.com/docs/plans/hobby)).

| Product | What the docs say | Holds Gateway WS 24/7? |
|---|---|---|
| **Fluid compute** | Default on new projects since 2026-04-23. Max duration Hobby **300s**; Pro **800s** GA, **1800s** (30 min) beta. ([Fluid](https://vercel.com/docs/fluid-compute), [duration](https://vercel.com/docs/functions/configuring-functions/duration)) | **No.** Dies at `maxDuration`. |
| **Functions + WebSockets (beta)** | Inbound upgrades. “WebSocket connections close when a Vercel Function reaches its maximum duration.” ([WebSockets](https://vercel.com/docs/functions/websockets)) | **No.** Discord Gateway is **outbound**. `SIGTERM` 500 ms / 30s containers. ([Functions API](https://vercel.com/docs/functions/functions-api-reference)) |
| **Sandbox** | Persistence = **filesystem snapshot**. Max session Hobby **45 min**, Pro **24 h**. ([Sandbox](https://vercel.com/docs/sandbox), [pricing](https://vercel.com/docs/sandbox/pricing)) | **No** live 24/7 socket. |
| **Workflows (WDK)** | Pause/resume for months. State stored; Functions run steps. ([Workflows](https://vercel.com/docs/workflows)) | **No.** A paused workflow cannot heartbeat. |
| **Queues** | Invoke Functions. ([Queues](https://vercel.com/docs/queues)) | **No.** |
| **Cron** | HTTP GET on a UTC schedule. ([Cron](https://vercel.com/docs/cron-jobs)) | **No.** Starts a Function that then dies. |

**Cron/Sandbox hop + RESUME** still fails: gaps lose mentions; overlap double-Identifies; Hobby 300s → ~288 Identifies/day; Resume is not a two-VM handoff. Do not ship it.

Hypothetical Vercel-as-Gateway cost if we ignored the duration wall (730 h, iad1: CPU $0.128/h, mem $0.0106/GB-h; Sandbox mem $0.0212/GB-h, min 1 vCPU / 2 GB): Functions hop ≈ **$25/mo** Pro; Sandbox hop ≈ **$40/mo**. Still not 24/7. Interactions-only is **$0 extra** and loses `@aims` mentions.

### Always-on hosts

| Host | Real monthly cost | 24/7 WS + heartbeat + Resume? | Uptime / restarts | Setup friction (not a signup if we already have it) | Ops burden |
|---|---|---|---|---|---|
| **House Linux box** (already runs Grok Bot agents) | **$0 extra** | **Yes while it is up.** Outbound WSS/HTTPS only. `systemd`/`pm2` + persist `session_id`/seq for Resume. | **No SLA. No public-inbound-IP guarantee** (fine — we do not need inbound). Restarted on Grok Bot **app/computer updates** and **occasional resets**. Honest estimate (not measured): planned restarts **minutes** each, maybe **~15–90 min/month** if updates are weekly-to-monthly; a hang while no one is watching can be **hours**. Short reboot: Resume often recovers the session. Long down: Identify; mentions in the gap are **lost**. Shared RAM/CPU with Grok agents → OOM / steal risk. | **None new.** Box already exists. Agent needs SSH or equivalent after green. Human only if access is missing. | Low-medium. We own patches, supervisor, disk for session file. Fate is tied to Grok updates. |
| **Fly.io** `shared-cpu-1x` 256 MB | **$1.94/mo** now (iad/ewr); **$2.19/mo from 2026-10-01**. ([pricing](https://fly.io/pricing/), [Oct 2026 update](https://fly.io/pricing-update/)) | **Yes.** One Machine, always-on. | Platform always-on. Restarts on our deploys; Machine comes back and Resumes. | **Account exists**, card on file, $0 credits. After green: agent `flyctl auth login` in signed-in browser (Continue with Google). Escalate only on 2FA/passkey. Then `fly deploy`. | **Lowest** among reliable hosts. Image + `fly.toml`. |
| **GCP Always Free `e2-micro`** | **$0** if 1 non-preemptible `e2-micro` in `us-west1` / `us-central1` / `us-east1`, 30 GB-months **standard** PD, 1 GB North-America egress. Limit is **hours in the month**, combined across those regions. ([Free Tier](https://docs.cloud.google.com/free/docs/free-cloud-features)) Paid rates apply outside that box. | **Yes.** Real VM. Shared-core is enough for a quiet WS. | Single-instance SLO **99.9%** ([Compute Engine SLA](https://cloud.google.com/compute/sla)). We still patch/reboot. Free Trial **$300 / 90 days** then resources **stop** unless upgraded to a Paid billing account; Always Free continues after that if we stay in limits. Trial signup **requires a card** (authorization hold, not a charge). ([same Free Tier page](https://docs.cloud.google.com/free/docs/free-cloud-features)) | **New billing project.** House GCP **$2k pack is identified, not claimed — do not count it.** Human: open/confirm a GCP billing account. Agent can create the VM after that. | Medium. We own OS, firewall, supervisor. Budget alerts so a wrong disk/region does not bill. |
| **Oracle Always Free** Ampere A1 (2 OCPU / 12 GB) or 2× `VM.Standard.E2.1.Micro` (1 GB) | **$0** in home region. ([Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)) No SLA on Free Tier. ([FAQ](https://www.oracle.com/cloud/free/faq/)) | **Yes in theory.** | **Idle reclaim:** if for **7 days** 95th-percentile CPU **< 20%**, network **< 20%**, and (A1 only) memory **< 20%**, Oracle **may reclaim** the VM. A quiet Discord heartbeat **looks idle**. FAQ also: accounts idle **30+ days** may be suspended. Capacity: “out of host capacity” is common; home region is sticky. | **New tenancy.** Card + identity for signup (authorization holds, prepaid/virtual cards refused). ([FAQ](https://www.oracle.com/cloud/free/faq/)) | High. Capacity lottery + idle policy. Burning CPU to stay “busy” is a bad idea. PAYG removes reclaim but is a paid account. |
| **Railway Trial** | **$0** + **$5** one-time / **30 days**. No card. Then reverts to Free. ([pricing](https://railway.com/pricing), [Trial](https://docs.railway.com/pricing/free-trial)) | Yes for 30 days. | Stops when trial credit is exhausted. ([FAQs](https://docs.railway.com/pricing/faqs)) | New Railway login if we want it. | Trial only. |
| **Railway Free** | **$0** + **$1/mo** credit. RAM **$10/GB-mo**, CPU **$20/vCPU-mo**. ([pricing](https://railway.com/pricing)) A 256 MB process is **~$2.56/mo RAM** → **over the $1**. A <100 MB raw-WS process can fit, barely. | Yes until the credit is gone. | **Does not sleep.** Stops when credit/trial is exhausted or a hard limit is hit; must redeploy after reset. ([FAQs](https://docs.railway.com/pricing/faqs), [cost control](https://docs.railway.com/pricing/cost-control)) | New account if we want it. | **Dev only.** Credit-exhaust-and-die. |
| **Railway Hobby** | **$5/mo** floor (includes $5 usage). Same usage rates. | **Yes.** | Always-on. Stops on failed payment or a hard usage limit. | New paid plan + card. | Low. More $ than Fly. |
| **Render Free web** | **$0.** 750 Free instance hours/month. | **No.** Spins down after **15 min** with **no inbound** HTTP or inbound WebSocket. Discord Gateway is **outbound**, so it **will** spin down. Spin-up ~1 min. May restart any time. ([Free docs](https://render.com/docs/free)) | Idle spin-down + monthly hour cap. | N/A for this worker. | Not a gateway. |
| **Render background worker** | Free instances are **web / Postgres / Key Value only** — workers are **not** free. Paid compute starts **$7/mo** (0.5 CPU / 512 MB). ([Free](https://render.com/docs/free), [pricing](https://render.com/pricing), [workers](https://render.com/docs/background-workers)) | **Yes** on paid. Workers run continuously and take no inbound traffic. | Paid = no free spin-down. | New Render account + card. | Low. **3× Fly.** |
| **Hetzner Cloud cheapest** | **CX23** (EU FSN/NBG/HEL, after 2026-06-15): **$6.49/mo** excl. VAT and excl. IPv4. IPv4 **$0.60/mo**; IPv6 free. ([price adjustment](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/), [Primary IPs](https://docs.hetzner.com/cloud/servers/primary-ips/overview/)) Outbound-only worker can skip IPv4. CAX11 ARM is $6.99. | **Yes.** Real VM. | Marketing **99.9%** uptime on the cloud product page ([hetzner.com/cloud](https://www.hetzner.com/cloud/)). We patch/reboot. | **New account** + card / identity. | Medium. Full VM. More $ than Fly. |

### House box: downtime and missed mentions

The worker is outbound-only, so the missing public inbound IP is **not** a blocker. Reliability is:

1. **Process crash** → supervisor restarts in seconds → Resume if `session_id` + seq were on disk. Mentions during those seconds are usually replayed.
2. **Grok Bot app / computer update reboot** → minutes. Resume often still works. If the session expired, Identify; those minutes of mentions are **lost**.
3. **Occasional reset / hang** → minutes to hours, no SLA, no pager. Mentions **lost** until someone notices.
4. **Resource fight** with Grok agents → stall or OOM. Same as (1) or (3).

**Do not use the house box as the only production listener** if we care about `@aims` during Grok updates. It is the honest **$0** path if Alex accepts that gap.

### Primary + cheap failover (considered, not v1)

Idea: Fly (or GCP) is primary. House box is a **warm standby** that only Identifies when the primary’s `/health` (or heartbeat posted to Vercel) is lost.

| Risk | What happens |
|---|---|
| **Split brain** | House thinks Fly is down (local net, Fly blip, deploy). Both Identify. `max_concurrency` is 1 → opcode 9 Invalid Session. **Both** drop. More missed mentions than Fly-only. |
| **Session steal** | Standby Identify **replaces** the primary session. Primary’s Resume then fails. |
| **Who starts Fly if house is primary and house is dead?** | A stopped Fly Machine is cheap (rootfs **$0.15/GB-mo**) but **something else** must start it. Vercel cron cannot hold the socket; it can only `fly machine start` if `flyctl` is authenticated there. Extra moving parts. |
| **Lease** | A Vercel-held single-owner lease (TTL > heartbeat) is the only safe guard. Not free of bugs on day one. |

**v1: one active Identify, on Fly. No standby.** Revisit house standby only after Fly is boring and we want coverage during Fly incidents.

### Ranked table (prefer free **and** reliable)

| Rank | Host | $/mo | 24/7 WS? | Reliable enough? | Why this rank |
|---|---|---|---|---|---|
| **1** | **Fly.io `shared-cpu-1x` 256 MB** | **$2.19** (from 2026-10-01) | Yes | **Yes** | Existing account, card on file, always-on, lowest ops. Near-free. |
| **2** | House Linux box | **$0** | Yes while up | **No as sole primary** | Already ours, but Grok-update restarts, no SLA, missed mentions. Best **$0 fallback** if Alex refuses $2.19. |
| **3** | GCP `e2-micro` Always Free | **$0** in the three US regions | Yes | Yes, as a single VM | Best **$0 cloud**. New billing project; **$2k credit not claimed**. More ops than Fly. |
| **4** | Railway Hobby | **$5** | Yes | Yes | Always-on, but more $ than Fly and a new paid plan. |
| **5** | Hetzner CX23 | **$6.49** (+$0.60 if IPv4) | Yes | Yes | Cheapest classic VPS. New account. More $ and ops than Fly. |
| **6** | Render background worker | **$7** | Yes | Yes | No free worker SKU. |
| **7** | Oracle Always Free A1 / E2.1.Micro | **$0** | Until reclaim | **No** | Idle-reclaim + capacity + card/identity signup. |
| **8** | Railway Free / Trial | **$0** / $5 one-time | Until credit dies | **No** | Dev only. |
| **9** | Render Free web | **$0** | **No** (spin-down) | No | Outbound WS does not keep it awake. |
| **10** | Vercel Fluid / Sandbox / Workflow / Queue / cron | $0–$40 and still wrong | **No** | No | Duration wall. |
| — | Cloudflare | — | — | — | **Excluded** (account capped, unpaid). |

### Clear pick

1. **Primary: Fly.io** `shared-cpu-1x` 256 MB at **$2.19/mo**. Hybrid: Fly holds **one** Gateway; Vercel does OAuth, Interactions, HMAC events, wakes, health aliases.
2. **Do not** make the house box the only listener. Use it only if Alex explicitly takes the $0 path and accepts missed mentions during Grok updates/resets.
3. **Do not** add a house warm-standby in v1 (duplicate-Identify / opcode 9).
4. **Do not** claim AWS/Azure/GCP credits for this ship. GCP e2-micro is the best later $0 cloud if someone completes billing.
5. **Do not** pick Oracle (reclaim), Railway Free (credit death), Render Free (spin-down), or any Vercel duration hop.
6. **Interactions-only** remains the only honest Vercel-only design, and it **loses `@aims botlord` mentions**.

After green on this pick: agent `flyctl auth login` (Continue with Google; escalate only on 2FA/passkey) → `fly deploy`.

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
| Intents | [Gateway intents](https://discord.com/developers/docs/events/gateway#gateway-intents) | `GUILDS` = `1 << 0`, `GUILD_MESSAGES` = `1 << 9`. **Do not** request `MESSAGE_CONTENT`, `GUILD_MEMBERS`, or `GUILD_PRESENCES`. Identify `intents` = `513`. |
| Privileged content | [You might not need…](https://docs.discord.com/developers/gateway/you-might-not-need-a-privileged-intent) | App mentions include `content` without the privileged intent. That is why invoke is `@aims <handle>`. |
| Interactions (slash, HTTP) | [Receiving and Responding](https://discord.com/developers/docs/interactions/receiving-and-responding) | Discord `POST`s to the Interactions Endpoint URL. Type `1` PING → `{ type: 1 }`. Type `2` APPLICATION_COMMAND. Verify Ed25519 with the app public key. **3s** to first response. Use for `/aims here` and `/aims ask` only — **not** @mentions. |
| OAuth2 **advanced** bot install | [Bot authorization flow](https://docs.discord.com/developers/topics/oauth2#bot-authorization-flow) | Ordinary `bot`+`applications.commands` is **callback-less**. We add **`identify`**, `response_type=code`, registered `redirect_uri`, and portal **Require OAuth2 Code Grant**. `state` = signed 128-bit `claimSecret`. Token URL `POST https://discord.com/api/oauth2/token` (`application/x-www-form-urlencoded`). Query `guild_id` is a **hint**; verify membership with the **bot** token. |
| Create Message | [Create Message](https://discord.com/developers/docs/resources/message#create-message) | `POST /channels/{channel.id}/messages`, `Authorization: Bot {token}`. `content` ≤ **2000**. `message_reference` for replies/threads. `allowed_mentions.parse = []`. |
| Get Channel Messages (proof) | [Get Channel Messages](https://discord.com/developers/docs/resources/message#get-channel-messages) | `GET /channels/{channel.id}/messages?limit=20` with the bot token; match the unique nonce. |
| Rate limits | [Rate Limits](https://discord.com/developers/docs/topics/rate-limits) | Do not hard-code buckets. Honor `retry_after` on 429. Global 50 req/s per token. 10k invalid (401/403/429) / 10 min → Cloudflare ban. Stop using a 404 webhook. |

### Allowed APIs (this ship)

- One shared Discord app; bot install OAuth; slash `/aims`.
- Gateway worker: Identify with `intents=513`; forward `MESSAGE_CREATE` that **@mention the app** only.
- Vercel: HMAC-verified `POST /api/v1/discord/events`, Interactions endpoint, OAuth callback, bind APIs, hardened `deliverOwnerWebhook`, Discord REST Create Message.
- Health aliases `/health` and `/api/health`.
- Additive `discord_bindings` (+ message hop/reply columns).

### Anti-patterns

- ❌ One-way incoming webhook as the product (Alex rejected; cannot receive mentions).
- ❌ Per-page Discord bot tokens in v1.
- ❌ Interactions-only “listener”.
- ❌ `MESSAGE_CONTENT` at all in v1. Filter is app-mention / slash only.
- ❌ `GUILD_MEMBERS` / `GUILD_PRESENCES`.
- ❌ Putting bot token, client secret, worker secret, or webhook URLs in public JSON, Linktree HTML, or proof script output.
- ❌ Logging those secrets. Proof scripts read env only; never `echo` them.
- ❌ Storing `DISCORD_WEBHOOK_URL` (house proof webhook) on Vercel — that is a **box/proof** secret, not an app secret.
- ❌ Putting the **bot token** only on the worker — Vercel needs it for REST replies and OAuth-adjacent REST. It **is** a Vercel runtime secret (see Needs).
- ❌ discord.js monolith on Fly (memory). Raw `ws` / `@discordjs/ws` only.
- ❌ Mentionable roles or execute-webhook display names.
- ❌ `allowed_mentions.parse` other than `[]`.
- ❌ Railway Free as the production Gateway.
- ❌ Vercel Fluid / Sandbox / Workflows / Queues / cron as the Discord Gateway.
- ❌ Prisma. Tagged `sql` only.
- ❌ Implementing in this plan PR.

---

## Architecture

```
Human / bot / group in Discord
        │  @aims botlord hello     or  /aims ask botlord hello
        ▼
Fly.io gateway worker (Identify intents=513, heartbeat, @aims-mention filter)
        │  POST /api/v1/discord/events
        │  HMAC-SHA256(timestamp || nonce || SHA-256(raw_body))
        ▼
Vercel  verify HMAC + nonce + skew; ignore worker hop
        resolve (guild_id, handle after @aims | slash handle) → contact_pages
        persist contact_messages (source=discord, hop, ids)
        deliverOwnerWebhook  (SSRF: resolve-pin-block, no private, no blind redirects)
        │  Standard Webhooks headers + X-Aims-Secret
        │  sync { ack }  and/or  async POST reply.url
        ▼
Discord  Bot Create Message as @aims
         content starts with **botlord:**
         same channel / thread, message_reference = source
         allowed_mentions.parse = []
```

### Loop guards (humans, bots, groups)

Other bots `@aims botlord` is a **feature** (multi-bot rooms). Unbounded fan-out is not.

1. **Ignore self:** drop if `author.id === botUserId` or `author.application_id === our app id`.
2. **Hop:** Vercel computes this. If `message_reference` points at a message **we** sent, `hop = parent.hop + 1`. Else `hop = 0`. Drop if `hop > 3`. Never trust a worker/client `hop`.
3. **Fan-out = 1:** first matching handle only.
4. **Pair cooldown:** 30s silence for `(guild_id, from_key, to_page_id, sha256(content))`.
5. **Rate:** `LIMITS.DISCORD_WAKE` ≈ 20 / page / minute; 5 / (page, author) / minute; **50 / guild / minute** circuit breaker. Discord 429: one retry if `retry_after < 2s`.
6. **Mentions out:** `allowed_mentions.parse = []` always. No model-controlled pings.
7. **Dedupe:** Discord `message.id` unique in durable storage. Do not wake on our own replies unless the new message also `@aims` a **different** handle.

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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (guild_id, mention_handle),
  UNIQUE (guild_id, channel_id, page_id)
);
CREATE INDEX IF NOT EXISTS idx_discord_bind_lookup
  ON discord_bindings (guild_id, channel_id);

CREATE TABLE IF NOT EXISTS discord_claims (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,        -- sha256 of display code AIMS-XXXXXX
  secret_hash TEXT NOT NULL UNIQUE,      -- sha256 of 128-bit claimSecret
  page_id TEXT NOT NULL REFERENCES contact_pages(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,       -- 15 minutes
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS discord_event_nonces (
  nonce TEXT PRIMARY KEY,
  message_id TEXT UNIQUE,                -- Discord snowflake, nullable for tests
  seen_at TIMESTAMPTZ DEFAULT NOW()
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
- `reply_token_hash TEXT` (sha256 of `rpl_…`)
- `reply_expires_at TIMESTAMPTZ`

Also hash `contact_pages.owner_token` at rest (new writes + migrate on read if a plaintext row is found). New APIs take `Authorization: Bearer` / `X-Owner-Token` only.

**Resolution order** for an inbound `@aims` mention in `(guild, channel)`:

1. Bot user must be in `mentions`. Else drop.
2. Parse the first whitespace token after the mention as a handle; match `mention_handle` in this guild (prefer this channel). **One handle only.**
3. Else if this channel has **exactly one** binding → that page.
4. Else drop (no wake). Ask them to `/aims here` or include the handle.

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
X-Aims-Timestamp: 1758830000
X-Aims-Nonce: 7f3c…   (128-bit hex, unique 24h)
X-Aims-Signature: hex(HMAC-SHA256(DISCORD_WORKER_SECRET, "{ts}.{nonce}.{sha256(raw_body)}"))
Content-Type: application/json

{
  "type": "MESSAGE_CREATE",
  "message": { /* Discord message object, as received */ }
}
```

Reject if `|now - ts| > 300s`, nonce seen, signature fail, or body > 256 KiB. Vercel returns `{ "ok": true, "wakes": 1 }` or `{ "ok": true, "ignored": "no_mention" }`. Never echo secrets. Never honor a client `hop`.

### Owner / bot connect (claim — self-serve)

Grok-style “connect me up with aims” (bot automates; human Authorizes):

```
POST /api/v1/pages
Authorization: Bearer own_…     // header only on subsequent calls
{ "name": "botlord", "webhookUrl": "https://grok.example/aims" }
→ { ownerToken, page }          // ownerToken hashed at rest; shown once

POST /api/v1/pages/:slug/connect
Authorization: Bearer own_…
{ "channels": ["discord"] }
```

```json
{
  "success": true,
  "claim": "AIMS-K7Q2M9",
  "claimSecret": "<128-bit>",
  "expiresAt": "2026-09-25T21:15:00.000Z",
  "discord": {
    "installUrl": "https://discord.com/oauth2/authorize?client_id=…&scope=bot%20applications.commands%20identify&permissions=…&redirect_uri=https%3A%2F%2Faims.bot%2Fapi%2Fv1%2Fdiscord%2Foauth%2Fcallback&response_type=code&state=<signed claimSecret>"
  }
}
```

OAuth callback `GET /api/v1/discord/oauth/callback?code&guild_id&state`:

- Verify signed `claimSecret` (single-use, 15 min). Short display code is **not** in `state`.
- Exchange `code` (`application/x-www-form-urlencoded`).
- Treat query `guild_id` as a hint. **Verify** the shared bot is a member (`GET /guilds/{id}/members/@me` with the **bot** token). If hint missing, use the user’s guild list only as a prompt — do not bind without membership proof.
- Bind that `guild_id` + **`system_channel_id`** if the bot can `SEND_MESSAGES`, else the first text channel it can. Handle = slugged page name.
- No role. No webhook.
- `POST` owner webhook (Standard Webhooks + `X-Aims-Secret`):

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
    "mention": "@aims botlord"
  }
}
```

Human-facing success page: “`@aims botlord` is live. Wrong channel? Type `/aims here` there.”

Manual / rebind (bot or edit UI, **no** second OAuth if the shared bot is already in the guild):

```
POST /api/v1/pages/:slug/discord
Authorization: Bearer own_…
{ "guildId": "111", "channelId": "222", "handle": "botlord" }
```

`GET /api/v1/claims/:code` without secret → `{ status: "pending"|"bound"|"expired" }` only.  
`GET /api/v1/claims/:code` + `X-Aims-Claim-Secret` → adds page/guild after bind.  
`DELETE /api/v1/pages/:slug/discord` + owner token unbinds.

Edit-screen **Add to Discord** is the same `installUrl` (claim minted server-side).

### Slash commands

HTTP interactions on Vercel ([Receiving and Responding](https://discord.com/developers/docs/interactions/receiving-and-responding)):

- `/aims here [handle]` — move/create binding for **this** channel. Works after the bot is in the guild.
- `/aims claim AIMS-K7Q2M9` — backup if the human used a vanilla invite (no `state`). Same bind as the OAuth callback after membership check.
- `/aims ask [handle] [text]` — primary slash invoke (HTTP; no Gateway).

### Public contact

`buildContactOptions` adds `{ id: 'discord', label: 'Discord', href: inviteOrMessageUrl, available: true, kind: 'deeplink'|'api' }` when a binding exists. No tokens.

---

## Owner connect flow (locked)

Discord **ships first** (Alex: group channels + multi-bot rooms). Telegram is the strongest cheap fast-follow. Details: [`plans/2026-09-25-bot-auth-review.md`](./2026-09-25-bot-auth-review.md).

1. **Bot (automated):** `POST /api/v1/pages` then `POST /api/v1/pages/:slug/connect { channels: ["discord"] }`. Shows `discord.installUrl` and display claim `AIMS-K7Q2M9`.
2. **Human:** open link → **pick server** → **Authorize** (2FA/CAPTCHA possible). Not “one click.”
3. **aims:** exchange code, verify bot membership, bind default sendable channel, `connect.ready`.
4. **Human (optional):** `/aims here` if the default channel is wrong.
5. **Talk:** `@aims botlord …` or `/aims ask botlord …`.

Permissions bits (install): `VIEW_CHANNEL`, `SEND_MESSAGES`, `SEND_MESSAGES_IN_THREADS`, `EMBED_LINKS`, `READ_MESSAGE_HISTORY`, `USE_APPLICATION_COMMANDS`. **No** `MANAGE_ROLES`, **no** `MANAGE_WEBHOOKS`. Document the integer from Discord’s calculator; do not guess in the `/do`.

---

## Bot auth review (adversarial)

Full review (Discord, Slack, Telegram, WhatsApp, iMessage, MCP OAuth 2.1 / RFC 7591 / CIMD, OpenAI/Claude/Grok signed webhooks, RFC 8628 device code, magic-link claims, email/SMS A2P 10DLC, **Photon / Spectrum**, **steipete `bird` CLI / Sweetistics**), ranked flows, red-team findings, and first-agent resolution (Photon + bird/Sweetistics are in that red-team scope; bird.com/MessageBird is the wrong product):

**[`plans/2026-09-25-bot-auth-review.md`](./2026-09-25-bot-auth-review.md)**

### Red-team findings

Canonical 18 findings live in the auth review (commit `d46fe50`). Discord-facing ones that changed this plan:

1. **BLOCKER — OAuth callback invalid as drawn.** Ordinary `bot`+`applications.commands` is callback-less.
2. **BLOCKER — owner webhook SSRF / DNS rebinding.** Lexical `isSafeWebhookUrl` is not enough.
3. **BLOCKER — worker bearer auth is replayable.** Need HMAC + timestamp + nonce.
4. **MAJOR — claim entropy / owner-token handling.** Short plaintext codes and query tokens.
5. **MAJOR — role/webhook impersonation.** Confusable; drop it.
6. **MAJOR — loop fan-out, 100-server gate, shared-app blast, “one click” undercount.**
7. **MAJOR — Railway Free is not production.**
8. **MAJOR — E2E proof can pass while the Gateway is broken.**

### Resolution

First agent, 2026-09-25. Every finding 1–18 is dispositioned in the auth review `### Resolution` (accept / partial / reject + reason). Discord-facing locks applied to the phases below:

| Finding | Disposition | Plan change |
|---|---|---|
| 1 OAuth callback | **Accept** | Advanced grant: `identify` + Require OAuth2 Code Grant + membership verify. `guild_id` is a hint. |
| 2 Owner webhook SSRF | **Accept** | Resolve A/AAAA, pin IP, block private/special-use, no blind redirects. |
| 3 Worker bearer | **Accept** | HMAC-SHA256(timestamp \|\| nonce \|\| SHA-256(raw_body)); 5 min skew; durable nonce + message.id. |
| 4 Claim entropy | **Accept** | 128-bit secret + ~48-bit display; both hashed; 15 min; single-use; rate limited. |
| 5 Owner tokens | **Partial** | Hash at rest; header-only on new APIs. Defer HttpOnly session / existing `editUrl?token=`. |
| 6 Role/webhook impersonation | **Accept** | Invoke `@aims <handle>` / `/aims ask`. Replies as `@aims` with handle in text. |
| 7 Loop amplification | **Partial** | Fan-out=1, no model mentions, durable dedupe. **Do not** ignore every bot author (multi-bot rooms). |
| 8 “One click” | **Accept** | Honest: pick server + Authorize + optional `/aims here`. |
| 9 100-server gate | **Accept** | Document both gates. No `MESSAGE_CONTENT`. |
| 10 Shared-app blast | **Partial** | Shared app + least perms + rotate. Prod token not in CI. |
| 11 $0 host | **Accept** | **Fly.io $2.19/mo primary** after a widened host pass. House box is $0 but not sole-primary. Railway Free = dev only. |
| 12 False E2E | **Accept** | Mandatory real human message through the **real Gateway** + Discord API reply. Synthetic is supplementary only. |
| 13 Ranking | **Partial** | Telegram wins raw cheapness. **Discord ships first** (Alex: group channels + multi-bot rooms). |
| 14 Standard Webhooks | **Accept** | Real SW headers additive on owner wakes. |
| 15–17 wording | **Accept** | WhatsApp / Photon / Sweetistics copy fixed in the review. |
| 18 omitted surfaces | **Partial** | Short appendix; not in the ship ranking. |

**Locked:** Discord ships first. Shared `aims` app. `@aims botlord`. Fly **$2.19/mo** primary after the widened host pass. Advanced OAuth. HMAC events. Hashed claims/tokens. SSRF resolve-pin-block. Real-Gateway E2E. `/health` + `/api/health` aliases stay.

---

## Implementation phases (later `/do`)

### Phase 1 — schema + wake reuse + SSRF harden

**What:** `discord_bindings` + `discord_claims` + `discord_event_nonces` + message ALTERs in `ensureContactTables()`. Hash `contact_pages.owner_token` on new writes (migrate plaintext on read). Extend `ownerWebhookPayload` with optional `discord` + `reply` (only when source is Discord). `connect.ready` payload. `createReplyToken()` / `createClaim()` (128-bit secret + ~48-bit display, **hashed**, 15 min, single-use). Loop-guard helpers (Vercel-computed hop, fan-out=1).

**Harden `deliverOwnerWebhook` (finding 2, before Discord amplification):** resolve A/AAAA immediately before connect; **pin that IP**; reject loopback / link-local / ULA / RFC1918 / metadata (`169.254.169.254`, `fd00::`, IPv4-mapped, etc.); `redirect: "error"` by default; if a single redirect is ever allowed, re-resolve + re-pin + re-check public; cap time/bytes. Keep today’s secret header. Add Standard Webhooks headers (`webhook-id`, `webhook-timestamp`, `webhook-signature` over the raw body) **in addition to** `X-Aims-Secret`.

**Copy from:** `lib/db.ts` ALTER pattern; `ownerWebhookPayload` / `deliverOwnerWebhook` in `lib/contact-pages.ts`.

**Verify:** payload tests still pass for non-Discord; Discord payload includes `reply.url` and does not leak tokens. SSRF unit tests: literal private, DNS-to-private, IPv6 ULA, IPv4-mapped, redirect-to-private all rejected. SW fixture verifies with a standard library.

**Guards:** do not change `event` name or drop `ack` parsing. No role/webhook columns.

### Phase 2 — Vercel Discord HTTP

**What:**

- `app/api/v1/discord/events/route.ts` — HMAC-SHA256(timestamp \|\| nonce \|\| SHA-256(raw_body)), 5 min skew, durable nonce + `message.id`, mention resolve (`@aims` + first handle token), persist, `deliverOwnerWebhook`, post ack via **Bot Create Message**. Never trust client `hop`.
- `app/api/v1/pages/[slug]/messages/[id]/reply/route.ts` — async reply (`X-Aims-Reply-Token`; token stored hashed).
- `app/api/v1/pages/[slug]/connect/route.ts` — mint claim + **advanced** Discord `installUrl` (`identify` + `response_type=code` + `redirect_uri` + signed `claimSecret` in `state`).
- `app/api/v1/discord/oauth/callback/route.ts` — exchange code; treat `guild_id` as a hint; **verify membership** with the bot token; bind default sendable channel; consume claim.
- `app/api/v1/pages/[slug]/discord/route.ts` — owner rebind (header token only).
- `app/api/v1/claims/[code]/route.ts` — public poll `pending|bound|expired` only; page/guild requires `X-Aims-Claim-Secret`.
- `app/api/v1/discord/interactions/route.ts` — Ed25519 PING + `/aims here` + `/aims claim` + `/aims ask`.
- `lib/discord.ts` — REST helpers: create message, get channel messages, list channels, get member `@me`. **No** execute-webhook, **no** create-role, **no** create-webhook. Redact URLs. `allowed_mentions.parse = []`.

Set Vercel **Interactions Endpoint URL** to `https://aims.bot/api/v1/discord/interactions`.

Claim rate limits: create 10/page/hour; redeem 5/IP/10 min + 20/min global.

**Copy from:** `message/route.ts` persist+deliver. Do **not** reuse lexical `isSafeWebhookUrl` for owner delivery after Phase 1 — use the pin helper. Discord’s own API is `discord.com` with the bot token (not owner-URL SSRF).

**Verify:** unit tests with mocked `fetch`: `@aims botlord` mention → inbox-shaped wake; sync ack → Discord POST as `@aims`; no app mention → ignored; self author → ignored; hop 4 → dropped; HMAC fail / stale ts / reused nonce → 401; public GET page has no webhook URL / token.

**Guards:** timing-safe HMAC compare; no raw secrets in JSON; owner tokens header-only.

### Phase 3 — gateway worker (Fly)

**What:** `discord-gateway/` (or `apps/discord-gateway`) — Hello, Identify (`intents = 513`), heartbeat, Resume. Filter `MESSAGE_CREATE` to messages that **@mention the app** (our bot user id in `mentions`). HMAC-sign `POST` to `AIMS_EVENTS_URL` (`X-Aims-Timestamp`, `X-Aims-Nonce`, `X-Aims-Signature`). Worker `/health` (`{ status, gateway: "ready"|"connecting" }`). Dockerfile + `fly.toml`. Optional `railway.toml` for **dev only** (same image).

**Verify:** local test with a mocked gateway or a recorded Hello/Dispatch fixture. Worker health 200 when Identify succeeds. Signature fixture matches Vercel verifier.

**Guards:** never log the token or HMAC key; never persist Discord at rest on the worker. Production deploy is **Fly**, not Railway Free.

### Phase 4 — UI + Linktree Discord row

**What:** Edit page: Add to Discord + connected state (guild/channel/handle, no secrets). Linktree: Discord contact when bound. Copy shows `@aims botlord`, not a fake `@botlord` user.

**Verify:** edit page source has no token; contact JSON has `discord`.

### Phase 5 — health aliases

**What:** Extract `getHealthResponse()` from `app/api/v1/health/route.ts` into `lib/health.ts`. Re-export from:

- `app/api/v1/health/route.ts`
- `app/api/health/route.ts` (new)
- `app/health/route.ts` (new)

Same JSON, 200/503, `Cache-Control: no-cache`, `X-AIMS-Version`.

**Verify:** `tests/api/health.test.ts` hits all three modules.

**Guards:** one payload only.

### Phase 6 — tests + proof script

**What:** `scripts/discord-proof.sh` (copy `scripts/bot2bot-proof.sh`).

Env (never printed, never committed):

- `DISCORD_BOT_TOKEN` — house box secret
- `DISCORD_PROOF_CHANNEL_ID` — proof channel snowflake
- `AIMS_BASE_URL` default `https://aims.bot`
- `DISCORD_E2E_NONCE` — unique string the **human** will type (required for the mandatory path)
- Optional `DISCORD_WEBHOOK_URL` — **not** used as the product inbound; may exist as a house convenience, never on Vercel

Script must `set +x` around secret use; redact URLs in all `echo`.

**Supplementary contract test only** (`--contract` / separate argv; **cannot** ship-gate alone):

1. Curl `/api/v1/health`, `/api/health`, `/health` — 200, `product=linktree`, `db=connected`.
2. `POST /api/v1/inbox` → owner stand-in (`ack: inbox-received`).
3. `POST /api/v1/pages` (header owner token) with that inbox as `webhookUrl`, name `botlord`.
4. Bind via owner API if the proof guild already has the bot.
5. HMAC-signed synthetic `POST /api/v1/discord/events` (`@aims botlord` + unique contract nonce). Assert inbox `contact.message`, `discord.handle=botlord`, `reply.url` present.
6. This path **does not** prove the Gateway. Label output `CONTRACT_ONLY`.

**Mandatory E2E (ship fails without this):**

1. Worker `/health` must be `gateway: ready`. Else **exit non-zero**. No `WORKER_E2E_SKIPPED`.
2. Human (non-bot account) types in the **real proof channel**, through the **real Discord client / Gateway**: `@aims botlord <DISCORD_E2E_NONCE>`.
3. Script polls the inbox (or recorded wake) for that **exact nonce** and asserts exactly one owner wake.
4. Script `GET https://discord.com/api/v10/channels/{id}/messages?limit=20` with `Authorization: Bot $DISCORD_BOT_TOKEN` and asserts a reply that (a) is authored by the shared bot, (b) contains the handle marker (`**botlord:**` or equivalent), (c) `message_reference` points at the human source message, (d) includes the ack/reply text. Match the nonce, not a stale common string.
5. Fail if worker health is down, if no Gateway-originated wake arrives within the wait, or if the Discord API reply is missing / uncorrelated.

**Guards:** `grep` the script for `echo "$DISCORD` — must not exist. CI runs unit tests + contract tests with mocked fetch only (no Discord token in GitHub). Prod token is not a CI secret.

---

## Final phase — production verification

After `/do` merge + **Fly** worker deploy:

1. Vercel project `aims`, production **Ready**.
2. All three health URLs 200, same JSON (`/api/v1/health`, `/api/health`, `/health`).
3. Fly worker `/health` 200, `gateway: ready`.
4. `scripts/discord-proof.sh --contract` (supplementary).
5. **Mandatory:** human types `@aims botlord <unique nonce>` in the real channel → wake → reply visible via Discord API (`message_reference` + nonce).
6. Regression: `scripts/bot2bot-proof.sh https://aims.bot`.

---

## Ship steps (later `/do`, after Alex greens)

1. Branch from latest `main` (`cursor/aims-discord-twoway-77d4` or the `/do` convention).
2. Implement Phases 1–6. Commit as you go.
3. Set Vercel env (see Needs) — required runtime secrets, **not** `DISCORD_WEBHOOK_URL`.
4. Open implementation PR; wait for `.github/workflows/ci.yml` (tsc, vitest, next build).
5. Merge to `main` (aims.bot deploys on push).
6. Babysit Vercel **Ready**.
7. **Agent Fly login (not a human signup).** Alex already has the Fly.io account. Run `flyctl auth login` and complete it in the agent's signed-in browser (Continue with Google if that's the account). Escalate only on an irreducible wall (2FA, passkey). Then deploy `discord-gateway` to **Fly.io** (`shared-cpu-1x` 256 MB). Confirm worker health. Do not deploy to the house box, Railway Free, Oracle, Render Free, or Vercel as the Gateway.
8. Register slash commands (`PUT /applications/{id}/commands`) and set Interactions URL.
9. Run health curls + contract proof + **mandatory human Gateway E2E** + `bot2bot-proof.sh`.

---

## Needs from humans

True minimum. For each: what, where it goes, whether an agent can do it.

1. **Create the Discord application** (Developer Portal → New Application, name e.g. `aims`).
   - **Human only.** Discord has no supported public API to create apps without a logged-in browser session. Agent cannot.

2. **Enable Require OAuth2 Code Grant** on the OAuth2 page (advanced bot authorization).
   - **Human only** (portal toggle). No `MESSAGE_CONTENT` toggle — v1 does not request that intent.

3. **Copy four values out of the portal** (once):
   - Bot token → **`DISCORD_BOT_TOKEN`**
   - Application / Client ID → **`DISCORD_CLIENT_ID`**
   - Client secret → **`DISCORD_CLIENT_SECRET`**
   - Public key (Interactions) → **`DISCORD_PUBLIC_KEY`**
   - **Human copies.** Agent **can** then write them to Vercel / Fly env if those CLIs are already authenticated. Never commit them or paste them into the PR.
   - **Vercel runtime secrets:** `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_PUBLIC_KEY`, generated `DISCORD_WORKER_SECRET`.
   - **Fly worker runtime secrets:** `DISCORD_BOT_TOKEN`, `DISCORD_WORKER_SECRET`, `AIMS_EVENTS_URL=https://aims.bot/api/v1/discord/events`.
   - **Not on Vercel or Fly:** `DISCORD_WEBHOOK_URL` (proof-only box secret, if used at all).

4. **Authorize the bot on one proof server** (open the advanced OAuth `installUrl`, pick server, Authorize).
   - **Human click required.** Agent generates the URL; cannot complete Discord’s consent screen.
   - After this, `/aims here` or `POST …/discord` can rebind the channel.

5. **One real human Gateway message** for ship proof (skip if interactions-only).
   - **Human types** `@aims botlord <unique nonce>` in the proof channel from a **non-bot** account. Script then verifies the wake and the Discord API reply. Agent cannot substitute a synthetic event for this step.

**Not needed from humans:** Fly.io signup or card (account exists, card on file); a house-box access grant unless Alex refuses Fly and takes the $0 path; GCP / Oracle / Hetzner / Railway / Render signups; claiming the AWS $5k, Azure $5k+, or GCP $2k packs; the Alibaba coupon; creating per-Grok Discord apps; `MESSAGE_CONTENT` portal toggle or verification form; putting a proof webhook on Vercel; a Vercel Sandbox or Fluid “always-on” Gateway.

**After green (agent, Fly primary):** run `flyctl auth login` and complete it in the signed-in browser (Continue with Google if that's the account). Escalate only on 2FA or a passkey. Then `fly deploy` the gateway (`shared-cpu-1x` 256 MB, **$2.19/mo** from 2026-10-01). House-box / GCP / Oracle / Hetzner are not this step. Interactions-only is the only design that skips Fly, and only by cutting `@aims` mentions.

---

## Out of scope

- Per-owner Discord bot tokens (advanced authenticity later, not default).
- Mentionable roles or reply-webhook display names.
- `MESSAGE_CONTENT` / reading or logging unmentioned channel messages.
- Railway Free / Trial, Render Free web, Oracle Always Free, or the house box as the **sole** production Gateway.
- A house-box warm standby that Identifies beside Fly (duplicate-Identify / opcode 9).
- Claiming AWS / Azure / GCP credit packs for this ship.
- Cloudflare Workers / Durable Objects (account capped and unpaid).
- Vercel Fluid Functions, Sandbox, Workflows, Queues, or cron-restarted hops as the Discord Gateway.
- Voice, DMs as v1 product, forum channels without `thread_id`.
- Shipping Telegram / Slack / Photon / bird in this `/do` (Telegram remains the strongest fast-follow).
- Replacing iMessage / WhatsApp / CLI bot2bot.
- Changing `event: contact.message` for non-Discord wakes.
- HttpOnly session migration for existing `editUrl?token=` (tracked follow-up from finding 5).
