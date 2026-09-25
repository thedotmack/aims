# Bot auth review (adversarial)

Date: 2026-09-25
Status: **resolved after red-team pass; awaiting Alex green**. Do not implement until this revision is approved. Findings 1–18 are dispositioned in `### Resolution`. Discord still **ships first** (Alex).
Parent plan: [`plans/2026-09-25-aims-discord.md`](./2026-09-25-aims-discord.md)

## Goal

The most automated way for someone to tell **any** bot “connect me up with aims” and have it just work. Unavoidable human steps stay named and minimal. Discord is the first channel shipped; this review ranks the rest so later channels reuse the same **claim** primitive.

Cross-cutting primitive (aims, not a vendor):

```
Grok/other bot  →  POST /api/v1/pages  (name + owner webhookUrl)
                →  POST /api/v1/pages/:slug/connect   { "channels": ["discord"] }
aims            →  { claim, expiresAt, discord: { installUrl }, … }
bot             →  shows the human one link (and the claim code as backup)
human           →  the fewest vendor-required clicks
aims            →  POST owner webhook  event: connect.ready
```

Claim codes: a **128-bit** `claimSecret` (in the install URL `state` and for status polling) plus a separately derived **~48-bit** display code (`AIMS-XXXXXX`) for typing. Both stored **hashed**. Single-use, **15 minutes**, create + redeem rate limits. Never put the short code in OAuth `state`. Owner tokens stored hashed; new APIs accept them only in headers.

---

## 1. Discord (ship first)

**Docs:** [OAuth2](https://discord.com/developers/docs/topics/oauth2) (`bot` + `applications.commands`; authorize URL; `state`; token exchange `application/x-www-form-urlencoded`); [Gateway intents](https://discord.com/developers/docs/events/gateway#gateway-intents); [You might not need a privileged intent](https://docs.discord.com/developers/gateway/you-might-not-need-a-privileged-intent); [Privileged Intent Review](https://support-dev.discord.com/hc/en-us/articles/5324827539479-Message-Content-Intent-Review-Policy) (10k unique users as of 2026-06-10, not 100 servers); [Receiving and Responding](https://discord.com/developers/docs/interactions/receiving-and-responding) (Interactions Endpoint, Ed25519, 3s); [Create Message](https://discord.com/developers/docs/resources/message#create-message); [Rate Limits](https://discord.com/developers/docs/topics/rate-limits).

There is **no** supported API to create a Discord Application or toggle privileged intents without a logged-in Developer Portal session. Bot install **always** requires a user to authorize adding the bot to a guild.

**(a) Fewest human clicks (after aims itself exists)**

1. Human tells the Grok bot “connect me up with aims” (or the bot offers it).
2. Human opens `installUrl`, **picks a server**, clicks **Authorize** (CAPTCHA/2FA possible). **Cannot be automated.** This is an **advanced bot authorization** (`bot` + `applications.commands` + `identify`, `response_type=code`, registered redirect, **Require OAuth2 Code Grant**). Ordinary `bot`+`applications.commands` is callback-less — we do not use that URL.
3. aims exchanges the code, **independently verifies** the shared bot is in that guild (REST), binds `system_channel_id` or the first text channel the bot can send in. Handle = page name. Invoke is **`@aims botlord`** (or `/aims ask botlord`). Optional: `/aims here` if the default channel is wrong.

One-time house setup (Alex, not every Grok owner): create the shared app, enable Require OAuth2 Code Grant, paste secrets. **No `MESSAGE_CONTENT` toggle** — v1 only wakes on app mentions / slash.

**(b) Bot can fully automate**

Create the aims page, register `webhookUrl`, mint claim + `installUrl`, tell the human the link, receive `connect.ready`, receive `contact.message` wakes, POST replies. After the guild is installed once, a bot with `ownerToken` can `POST /api/v1/pages/:slug/discord` to rebind channel/handle with **zero** more OAuth clicks.

**(c) Abuse / security**

| Risk | Mitigation |
|---|---|
| Spoofing inbound mentions | Only wake when the **app** is mentioned (or `/aims ask`). Ignore self / our `application_id`, `hop > 3`. |
| Token theft | One shared bot token on Vercel + worker, not per page. Never in public JSON. Rotate via portal if leaked. |
| Spam | `LIMITS.DISCORD_WAKE`; Discord 429/`retry_after`; claim 15 min single-use, hashed. |
| Impersonation | Replies are **`@aims`** with handle in the text (`**botlord:** …`). No webhook username, no mentionable role. Resolve handle only from stored bindings. |
| Replay | Claim `state` is a signed 128-bit secret. Interaction/Ed25519. Worker HMAC over timestamp+nonce+body digest. Discord message-id idempotency. |
| Bot-loop amplification | Hop cap 3, pair+content-hash 30s cooldown, default `allowed_mentions.parse = []`, mapped-mention allowlist only. |

**(d) Where it breaks**

Rate limits: 50 req/s global per token; 10k invalid/10 min Cloudflare ban. Scale gates: privileged-intent review at **10k unique users** (we avoid `MESSAGE_CONTENT` in v1) **and** app verification past **100 servers**. Cost: **Fly.io `shared-cpu-1x` 256 MB = $2.19/mo** (from 2026-10-01). Railway Free is **dev only**. One username per app — humans type `@aims botlord`, not a fake `@botlord` user.

---

## 2. Slack apps

**Docs:** [App manifests](https://docs.slack.dev/app-manifests/configuring-apps-with-app-manifests.md) (`apps.manifest.create` + app config token); [Installing via OAuth](https://docs.slack.dev/authentication/installing-with-oauth) (`https://slack.com/oauth/v2/authorize`, `oauth.v2.access`, 10-minute `code`); [Events API](https://docs.slack.dev/apis/events-api/); [Socket Mode](https://docs.slack.dev/apis/events-api/using-socket-mode) (`apps.connections.open`, no public Request URL).

**(a) Fewest human clicks**

1. Human clicks **Add to Slack** (`scope=app_mentions:read,chat:write,commands`).
2. Approve workspace install.
3. Done if we subscribe to `app_mention` and reply in the channel the mention happened (no extra channel picker).

House: create **one** Slack app (manifest API can do this with an app-config token — still needs a human to generate that token once in Slack app settings).

**(b) Bot can automate**

Same claim + install URL pattern. After install, Events API HTTP hits Vercel (no gateway worker). Socket Mode would need another always-on socket — **do not** use it; HTTP Events API is the Slack-shaped analog of Discord Interactions, and **mentions (`app_mention`) are first-class events**.

**(c) Abuse / security**

| Risk | Mitigation |
|---|---|
| Spoofing | Slack signing secret (`X-Slack-Signature`, timestamp). Reject stale timestamps. |
| Token theft | Store `xoxb-` per workspace encrypted; never public. |
| Spam | Per-team rate limits; aims wake limiter. |
| Impersonation | Bot posts as the shared Slack app name unless we use incoming webhooks with custom username (Slack may restrict). |
| Replay | Slack retry + event_id idempotency. |
| Loops | Same hop/cooldown; ignore `bot_id` of self. |

**(d) Where it breaks**

Undistributed apps: `invalid_team_for_non_distributed_app` — must enable distribution to work on other workspaces. Org-incompatible scopes. Tokens do not expire unless rotated. Cost: $0 extra (HTTP on Vercel). **Ship after Discord**, same claim UX, simpler infra (no gateway).

---

## 3. Telegram BotFather

**Docs:** [How do I create a bot?](https://core.telegram.org/bots) / [BotFather](https://core.telegram.org/bots/features) — `/newbot` is a **human chat** with `@BotFather`; username must end in `bot`; token is full control. [setWebhook](https://core.telegram.org/bots/api#setwebhook) — HTTPS POST, optional `secret_token` (1–256 `A-Z a-z 0-9 _ -`); Telegram sends `X-Telegram-Bot-Api-Secret-Token`. Ports 443/80/88/8443. `getUpdates` disabled while webhook is set.

**(a) Fewest human clicks — two models**

**Shared aims Telegram bot (recommended later):**

1. Human opens `https://t.me/aimsbot?start=<claimSecret>` (one tap; 128-bit in the start payload).
2. Taps Start. aims maps `from.id` / chat to the claim. **Done.** Groups: add `@aimsbot` to the group (one add) + `/claim AIMS-K7Q2M9` (display code).

**Per-Grok Telegram bot:**

1. Human messages `@BotFather` → `/newbot` → name → username.
2. Pastes the token into the Grok bot or aims. Then aims calls `setWebhook` itself.

**(b) Bot can automate**

`setWebhook` + `secret_token` + receive updates + `sendMessage`. **Cannot** create a bot via API. Shared-bot deep link is the automated path.

**(c) Abuse / security**

| Risk | Mitigation |
|---|---|
| Spoofing | Require `secret_token`; timing-safe header compare; reject if missing ([Bot API](https://core.telegram.org/bots/api#setwebhook)). |
| Token theft | Token = the bot. Store hashed/encrypted; rotate via BotFather `/token`. |
| Spam | Telegram flood limits; aims limiter. |
| Impersonation | Shared bot is `@aimsbot`, not `@botlord`. Per-bot usernames are unique but cost a BotFather step. |
| Replay | Telegram `update_id` monotonic idempotency. |
| Loops | Ignore messages from bots (`from.is_bot`) unless hop policy allows; cap hops. |

**(d) Where it breaks**

No BotFather API. Username locked after create. Webhook must be public HTTPS. Cost: $0. **Best second consumer channel after Discord** for “one tap.”

---

## 4. WhatsApp Cloud API

**Docs:** [Cloud API overview](https://developers.facebook.com/docs/whatsapp/cloud-api/overview/); [Service messages / 24h window](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/); [Templates](https://developers.facebook.com/docs/whatsapp/message-templates/guidelines/); [WABA / verification](https://developers.facebook.com/documentation/business-messaging/whatsapp/whatsapp-business-accounts); opt-in required for templates.

**(a) Fewest human clicks**

1. Create Meta app + WhatsApp product (dashboard).
2. Business portfolio verification (docs, legal entity — hours to days).
3. Add a business phone number (OTP to that phone).
4. Subscribe webhooks; user must **message first** (or be sent an approved template after opt-in).

This is not “connect me up” in one click.

**(b) Bot can automate**

After WABA + token + phone exist: send/receive in an open 24h window; submit templates via API (approval is Meta’s). Cannot skip verification or the inbound-first window.

**(c) Abuse / security**

| Risk | Mitigation |
|---|---|
| Spoofing | Meta signed webhooks (`X-Hub-Signature-256`). |
| Token theft | System user tokens; least privilege. |
| Spam | Quality rating, template pacing, messaging limits; unverified WABAs are tiny. |
| Impersonation | Display name review. |
| Replay | `wamid` idempotency. |
| Loops | 24h window actually **helps** (can’t free-form blast). Still hop-cap. |

**(d) Where it breaks**

24h customer-service window: outside it, **only approved templates**. Template review up to 24h. Unverified portfolio: 250 templates, low throughput. Phone number limits. Cost: Meta **per-delivered template** pricing since 2025-07-01 (not conversation-based); service messages and in-window utility templates are free. Onboarding/opt-in/templates still lose. **Do not ship in v1.**

---

## 5. iMessage options

**Official — Apple Messages for Business**  
**Docs:** [Messaging documentation](https://register.apple.com/resources/messages/messaging-documentation/) (v3.1, updated 2026-07-21); [FAQ](https://register.apple.com/resources/messages/messaging-documentation/faq); [MSP REST](https://register.apple.com/resources/messages/msp-rest-api/messages-sent); [Service Terms](https://register.apple.com/tou/bca/latest/en).

Requires an Apple-approved **MSP**. Not consumer iMessage. Live-agent escalation required. Automation must reply within 5 seconds and identify as a bot. Opaque customer IDs (no raw phone). Test account → screen recording → Apple review → commercial.

**(a) Fewest humans:** register business, pick MSP, build flows, Apple review. Days to weeks.  
**(b) Automate after MSP webhook exists:** reply `POST /message`.  
**(c)/(d):** Policy-heavy, MSP fees, not a Grok toy channel. **v1 no.**

**Unofficial — BlueBubbles / Mac relay, Sendblue, LoopMessage, and Photon Spectrum cloud lines**

These relay consumer iMessage through a Mac/phone or a vendor’s Apple IDs / managed lines. Apple does **not** publish a consumer iMessage API. Vendor ToS and Apple’s ToS both allow suspension for automation/spam. aims.bot must **not** ship or recommend these as a product path. Deep-links (`imessage:`, `sms:`) on the Linktree stay as **human tap-to-open**, not a bot channel.

Photon (photon.codes) is the named candidate Alex asked about — full write-up in **§11**. Same hard-no as the rest for **consumer iMessage**. Official business path stays Messages for Business + MSP.

**(a)** Mac always-on + Apple ID login (BlueBubbles / Photon `@spectrum-ts/imessage-local`) or vendor signup + API key (Sendblue / Loop / Photon cloud).  
**(b)** HTTP send/receive once the relay exists. Photon cloud is truly two-way (HMAC webhooks).  
**(c)** Token theft = hijack someone’s iMessage; impersonation is the product; Apple “family and friends, not commercial” + ToS nuke.  
**(d)** Account bans, no SLA. **Hard no.**

---

## 6. MCP OAuth 2.1, DCR (RFC 7591), Client ID Metadata Documents

**Docs:** [MCP Authorization (2025-11-25)](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) — OAuth 2.1 draft, RFC 8414 metadata, RFC 7591 DCR **MAY**, CIMD **SHOULD**; [draft client registration](https://modelcontextprotocol.io/specification/draft/basic/authorization/client-registration) — CIMD first for strangers, DCR “deprecated / backwards compat”; [CIMD draft](https://www.ietf.org/archive/id/draft-ietf-oauth-client-id-metadata-document-02.html) — `client_id` is an HTTPS URL, 200 JSON, `client_id` must match URL, no redirects; AS advertises `client_id_metadata_document_supported`.

**(a) Fewest human clicks**

1. Human (or host IDE) opens the AS authorize URL aims publishes.
2. Approve “Grok / Cursor / Claude” to call aims tools.

No per-bot portal app if aims publishes `https://aims.bot/.well-known/oauth-client` (CIMD) or supports DCR `registration_endpoint`.

**(b) Bot can automate**

Discover metadata, register (CIMD or DCR), start authorize, use refresh tokens, call MCP tools (`pages.create`, `discord.claim`). **Cannot** skip the user consent screen (OAuth 2.1).

**(c) Abuse / security**

| Risk | Mitigation |
|---|---|
| Spoofing | PKCE, exact redirect, state. CIMD fetch over HTTPS, no redirects, string-match `client_id`. |
| Token theft | Short access tokens, rotate refresh, bind to page owner. |
| Spam | Scope-minimal tools; rate limit `pages.create`. |
| Impersonation | CIMD URL identity ≠ display name; show the URL on the consent screen. |
| Replay | One-time auth codes (OAuth 2.1). |
| Loops | MCP tools that send messages still go through hop guards. |

**(d) Where it breaks**

CIMD is still an IETF draft. Some AS only do pre-registration. Cost: $0. **This is how IDEs/agents should talk to aims**, not how Discord humans mention `@botlord`. Complementary, not a replacement.

---

## 7. OpenAI, Claude, and Grok-style agent webhooks

**OpenAI:** [Webhooks](https://developers.openai.com/api/docs/guides/webhooks) — per-project dashboard endpoint; **Standard Webhooks** (`webhook-id`, `webhook-timestamp`, `webhook-signature`); `unwrap()`; secret shown once; retries 72h; `3xx` not followed; dedupe on `webhook-id`. Events are API lifecycle (`response.completed`, batch, Agents session), **not** “a human messaged you.”

**Claude:** [Inference hooks](https://platform.claude.com/docs/en/manage-claude/inference-hooks-endpoint) + [beta webhooks](https://platform.claude.com/docs/en/api/http/beta/webhooks.md) — same Standard Webhooks shape; `whsec_` secret; reject timestamp skew > 5 minutes; enable-hooks requires a secret.

**Grok / xAI:** no first-party “Grok agent inbound mention webhook” analogous to Discord. aims.bot’s existing `contact.message` **is** the Grok-style callback. We should optionally sign it (Standard Webhooks) so Grok bots can verify `webhook-id` / `webhook-timestamp` / `webhook-signature` in addition to today’s `X-Aims-Secret`.

**(a) Fewest humans:** dashboard “paste URL, copy secret” once per project (OpenAI/Claude). Grok: `POST /api/v1/pages` with `webhookUrl` — **zero** extra humans if the bot already has HTTPS.

**(b) Automate:** receive signed POST, return `{ ack }`, async `reply.url`.

**(c)** Spoofing → verify Standard Webhooks; token theft → rotate secret; replay → `webhook-id` + timestamp window; loops → hop on aims; spam → existing `CONTACT_MESSAGE` limit.

**(d)** OpenAI/Claude webhooks won’t create a Discord presence. Cost: $0. **Adopt Standard Webhooks on aims wakes** (additive headers) so OpenAI/Claude/Grok verifiers work the same.

---

## 8. OAuth device-code flow (RFC 8628)

**Docs:** [RFC 8628](https://www.rfc-editor.org/rfc/rfc8628.html) — client has network + can display a URI and `user_code`; user approves on a second device; client polls `grant_type=urn:ietf:params:oauth:grant-type:device-code`.

**(a) Fewest humans**

1. Bot prints `Visit https://aims.bot/device and enter AIMS-K7Q2M9` (or shows a 128-bit device link).
2. Human opens URL, logs in / pastes code, approves.

Worse than a one-click install link (two surfaces). **Better** when the bot has no way to show a clickable OAuth URL (CLI, TV, serial).

**(b) Bot automates** device-authorize + poll. Cannot approve itself.

**(c)** RFC 8628 §5: brute-force `user_code` (short alphabet + rate limit + expire); remote phishing (show the URL from aims only); poll interval / `slow_down`.

**(d)** Discord’s install is **not** device-code (Discord has no device grant for `bot` scope). Use device-code only as an aims-side pairing fallback. Cost: $0.

---

## 9. Magic-link / claim-code pairing

aims-native (no new vendor). Same claim as §cross-cutting.

**(a)** Human clicks one magic link (128-bit `claimSecret`) **or** types the ~48-bit display code (`/aims claim AIMS-K7Q2M9`, `t.me/aimsbot?start=…`).

**(b)** Bot mints claim, polls `GET /api/v1/claims/:code` until `status=bound`.

**(c)**

| Risk | Mitigation |
|---|---|
| Spoofing | Signed magic links; codes high-entropy, not `1234`. |
| Theft | 15 min, single-use, hashed at rest, bind to slug. Show page name on confirm. |
| Spam | Create 10 / page / hour; redeem 5 / IP / 10 min + 20 / min global. |
| Impersonation | Confirm screen: “Connect **botlord** to Discord guild X / channel Y?” |
| Replay | Single-use. |
| Loops | N/A at pair time. |

**(d)** If the human forwards the link, an attacker binds **their** guild — confirm screen + optional `ownerToken` cookie. Cost: $0. **This is the pairing layer for every channel.**

---

## 10. Email and SMS (Twilio A2P 10DLC)

**Email:** inbound parse (Postmark/Resend) + `Reply-To`. Human: add DNS/MX once. Spoofing: SPF/DKIM/DMARC. Spam: the entire medium. Fine as a later Linktree tap, not a group @mention channel.

**SMS — Twilio A2P 10DLC:** [Twilio A2P 10DLC](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc) — anyone sending US app-to-person 10DLC **must** register Brand + Campaign (TCR). Business legal info, samples, opt-in/out/help. Sole prop vs standard. Campaigns can be rejected. Per-message cost.

**(a)** Console or API brand → wait → campaign → wait → number. Many humans.  
**(b)** Send/receive after approval.  
**(c)** 10DLC exists because of spam; STOP/HELP required; loop via SMS is expensive (good).  
**(d)** Vetting delays, carrier filters, $ brand/campaign fees + per SMS. **v1 no.**

---

## 11. Photon (Spectrum) — iMessage tooling

**Confirmed product (high confidence — this is the one Alex means).**  
**Photon / Spectrum** at [photon.codes](https://photon.codes). Agent messaging infrastructure whose flagship is a **managed consumer-iMessage API**, plus SMS/RCS fallback, WhatsApp Business, Telegram, SIP voice on those lines, and a local Mac Messages-db adapter. Product name in docs is **Spectrum**; company is Photon (`photon-hq` on GitHub).

| Source | URL |
|---|---|
| Home | [photon.codes](https://photon.codes) |
| Pricing | [photon.codes/pricing](https://photon.codes/pricing) |
| Docs | [photon.codes/docs](https://photon.codes/docs) (index also at [docs.photon.codes/docs/llms.txt](https://docs.photon.codes/docs/llms.txt)) |
| iMessage provider | [docs: cloud vs local](https://photon.codes/docs/spectrum-ts/providers/imessage) |
| Webhooks | [docs: HMAC webhooks](https://photon.codes/docs/spectrum-ts/webhooks) |
| Management API | [docs: API](https://photon.codes/docs/api-reference) — `https://spectrum.photon.codes` |
| Dashboard / ToS | [app.photon.codes](https://app.photon.codes) / [Terms](https://app.photon.codes/terms-of-service) (effective 2026-07-13 / 2026-08-12) |

**Confidence:** **high (~90%)**. Alex said “iMessage tooling.” photon.codes is the only well-known **Photon** whose product *is* iMessage tooling for agents. If he meant something else, these are the collisions:

| Candidate | What it is | iMessage? |
|---|---|---|
| **Photon / Spectrum (`photon.codes`)** | Agent messaging + managed iMessage lines | **Yes — pick this** |
| Photon Engine (`photonengine.com`) | Game netcode (PUN / Fusion) | No |
| VMware Photon OS | Container Linux distro | No |
| Intel / optics “Photon” | Hardware / research, not a chat API | No |
| Random Photon lighting / camera / crypto products | Unrelated | No |

Ask Alex only if he did **not** mean “the iMessage agent API.” Otherwise lock this.

**Channels unlocked**

| Channel | How | Notes |
|---|---|---|
| **iMessage (consumer)** | Cloud: `@spectrum-ts/imessage` on managed shared or dedicated lines. Local: `@spectrum-ts/imessage-local` reads `~/Library/Messages/chat.db` on a signed-in Mac. | DMs, groups (Business+), reactions, effects, attachments, polls / iOS 26 features. **Not** Apple Messages for Business. **Not** an official Apple bot API. |
| **SMS / RCS** | Fallback on the same lines | Included on Free/Pro/Business. TCPA / A2P still apply (their ToS). |
| **WhatsApp Business** | Official Cloud API provider | Marketing site + Business/Enterprise tiers. Same Meta humans as §4. |
| **Telegram** | Bot API via Fusor webhooks | Included even on Free. Does not beat `t.me/aimsbot?start=CLAIM`. |
| **SIP voice** | On iMessage lines | Business+. Not a group @mention channel. |
| **Discord / Slack** | Marketing mentions; docs say “built for later” / `definePlatform` custom providers | **Not** a reason to buy Photon. We already plan first-party Discord + Slack. |

**Two-way?** **Yes.** Inbound + outbound. Two receive modes: long-lived `app.messages` stream, or HTTP `POST` via `app.webhook()` (native HMAC-SHA256 over `v0::` + 5-minute replay window, or Fusor protobuf with the provider’s own signature). Handler is fire-and-forget after the HTTP ack; dedupe on `message.id`. Management API can CRUD webhook URLs once `projectId` + `projectSecret` exist.

**Automated connecting (clicks vs API)**

Cloud iMessage is **not** “one Authorize click.”

1. **Human (once, house):** create a Photon dashboard account, create a project, copy `PROJECT_ID` / `PROJECT_SECRET`. No public “create account” API — dashboard / CLI device-flow / OAuth 2.1 for *Photon users*, not for aims owners.
2. **Bot after that:** management API (Basic `projectId:projectSecret`) can issue iMessage tokens, toggle platforms, register webhooks. Runtime send/receive is SDK or webhook.
3. **Each Grok owner “connect me up”:** Free/Pro use **managed shared numbers** — Photon assigns each of *their* users a fresh number they have never been texted from. Connect UX is “text this number,” not an OAuth install. Business ($250/line/mo) is one dedicated number everyone texts. Local path: a Mac always on, Messages signed in, Full Disk Access.
4. **Cannot** mint an Apple-blessed iMessage identity over an API. Cannot skip dashboard signup. Cannot make `@botlord` appear as a consumer iMessage handle without a phone line Photon controls.

Compare Discord: 1 human Authorize. Photon: account + project + (shared number assignment or $250 line) + the other human texting that number.

**(a) Fewest human clicks:** Photon signup → create project → give aims the secret → give the other human a phone number to text. Several humans. Not self-serve for a stranger bot.  
**(b) Bot can automate:** after secrets exist — tokens, webhooks, send/reply. **Cannot** create the Photon org, cannot create an Apple ID, cannot legally stand up consumer iMessage.

**Pricing (checked 2026-09-25, [photon.codes/pricing](https://photon.codes/pricing))**

Cash is tight. Photon’s free tier is real, then it jumps.

| Plan | Money | Caps |
|---|---|---|
| **Open source / local** | $0 + your Mac | Your iCloud / phone as the agent number. Always-on box. Same unofficial risk as BlueBubbles. |
| **Free** | **$0** | Managed **shared** numbers. iMessage + SMS/RCS + Telegram. **10 users.** “Unlimited daily messages with Auto Scale” on the card; comparison table also shows daily-message footnotes — treat 10 users as the hard cap. |
| **Pro** | **$25/mo** | Shared numbers. **100 users.** Same channel set. |
| **Business** | **$250 / line / mo** | **Dedicated** iMessage line. Unlimited users (Auto Scale). Groups, cold outreach up to **50 new contacts/day**, WhatsApp, phone. |
| **Enterprise** | Custom | Own the numbers, SLA. |

No published per-iMessage fee on Free/Pro (bundled). SMS/RCS “included” still sits under their TCPA/A2P ToS — do not assume carrier-free bulk SMS. WhatsApp on Business/Enterprise is **custom**, not a published $0.005.

**Abuse / ToS (Apple + Photon)**

Apple, [Messages & Privacy](https://www.apple.com/legal/privacy/data/en/messages/) (updated 2025-12-12): *“iMessage is intended for communicating with family and friends, and is not for conducting commercial activities or disseminating unwanted messages. iMessage misuse may result in service limitations.”*

Official commercial path is **Apple Messages for Business** + an approved MSP ([Apple FAQ](https://register.apple.com/resources/messages/messaging-documentation/faq)): registered business, one commercial account, no group chat with the business, say “Apple Messages” not “iMessage.” Photon cloud lines are **consumer iMessage**, not M4B.

Photon [ToS](https://app.photon.codes/terms-of-service): you are solely responsible for TCPA, FCC, CAN-SPAM, CTIA, **A2P/10DLC**; affirmative opt-in; STOP/UNSUBSCRIBE; no spam; they may suspend immediately; **you indemnify them** for carrier fines; liability cap is fees paid in 12 months or **$100**. They do **not** claim Apple authorized commercial consumer-iMessage bots. Business tier literally sells **cold outreach** (50 new contacts/day) — that is the opposite of Apple’s “family and friends” sentence.

Local Mac path: Full Disk Access to `chat.db` = the agent *is* that Apple ID. Ban = that person’s iMessage dies.

**(c) table**

| Risk | Mitigation if we ever touched this (we should not) |
|---|---|
| Spoofing inbound | HMAC webhook secret; reject skew > 5 min. |
| Token theft | `projectSecret` is full control. Rotate via CLI. Never public JSON. |
| Spam / 10DLC | Photon’s problem and **ours** (indemnify). STOP/HELP. |
| Impersonation | Shared-pool numbers are not `@botlord`. Dedicated line is a rented phone, not a Discord role. |
| Replay | `message.id` + HMAC window. |
| Loops | Same hop/cooldown. iMessage groups make amplification worse. |
| **Apple policy** | **No mitigation that keeps consumer iMessage.** Use M4B or do not ship. |

**(d) Where it breaks / verdict vs building it ourselves**

Photon does **not** beat building Discord (or Telegram, or Slack) ourselves. Those have official bot APIs, $0 channel cost, and a one-click/tap connect. Photon does **not** beat building official iMessage ourselves either — the official product is M4B + MSP, which Photon is not.

What Photon *does* buy is unofficial consumer-iMessage plus a TS SDK. That is the same class as Sendblue / LoopMessage, with a nicer free tier (10 users, $0) and a worse Apple-policy story if we productize it. **Do not ship as a production consumer-iMessage path.** Unsupported by Apple; suspension, continuity, and TCPA/A2P risk. That is platform policy, not a legal holding. A quarantined 10-user experiment would still not outrank Telegram/Discord. Revisit only if Apple blesses a consumer bot API or we later pick an MSP for Messages for Business.

---

## 12. bird CLI → Sweetistics (X / Twitter)

**Correction:** this is **not** [bird.com](https://bird.com) / MessageBird. That CPaaS evaluation is withdrawn. One-line leftover: MessageBird-now-Bird is a later SMS/WhatsApp/email aggregator if we ever want one; it is not Alex’s “bird.”

**Confirmed CLI (very high confidence — ~95%).**  
**`bird`** is Peter Steinberger’s (**[steipete](https://github.com/steipete)**) X/Twitter CLI. npm **[@steipete/bird](https://www.npmjs.com/package/@steipete/bird)** (v0.8.0, 2026-01-19). Homebrew `steipete/tap/bird`. Marketing site **[bird.fast](https://bird.fast)** (CLI install page, not a hosted app). Original GitHub **`github.com/steipete/bird`** now **404** (private or removed; [v0.1.0 notes](https://newreleases.io/project/github/steipete/bird/release/v0.1.0) still point there). Public mirrors: [jawond/bird](https://github.com/jawond/bird) (steipete 52 commits; homepage bird.fast), [rsaisankalp/bird](https://github.com/rsaisankalp/bird). The published README’s own disclaimer: undocumented X **web GraphQL** + **cookie auth**; expect it to break.

**Adjacent product / historical transport (relationship unverified on current bird).**  
**[Sweetistics](https://sweetistics.com)** is a same-author X analytics product. Historical bird v0.1 notes and some forks mention `--engine sweetistics` + `SWEETISTICS_API_KEY` → `/api/actions/tweet`. Current `@steipete/bird@0.8.0` README is GraphQL/cookie-only and documents no hosted bird. Sweetistics Pro is advertised **€49/month** (not $49) with API access; **purchasing is disabled**. Treat Sweetistics as adjacent, not “the SaaS edition of bird.”

| Source | URL |
|---|---|
| CLI npm | [npmjs.com/package/@steipete/bird](https://www.npmjs.com/package/@steipete/bird) |
| CLI site | [bird.fast](https://bird.fast) |
| Author | [github.com/steipete](https://github.com/steipete) (Peter Steinberger) |
| SaaS | [sweetistics.com](https://sweetistics.com) / [pricing](https://sweetistics.com/pricing) |
| SaaS CLI | [npmjs.com/package/sweetistics](https://www.npmjs.com/package/sweetistics) |
| Public source mirror | [github.com/jawond/bird](https://github.com/jawond/bird) |

**Other candidates (not this bird):**

| Candidate | What it is |
|---|---|
| **bird.com / MessageBird** | Multichannel CPaaS. **Wrong product.** Dropped. |
| **bird.fast as a hosted API** | Landing page for the CLI binary. No signup, no keys, no inbound webhooks. |
| **steipete/birdclaw** | Separate “store tweets for agents” repo. Not the CLI/SaaS. |
| **bird-dm** (`tolibear`) | Third-party **read-only** DM add-on on `@steipete/bird`. Not official. |
| **@connormartin/bird** | npm clone of the steipete README. |
| **xsh / xfetch / x-agent-sdk** | Other cookie-GraphQL X CLIs. Same ToS class, different authors. |

If Alex meant a hosted “bird API” that is **not** Sweetistics, it is not a public product we can find. Ask only then.

**Channels unlocked**

| Surface | bird CLI (`@steipete/bird`) | Sweetistics SaaS |
|---|---|---|
| **X posts / replies** | `tweet`, `reply` (GraphQL `CreateTweet`; error 226 → legacy `statuses/update.json`) | `/api/actions/tweet` when API key present |
| **Mentions** | `bird mentions` (poll / search shortcut; defaults to the cookie user) | Same via CLI engine; no documented mention-push API |
| **Read / search / threads** | `read`, `thread`, `replies`, `search`, `home`, `user-tweets` | Cached timeline + `force=true` on thread/replies |
| **Social graph / lists / bookmarks / likes / news** | Yes (CLI) | Analytics / Friendimizer / Pulse (product, not a bot mention channel) |
| **X DMs** | **No** in official 0.8.0 | Not a documented DM bot API. Pulse “webhook” is analytics. Third-party `bird-dm` reads inbox only. |
| **Discord / iMessage / WhatsApp / SMS** | No | No |

**Two-way?** **Partial, poll-only — not a webhook wake.** A process can `bird mentions` then `bird reply`. There is **no** inbound mention/DM HTTP webhook on bird.fast or in the published CLI. Sweetistics Pro advertises Pulse **webhooks** for profile/timeline drift, not “someone @mentioned the bot.” Official two-way X is the **X Activity API** (webhooks billed per event) — that is building on X, not using bird.

**(a) Fewest human clicks**

Cookie engine (CLI):

1. Human already logged into x.com in Safari/Chrome/Firefox on a Mac bird can read. **0 extra clicks** if that box is the worker. Remote / Vercel: human must **export `auth_token` + `ct0`** (DevTools or `bird check`) and paste them into env. That is handing over the web session.
2. No X OAuth “Authorize app” screen. No Developer Portal app. **Cannot** be done by a stranger bot on someone else’s laptop.

Sweetistics engine:

1. Human `sweetistics login` (device auth) or dashboard signup.
2. Attach an X session (their stack still uses cookie / GraphQL helpers — not X OAuth we can see).
3. Copy `SWEETISTICS_API_KEY` (API access is a **Pro** row). **Purchasing disabled** today, so this path may be invite-only.
4. Bot sets the env and POSTs. Still **not** one Authorize click, and **not** self-serve over a public API without a human account.

**(b) Bot can automate:** tweet/reply/read/poll mentions **after** cookies or a Sweetistics key exist. **Cannot** create an X session, cannot complete Sweetistics login, cannot mint a legal X app token.

**Pricing (checked 2026-09-25; cash tight)**

| Item | Money | Source |
|---|---|---|
| **bird CLI** | **$0** (MIT). You bring an X account. | [npm](https://www.npmjs.com/package/@steipete/bird), [bird.fast](https://bird.fast) |
| **Sweetistics Free** | **$0.** Timeline snapshots, **10 AI reports/mo**. **No API access.** | [sweetistics.com/pricing](https://sweetistics.com/pricing) |
| **Sweetistics Pro** | Advertised **€49/mo** (GPT-5 analysis, Friendimizer, Pulse, **API access**, export). **“Purchasing disabled during beta.”** | same |
| **Official X API** (if we build the channel ourselves, ToS-legal) | Pay-per-use, **no free tier** for new apps. Create post **$0.015** (**$0.20** with a URL; summoned reply **$0.010**). Post read **$0.005**. **Owned** mentions **$0.001**/resource. DM event read **$0.010**; `dm.received` / `chat.received` webhook **$0.010**/event. 3M post-read cap/cycle. | [docs.x.com pricing](https://x-preview.mintlify.app/x-api/getting-started/pricing) (canonical live table is Developer Console / developer.x.com) |

Cash-tight read: the CLI looks free until X bans the account. Sweetistics Pro is $49/mo **and cannot be bought**. Official X is pennies per post until a mention-poll or webhook loop runs; then reads add up. Discord remains $0.

**Abuse / ToS (X API, cookies, bans)**

X [Developer Guidelines](https://x-preview.mintlify.app/developer-guidelines): **“Use only the official X API. No scraping, browser automation, or unofficial methods. Violations result in permanent suspension.”** Non-API automation is listed as a prohibited activity with **permanent ban**. Automated accounts must use the official API, label as Automated, disclose the operator, reply only when the user engaged first (max 1), DM only after the user DMs first. **AI-generated replies require prior approval from X.**

bird’s GraphQL + `auth_token`/`ct0` path **is** unofficial session replay. The CLI says so. Sweetistics posting through `/api/actions/tweet` does not become official OAuth because a vendor wraps it. Cookie theft = full account takeover (post, DM, settings). Giving those cookies to Sweetistics is giving a third party the session. Query IDs rotate; 429s are “aggressive” on GraphQL (fork README). Error 226 (“automated request”) is X already classifying the traffic.

**(c) table**

| Risk | Mitigation if we ever touched this (we should not, unofficially) |
|---|---|
| Spoofing inbound | Mentions are polled, not signed webhooks. Anyone who can run `bird mentions` with the cookies is “us.” |
| Token / cookie theft | `auth_token` is the account. Never in public JSON. Rotate by logging out all X sessions. |
| Spam / unsolicited replies | X automation rules: user-initiated only. Hop cap still. |
| Impersonation | Posts as the **human’s** X account, not `@aims` / `@botlord`. |
| Replay | Poll cursors + tweet id idempotency. No vendor delivery id. |
| Loops | Ignore self; hop ≤ 3. Public X makes amplification worse. |
| **X ToS / ban** | **No mitigation on the cookie/Sweetistics path.** Official X API + OAuth + Automated label is the only shippable mitigation. |

**(d) Where it breaks / verdict vs building it ourselves**

bird / Sweetistics does **not** beat building **Discord** (or Telegram, or Slack). Those are official, $0, and one click/tap.

It also does **not** beat building **X ourselves on the official API**. The legal product is X OAuth + pay-per-use + Activity API webhooks + Automated label + (for AI replies) X approval. bird’s value is “skip the Developer Portal and the per-post bill” by replaying a browser session. That is the same class of risk as unofficial iMessage. **Do not ship the cookie/Sweetistics path.**

Official X as a later aims channel is possible and expensive — rank it with WhatsApp, not with Discord. Connect would still need a human X OAuth consent, not `bird whoami` on a laptop.

---

## RANKED recommendation

| Rank | Flow | Human steps after “connect me up with aims” | Ship |
|---|---|---|---|
| **1** | **Discord shared app + advanced OAuth + `@aims <handle>`** (Alex: group channels + multi-bot rooms) | Open link, pick server, Authorize; optional `/aims here` | **Ships first** (product call, not cheapest) |
| **2** | Telegram shared bot + `t.me/aimsbot?start=CLAIM` | **1 tap** Start (groups: + add bot) | **Strongest fast-follow** — would win a raw cheapness/fewest-step ranking |
| 3 | Slack shared app + Add to Slack (`app_mention`; may need a channel invite) | Approve workspace (+ invite) | After Telegram; easier infra than Discord |
| 4 | aims claim / magic-link / RFC 8628 device code | 1 click or type code | Pairing layer for all of the above |
| 5 | MCP OAuth 2.1 + CIMD (DCR fallback) | 1 consent screen | Agent/IDE connect, not Discord mentions |
| 6 | Signed Standard Webhooks (OpenAI/Claude-compatible headers on aims wakes) | 0 if `webhookUrl` already set | Additive on existing bot2bot |
| 7 | Email inbound (Postmark/Resend) | DNS once | Later |
| 8 | WhatsApp Cloud API | Meta verify + phone + 24h/templates | Not v1 |
| 9 | SMS A2P 10DLC | Brand + campaign + number | Not v1 |
| 10 | Apple Messages for Business + MSP | Business + MSP + Apple review | Not v1 |
| 11 | Official X API (OAuth + pay-per-use + Activity webhooks) | X Authorize + Developer credits + Automated label (+ AI-reply approval) | Not v1 — legal X path |
| — | **bird CLI / Sweetistics** (cookie GraphQL or `$49` Pro API, purchasing disabled) | Browser session or Sweetistics login | **Do not ship** |
| — | **Photon Spectrum** as the Discord/Telegram/Slack layer | Photon account + project | **Reject** — first-party APIs already win |
| — | Unofficial iMessage (**Photon cloud/local**, BlueBubbles, Sendblue, LoopMessage) | Mac or vendor line | **Do not ship** |
| — | Per-owner Discord/Slack/Telegram app tokens as the default | Portal + intents per bot | Reject for v1 |

### Ship-first Discord self-serve (locked)

Telegram would win a **literal cheapest / fewest-tap** ranking. **Alex’s call stands: Discord ships first** because aims is for **group channels and multi-bot rooms**, which Discord already is. Telegram is the strongest #2 / fast-follow.

```
Human → Grok: "connect me up with aims"
Grok  → POST /api/v1/pages { name, webhookUrl }
         Authorization: Bearer own_…   (header only; token hashed at rest)
Grok  → POST /api/v1/pages/:slug/connect { "channels": ["discord"] }
      ← { claim: "AIMS-K7Q2M9",          // ~48-bit display code, hashed
          claimSecret,                   // 128-bit; also in state
          discord: { installUrl: "https://discord.com/oauth2/authorize?client_id=…&scope=bot%20applications.commands%20identify&permissions=…&redirect_uri=https%3A%2F%2Faims.bot%2Fapi%2Fv1%2Fdiscord%2Foauth%2Fcallback&response_type=code&state=<signed claimSecret>" },
          expiresAt, ownerToken, page }
Grok  → Human: "Add me to your Discord server: {installUrl}"
Human → pick server → Authorize         ← required vendor steps
aims  → exchange code; verify bot membership via REST (guild_id is a hint)
      → bind system/first sendable text channel; handle=slugified name
      → POST owner webhook { event: "connect.ready", discord: { mention: "@aims botlord", guildId, channelId } }
Human → talks with @aims botlord …     or  /aims ask botlord …
Human → optional /aims here            if the default channel is wrong
```

Unavoidable humans named:

1. **Discord pick-server + Authorize** — Discord will not add a bot without a user. Agent cannot.
2. **(House, once)** Create shared Discord app + **Require OAuth2 Code Grant** + paste secrets. No MESSAGE_CONTENT.
3. **(Optional)** `/aims here` if the default channel is wrong.

**Not a human need:** Fly.io. Alex already has the account. After green the agent runs `flyctl auth login` in its signed-in browser (Continue with Google if that's the account) and deploys the **$2.19/mo** gateway. Escalate only on 2FA or a passkey.

Everything else is the Grok bot.

---

### Red-team findings

Red-team pass performed 2026-09-25 by a second model. Findings are ordered by severity, then blast radius.

#### 1. **BLOCKER — the claimed Discord callback does not exist for the URL shown**

- **Claim attacked:** `scope=bot applications.commands&response_type=code&state=...` yields the planned callback with `code`, `guild_id`, and the signed claim, making install-and-bind a one-click flow.
- **Evidence:** Discord calls ordinary bot authorization “server-less and callback-less”; a code callback occurs only when requesting an additional scope outside `bot` and `applications.commands`. Discord also says callback `guild_id` is only a hint. See [Discord OAuth2 — Bot Authorization Flow and Advanced Bot Authorization](https://docs.discord.com/developers/topics/oauth2#bot-authorization-flow). The URL in this review requests no additional scope.
- **Recommended fix:** choose and test one real flow: (A) extended authorization with at least `identify`, `response_type=code`, exact redirect, state, and **Require OAuth2 Code Grant** enabled, then exchange the code and independently verify bot membership; or (B) callback-less install followed by `/aims claim`, a signed install event, or Gateway `GUILD_CREATE`. Do not call it “one click” until a browser test proves state round-trip, guild authority, and membership.

#### 2. **BLOCKER — owner-supplied webhook delivery remains an SSRF primitive**

- **Claim attacked:** today’s `isSafeWebhookUrl` is safe to reuse for arbitrary bot-owned webhook URLs.
- **Evidence:** `lib/contact-pages.ts` blocks obvious literal IPv4/private hostnames but does not resolve DNS, pin the address, cover all IPv6/special-use/encoded forms, or prevent DNS rebinding between validation and `fetch`. `redirect: "error"` only closes redirects. OWASP requires allowlisting where possible and DNS-pinning/rebinding defenses: [SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).
- **Recommended fix:** use a dedicated egress proxy with a public-IP policy; resolve and validate every A/AAAA answer immediately before connection; pin the destination; block metadata and all special-use ranges; cap request/response size and time; and verify ownership with a challenge. Do not add Discord amplification before this is fixed.

#### 3. **BLOCKER — worker authentication is replayable bearer auth, not HMAC**

- **Claim attacked:** `X-Aims-Worker-Secret: ...` makes fake Gateway events trustworthy and replay-safe.
- **Evidence:** the API shape sends one static value over arbitrary JSON with no timestamp, body digest, nonce, or delivery ID. Discord instead requires Ed25519 verification over timestamp plus the **raw body** and deliberately probes endpoints with invalid signatures: [Interactions security](https://docs.discord.com/developers/interactions/overview#security-and-authorization). A leaked worker value permits forged authors/guilds/channels/message IDs and unlimited replay.
- **Recommended fix:** sign `version || timestamp || delivery_id || SHA-256(raw_body)` with a separate key, reject clock skew, enforce unique delivery/message IDs in durable storage, rotate keys, schema/size-limit the body, and never trust client-supplied `hop`.

#### 4. **MAJOR — claim-code entropy and redemption controls are inadequate**

- **Claim attacked:** `AIMS-7K2P`, 30-minute expiry, single use, and 10 claims/page/hour are sufficient.
- **Evidence:** four base32-like symbols are roughly 20 bits (about one million possibilities), the schema stores the code in plaintext, and public status is an oracle. Creation limits do not constrain distributed redemption. RFC 8628 warns that short user codes need strong rate limits and that device flows are phishable: [RFC 8628 §5](https://www.rfc-editor.org/rfc/rfc8628.html#section-5).
- **Recommended fix:** use a 128-bit link secret and separately derived 40–50-bit manual code; store only digests; require the long polling secret for status; limit redemption globally/per-claim/account/IP/guild/user; and show the exact page/guild/channel for authorized confirmation. Never put the short code itself in OAuth `state`.

#### 5. **MAJOR — owner-token handling turns browser history into takeover**

- **Claim attacked:** owner credentials are protected because they are absent from public page JSON.
- **Evidence:** current code returns `editUrl?...token=<ownerToken>` and accepts tokens from query strings and bodies (`app/api/v1/pages/route.ts`, `app/api/v1/pages/[slug]/route.ts`, `lib/contact-pages.ts`). Query credentials leak via history, copied URLs, analytics, screenshots, and possibly referrers. Owner tokens, webhook secrets, and URLs are recoverable plaintext in the database.
- **Recommended fix:** remove query/body bearer auth; exchange a one-time fragment/code for an `HttpOnly; Secure; SameSite=Strict` session; accept API tokens only in headers; hash owner/reply/claim tokens; encrypt webhook credentials; and add rotation, revocation, audit, and URL redaction.

#### 6. **MAJOR — role/webhook identity is deliberately confusable**

- **Claim attacked:** role `botlord` plus webhook display name `botlord` is a safe identity substitute; the Discord plan also says role names are unique per guild.
- **Evidence:** webhook messages expose `webhook_id`; webhook authors are not users; execution permits arbitrary `username`/`avatar_url`: [Message object](https://docs.discord.com/developers/resources/message#message-object) and [Execute Webhook](https://docs.discord.com/developers/resources/webhook#execute-webhook). Role authority is by snowflake, not name, and same-named roles are allowed. Any member allowed to mention a mentionable role can trigger it; a manager can create a visually identical role/webhook.
- **Recommended fix:** keep one unmistakable `@aims` sender and render “**botlord via aims**”; make `/aims ask botlord` or `@aims botlord` primary. If aliases remain, resolve only stored IDs, show a proxy marker, require channel/role ACLs, and never convert model display text into authority.

#### 7. **MAJOR — loop guards still allow cross-page amplification**

- **Claim attacked:** hop ≤3, pair/content cooldowns, and 20 wakes/page/minute make bot loops safe.
- **Evidence:** each inbound may fan out to multiple handles and each reply may mention multiple targets; a branching factor of two yields 15 wakes through hop 3 before retries, edits, distinct content, pages, or guilds evade the key. Arbitrary inbound Discord messages have no trustworthy parent/hop. Discord also has per-route buckets and a 50 request/s global bot limit: [Discord rate limits](https://docs.discord.com/developers/topics/rate-limits).
- **Recommended fix:** v1 should ignore every bot and webhook author and suppress all model-controlled mentions. Later require aims-issued correlation, durable queue/dedupe, fan-out=1, global/guild/conversation budgets, circuit breakers, owner opt-in, and kill switches.

#### 8. **MAJOR — “one click” omits required choices, authority, and channel setup**

- **Claim attacked:** the human only clicks Authorize; aims can safely bind the system/first text channel and create role/webhook.
- **Evidence:** guild install requires a member with `MANAGE_GUILD`, and the UI requires server selection unless preselected: [Discord install](https://docs.discord.com/developers/quick-start/getting-started#installing-your-app). `system_channel_id` can be null/unsuitable and channel overrides can deny access. Roles/webhooks require broad `MANAGE_ROLES`/`MANAGE_WEBHOOKS` and hierarchy constraints: [Create Role](https://docs.discord.com/developers/resources/guild#create-guild-role), [permissions](https://docs.discord.com/developers/topics/permissions#role-object), [Create Webhook](https://docs.discord.com/developers/resources/webhook#create-webhook).
- **Recommended fix:** count open link, select server, review/authorize (plus possible CAPTCHA/2FA), then select/confirm channel or `/aims here`. Verify the member has `MANAGE_GUILD` and the bot has effective permissions in that exact channel. The revised `@aims` architecture should request fewer permissions.

#### 9. **MAJOR — 10,000-user intent review does not remove the 100-server gate**

- **Claim attacked:** “not 100 servers” fully replaces Discord’s old scale threshold.
- **Evidence:** privileged-intent review did move to 10,000 unique reachable users, with a 90-day application window and annual review: [Intent Review](https://support-dev.discord.com/hc/en-us/articles/5324827539479-Message-Content-Intent-Review-Policy). Separately, Discord still requires **app verification past 100 servers**: [App Verification](https://support-dev.discord.com/hc/en-us/articles/23926564536471-How-Do-I-Get-My-App-Verified).
- **Recommended fix:** document both. Avoid `MESSAGE_CONTENT`, `MANAGE_ROLES`, and `MANAGE_WEBHOOKS` by making direct `@aims` mentions or commands primary; direct app mentions expose content without the privileged intent: [Message Content alternatives](https://docs.discord.com/developers/gateway/you-might-not-need-a-privileged-intent).

#### 10. **MAJOR — shared app is right by default; its selected privilege model is not**

- **Claim attacked:** one shared token is low risk and shared versus BYO is binary.
- **Evidence:** Discord describes bot tokens as passwords used for Gateway and most REST calls: [OAuth2 and permissions](https://docs.discord.com/developers/platform/oauth2-and-permissions#bot-users). One token avoids N owner secrets but compromise reaches every guild. This plan copies it to Vercel, Railway, and proof environments while requesting powerful permissions.
- **Recommended fix:** retain shared-app v1, but use one identity and least permissions; isolate production/proof applications; vault/rotate tokens; alert on guild/role/webhook changes; and document incident-wide revocation. Keep BYO as an advanced authenticity option, not default.

#### 11. **MAJOR — `$0/month` is possible, not a production availability budget**

- **Claim attacked:** a sub-100 MB Railway worker fits the $1 credit and is reliably always-on for $0.
- **Evidence:** Railway Free is real, but RAM is $10/GB-month and CPU $20/vCPU-month: [Railway pricing](https://railway.com/pricing). At 100 MB, memory alone is about $0.98/month, leaving almost nothing for CPU/egress; workloads stop when limits/credits exhaust: [Railway FAQ](https://docs.railway.com/pricing/faqs). Fly is $1.94 now and $2.19 from 2026-10-01: [Fly pricing](https://fly.io/pricing), [update](https://fly.io/pricing-update/). Cloudflare’s free allowance is real, but outbound sockets do not hibernate: [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/). “Vercel cannot hold WebSockets” is outdated; Fluid Functions now can, but close at max duration: [Vercel WebSockets](https://vercel.com/docs/functions/websockets).
- **Recommended fix:** budget Railway Hobby ($5) or Fly ($2.19 plus storage/traffic) for production; label Railway Free best-effort development. Measure RSS/CPU for a billing cycle, set hard limits/downtime alerts, and make Resume/session-start handling robust. Keep a separate gateway; duration-limited Vercel is not a better Discord listener.

#### 12. **MAJOR — the E2E proof can pass while the product is broken**

- **Claim attacked:** `discord-proof.sh` proves two-way Discord.
- **Evidence:** the required path injects a synthetic event directly into Vercel, bypassing Discord, Gateway intents/Identify/heartbeat/resume, Railway, and real mention parsing. The live path is optional and exits zero when skipped; only a human covers end-to-end. Searching five messages for a common string can match stale output.
- **Recommended fix:** label the synthetic test a contract test. Add a mandatory deployed E2E using a unique nonce from a separate non-bot actor, real Gateway delivery, exactly one owner wake, one correlated reply, and exact reply/message-reference assertion. Fail when worker health or live delivery fails.

#### 13. **MAJOR — ranking and human-step counts are wrong for the cash-first goal**

- **Claim attacked:** Discord is unambiguously rank 1; Telegram and Slack each take one click.
- **Evidence:** Telegram supports private `start` and group `startgroup` links carrying the claim, with privacy mode limiting group inputs: [Telegram deep links](https://core.telegram.org/bots/features#deep-linking). Discord requires server authorization, channel confirmation, and a gateway. Slack `app_mention` only arrives in conversations the app has joined, so an extra invite may be required: [Slack `app_mention`](https://docs.slack.dev/reference/events/app_mention).
- **Recommended fix:** for the literal stated goal, rank **Telegram shared bot first**, Discord second for richer guild/group workflows, Slack after it. If Discord ships first for product-market reasons, say that instead of calling it cheapest/fewest-step. Separate transports from pairing/auth primitives (claims, device flow, MCP OAuth, signed webhooks).

#### 14. **MAJOR — current wake auth is not Standard Webhooks compatibility**

- **Claim attacked:** aims can adopt OpenAI/Claude-compatible Standard Webhooks as a trivial additive header.
- **Evidence:** `deliverOwnerWebhook` sends a reusable `X-Aims-Secret` with no body signature, timestamp, delivery ID, replay window, or retry idempotency. Header renaming is not the Standard Webhooks contract.
- **Recommended fix:** implement and fixture-test exact canonical raw-body signing (prefer standard libraries), unique ID, timestamp window, stable retry ID, per-page secret rotation, and replay rejection. Do not claim SDK compatibility until official verifiers accept an aims fixture.

#### 15. **MINOR — WhatsApp pricing is stale, though rejection remains sound**

- **Claim attacked:** WhatsApp uses conversation-based pricing.
- **Evidence:** Meta replaced it with **per delivered template message** pricing on 2025-07-01; non-template service messages and utility templates in an open window are free: [official update](https://developers.facebook.com/docs/whatsapp/pricing/updates-to-pricing/).
- **Recommended fix:** update the cost wording. Keep WhatsApp below official free bot channels because business/phone onboarding, opt-in, templates, and policy overhead still lose.

#### 16. **MINOR — Photon is identified correctly, but “illegal” overstates the evidence**

- **Claim attacked:** Photon identity is uncertain and any use is categorically illegal.
- **Evidence:** Photon’s docs call the product Spectrum and describe Free/Pro shared-pool versus Business dedicated iMessage: [routing](https://photon.codes/docs/spectrum-ts/providers/imessage/connection-and-routing); [pricing](https://photon.codes/pricing) supports $0/10 users, $25/100, and $250/line. Apple says iMessage is intended for family/friends, not commercial activity, and misuse may cause limitations: [Messages & Privacy](https://www.apple.com/legal/privacy/data/en/messages/). That is platform policy, not a legal holding.
- **Recommended fix:** say “unsupported consumer-iMessage path with suspension, continuity, and compliance risk; not production-approved.” The no-ship verdict is fair. A quarantined opt-in 10-user experiment is possible only with explicit acceptance of account/line loss; it still does not outrank Telegram/Discord.

#### 17. **MINOR — `bird` is right; “Sweetistics is its SaaS” is unproven**

- **Claim attacked:** bird is `@steipete/bird` and Sweetistics is confidently its hosted SaaS.
- **Evidence:** current [`@steipete/bird`](https://www.npmjs.com/package/@steipete/bird) explicitly uses undocumented X GraphQL and cookies. Historical v0.1 notes mention a Sweetistics engine, but the current package README is GraphQL-only. Sweetistics describes a separate analytics product with API access on a **€49/month** Pro tier whose purchasing is disabled; it documents no bird mention/DM webhook or “hosted bird” relationship: [Sweetistics pricing](https://sweetistics.com/pricing). X requires official API use and approval for AI replies: [X guidelines](https://x-preview.mintlify.app/developer-guidelines).
- **Recommended fix:** call it a same-author adjacent product and historical optional transport, with current relationship unverified; correct `$49` to `€49`. Keep the rejection of cookie replay. Official X prices are volatile; X says its console is authoritative: [X API pricing](https://x-preview.mintlify.app/x-api/getting-started/pricing).

#### 18. **MINOR — “ANY bot” omits several official surfaces**

- **Claim attacked:** ranks 1–11 cover the meaningful universe.
- **Evidence:** omitted options include Google Chat HTTP `@mention` events (public distribution needs Marketplace review: [Google Chat](https://developers.google.com/workspace/chat/interaction-events)); signed GitHub App webhooks/replies ([GitHub](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/using-webhooks-with-github-apps)); tagged opt-in Bluesky bots ([Bluesky](https://docs.bsky.app/docs/starter-templates/bots)); Matrix Application Services ([Matrix](https://spec.matrix.org/latest/application-service-api/)); and Microsoft Teams consent/store friction ([Teams](https://learn.microsoft.com/en-us/microsoftteams/manage-consent-app-permissions)).
- **Recommended fix:** add an omitted-channels appendix ranked on the same dimensions. GitHub/Bluesky matter for agents; Google Chat/Teams for groups; Matrix for bridge-native identities but not one-click arbitrary homeservers.

### Resolution

First agent, 2026-09-25. Every finding below. Plan phases in [`plans/2026-09-25-aims-discord.md`](./2026-09-25-aims-discord.md) are rewritten to match.

| # | Finding | Disposition | Why / plan change |
|---|---|---|---|
| 1 | BLOCKER — OAuth callback invalid as drawn | **Accept** | Ordinary `bot`+`applications.commands` is callback-less. **v1 uses advanced bot authorization:** scopes `bot applications.commands identify`, `response_type=code`, exact `redirect_uri`, **Require OAuth2 Code Grant** on. `state` carries a **signed 128-bit claimSecret**, not the short code. Callback exchanges the code, then **verifies bot membership** with the bot token (`GET /users/@me/guilds` / `GET /guilds/{id}/members/@me`). Query `guild_id` is a hint only. Backup: `/aims claim` + `/aims here` + `GUILD_CREATE` cache. Do not call it “one click” — it is pick-server + Authorize (+ optional channel). |
| 2 | BLOCKER — owner webhook SSRF | **Accept** (defenses specified; full dedicated egress proxy later) | Discord amplification must not ship on lexical `isSafeWebhookUrl`. **v1:** resolve A/AAAA immediately before connect; **pin that IP**; reject loopback/link-local/ULA/private/metadata (`169.254.169.254`, `fd00::`, IPv4-mapped, etc.); **do not follow redirects** unless the next hop is re-resolved, re-pinned, and still public (max 1 hop; default `redirect: "error"`); cap time/bytes. Ownership challenge stays as today’s secret header. Dedicated egress proxy is a follow-up, not a Discord-ship gate if pin+block holds. |
| 3 | BLOCKER — worker bearer auth | **Accept** | Replace `X-Aims-Worker-Secret` bearer. Worker sends `X-Aims-Timestamp`, `X-Aims-Nonce`, `X-Aims-Signature = HMAC-SHA256(key, timestamp \|\| nonce \|\| SHA-256(raw_body))`. Reject skew > 5 min; persist nonce + Discord `message.id` (unique, 24h); schema/size-limit; **never trust worker-supplied `hop`** — Vercel computes it. Rotate `DISCORD_WORKER_SECRET` independently of the bot token. |
| 4 | MAJOR — claim entropy | **Accept** | Drop `AIMS-7K2P` (≈20 bits). Mint 128-bit `claimSecret` + ~48-bit display code. Store **only digests**. TTL **15 min**, single-use. Create: 10/page/hour. Redeem: 5/IP/10 min + 20/min global. Status poll that reveals page/guild requires `claimSecret`. Confirm screen names the page. Short code is never OAuth `state`. |
| 5 | MAJOR — owner-token in query/history | **Partial accept** | **Accept now:** hash `owner_token` / reply tokens / claim secrets at rest; new Discord/connect APIs accept owner tokens **only in headers**; never put `own_` in query strings we add. **Defer:** HttpOnly session cookies and killing existing `editUrl?token=` — that’s a product-wide auth migration, not the Discord ship. Track as follow-up. Encrypt webhook secrets when we touch that column. |
| 6 | MAJOR — role/webhook impersonation | **Accept** | Drop mentionable roles and reply webhooks. Shared app stays. Invoke is **`@aims <handle>`** or **`/aims ask <handle>`**. Replies are Bot Create Message as **`@aims`** with `**botlord:**` (or equivalent) in content. Removes `MANAGE_ROLES`, `MANAGE_WEBHOOKS`, and the need for `MESSAGE_CONTENT` (app mentions include content). |
| 7 | MAJOR — loop amplification | **Partial accept** | **Accept:** `allowed_mentions.parse = []` always (no model-controlled pings); fan-out **= 1** (first matching handle only); durable message-id dedupe; per-guild circuit breaker; do not trust inbound `hop`. **Reject “ignore every bot author” for v1** — Alex’s core use is multi-bot rooms; other bots must be able to `@aims botlord`. Hop increments only when `message_reference` points at an aims-sent message; otherwise hop=0 + per-author cooldown. Self / our `application_id` still ignored. |
| 8 | MAJOR — “one click” undercounts | **Accept** | Honest steps: open link, pick server, Authorize (2FA/CAPTCHA possible), optional `/aims here`. Verify installer has `MANAGE_GUILD` when the code grant gives us the user. Least permissions (no role/webhook manage). Auto-bind default channel only if the bot can `SEND_MESSAGES` there. |
| 9 | MAJOR — 100-server gate still exists | **Accept** | Document **both** 10k-user privileged-intent review **and** verification past 100 servers. v1 avoids `MESSAGE_CONTENT` so the 10k review is not on the critical path. 100-server verification is a later house task if we grow. |
| 10 | MAJOR — shared app vs privilege blast | **Partial accept** | **Accept** shared app + least permissions + vault/rotate + incident-wide revoke. **Partial** on separate prod vs proof applications: do it if Alex will click twice in the portal; otherwise one app and never put the prod token in CI. BYO remains advanced, not default. |
| 11 | MAJOR — $0 is not production | **Accept** | **Production gateway: Fly.io `shared-cpu-1x` 256 MB = $2.19/mo** (price from 2026-10-01; $1.94 until then). Always-on, not credit-exhaust-and-die. Alex already has Fly; after green the agent runs `flyctl auth login` (Continue with Google; escalate only on 2FA/passkey) then `fly deploy`. Railway Free = **dev/laptop only**. Railway Hobby ($5) is the fallback if Fly is refused. Vercel Fluid WebSockets exist but close at max duration — **not** the Gateway host. |
| 12 | MAJOR — E2E proof can pass false | **Accept** | `discord-proof.sh` **fails** unless a **real human** (non-bot) message with a unique nonce travels the **real Gateway** and a correlated reply is visible via Discord REST. HMAC-signed synthetic injection is a **supplementary contract test** only (`--contract` / separate exit). No `WORKER_E2E_SKIPPED` exit 0. |
| 13 | MAJOR — ranking / human-step counts | **Partial accept** | On raw cheapness/fewest taps, **Telegram wins**. Ranking table now says so. **Ship order is Discord first** — Alex: group channels and multi-bot rooms are the product. Telegram is the strongest #2 / fast-follow. Slack may need a channel invite; counts updated. Pairing primitives stay below transports. |
| 14 | MAJOR — not actually Standard Webhooks | **Accept** | Owner wakes implement real Standard Webhooks (`webhook-id`, `webhook-timestamp`, `webhook-signature` over raw body) **in addition to** today’s `X-Aims-Secret`. Fixture-tested against a standard library. Header rename alone is forbidden. Additive; existing bots keep working. |
| 15 | MINOR — WhatsApp pricing stale | **Accept** | §4 now says per-delivered template pricing (2025-07-01). Still not v1. |
| 16 | MINOR — Photon “illegal” | **Accept** | Softened to unsupported / suspension / compliance risk. No-ship stands. |
| 17 | MINOR — Sweetistics ≠ proven bird SaaS | **Accept** | Sweetistics is same-author adjacent / historical transport. €49, purchasing disabled. Cookie path still do-not-ship. |
| 18 | MINOR — omitted official surfaces | **Partial accept** | Short appendix below. Do not expand the ship ranking. GitHub/Bluesky later for agents; Google Chat/Teams for work groups; Matrix is a bridge, not one-click. |

**Locked after resolution**

- Discord **ships first** (Alex). Telegram is the cheapest fast-follow.
- Shared `aims` app. Identity `@aims <handle>` / `/aims ask`. No roles, no reply webhooks.
- Gateway on **Fly at $2.19/mo**. Railway Free is not production.
- Advanced OAuth code grant + membership verify. HMAC worker events. Hashed claims/tokens. SSRF resolve-pin-block. Real Gateway E2E.

#### Omitted official surfaces (finding 18)

Not ranked for v1. Same dimensions (clicks, $0, official two-way):

- **GitHub Apps** — signed webhooks, replies on issues/PRs. Good agent surface; not a group chat.
- **Bluesky** — tagged opt-in bots. Public firehose, not a guild.
- **Google Chat** — HTTP `@mention`; Marketplace review for public.
- **Microsoft Teams** — admin consent / store friction.
- **Matrix Application Services** — native bridge identity; not one-click on arbitrary homeservers.
