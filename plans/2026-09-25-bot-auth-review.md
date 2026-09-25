# Bot auth review (adversarial)

Date: 2026-09-25
Status: **awaiting Alex green + red-team pass**. A second, different-model agent will attack these conclusions — including **§11 Photon** and **§12 bird (steipete / Sweetistics)**. `### Red-team findings` and `### Resolution` are left empty on purpose.
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

Claim codes are short (`AIMS-7K2P`), single-use, 30 minutes, bound to `slug` + hashed `ownerToken`. Install URLs carry `state=<signed claim>`.

---

## 1. Discord (ship first)

**Docs:** [OAuth2](https://discord.com/developers/docs/topics/oauth2) (`bot` + `applications.commands`; authorize URL; `state`; token exchange `application/x-www-form-urlencoded`); [Gateway intents](https://discord.com/developers/docs/events/gateway#gateway-intents); [You might not need a privileged intent](https://docs.discord.com/developers/gateway/you-might-not-need-a-privileged-intent); [Privileged Intent Review](https://support-dev.discord.com/hc/en-us/articles/5324827539479-Message-Content-Intent-Review-Policy) (10k unique users as of 2026-06-10, not 100 servers); [Receiving and Responding](https://discord.com/developers/docs/interactions/receiving-and-responding) (Interactions Endpoint, Ed25519, 3s); [Create Message](https://discord.com/developers/docs/resources/message#create-message); [Rate Limits](https://discord.com/developers/docs/topics/rate-limits).

There is **no** supported API to create a Discord Application or toggle privileged intents without a logged-in Developer Portal session. Bot install **always** requires a user to authorize adding the bot to a guild.

**(a) Fewest human clicks (after aims itself exists)**

1. Human tells the Grok bot “connect me up with aims” (or the bot offers it).
2. Human opens the bot’s `installUrl` and clicks **Authorize** (must pick a server). **This click cannot be automated.**
3. Done. aims binds `guild_id` from the OAuth redirect plus `system_channel_id` (or the first text channel the bot can send to). Handle = page name. Optional later: `/aims here` in another channel (not required for first connect).

One-time house setup (Alex, not every Grok owner): create the shared app, enable `MESSAGE_CONTENT`, paste secrets (see parent plan Needs).

**(b) Bot can fully automate**

Create the aims page, register `webhookUrl`, mint claim + `installUrl`, tell the human the link, receive `connect.ready`, receive `contact.message` wakes, POST replies. After the guild is installed once, a bot with `ownerToken` can `POST /api/v1/pages/:slug/discord` to rebind channel/handle with **zero** more OAuth clicks.

**(c) Abuse / security**

| Risk | Mitigation |
|---|---|
| Spoofing inbound mentions | Only wake on mapped role / bot mention. Ignore self, our reply webhooks, `hop > 3`. |
| Token theft | One shared bot token on Vercel + worker, not per page. Never in public JSON. Rotate via portal if leaked. |
| Spam | `LIMITS.DISCORD_WAKE`; Discord 429/`retry_after`; claim 30 min single-use. |
| Impersonation | Display name via channel webhook is not identity. Role `@botlord` is guild-local. Do not claim it’s a unique Discord user. |
| Replay | Claim `state` nonce + expiry. Interaction/Ed25519. Worker HMAC. `webhook-id`-style message id idempotency. |
| Bot-loop amplification | Hop cap 3, pair+content-hash 30s cooldown, default `allowed_mentions.parse = []`, mapped-mention allowlist only. |

**(d) Where it breaks**

Rate limits: 50 req/s global per token; 10k invalid/10 min Cloudflare ban. Policy: `MESSAGE_CONTENT` review at 10k users — drop to “must @aims” if review fails. Cost: Railway Free $0 (or Fly $1.94). One username per app — `@botlord` is a **role**, not a second bot user.

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

1. Human opens `https://t.me/aimsbot?start=AIMS-7K2P` (one tap).
2. Taps Start. aims maps `from.id` / chat to the claim. **Done.** Groups: add `@aimsbot` to the group (one add) + `/claim AIMS-7K2P`.

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

24h customer-service window: outside it, **only approved templates**. Template review up to 24h. Unverified portfolio: 250 templates, low throughput. Phone number limits. Cost: conversation-based pricing. **Do not ship in v1.**

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

1. Bot prints `Visit https://aims.bot/device and enter AIMS-7K2P`.
2. Human opens URL, logs in / pastes code, approves.

Worse than a one-click install link (two surfaces). **Better** when the bot has no way to show a clickable OAuth URL (CLI, TV, serial).

**(b) Bot automates** device-authorize + poll. Cannot approve itself.

**(c)** RFC 8628 §5: brute-force `user_code` (short alphabet + rate limit + expire); remote phishing (show the URL from aims only); poll interval / `slow_down`.

**(d)** Discord’s install is **not** device-code (Discord has no device grant for `bot` scope). Use device-code only as an aims-side pairing fallback. Cost: $0.

---

## 9. Magic-link / claim-code pairing

aims-native (no new vendor). Same claim as §cross-cutting.

**(a)** Human clicks one magic link **or** types a 6–8 char code in the target surface (`/aims claim AIMS-7K2P`, `t.me/aimsbot?start=…`).

**(b)** Bot mints claim, polls `GET /api/v1/claims/:code` until `status=bound`.

**(c)**

| Risk | Mitigation |
|---|---|
| Spoofing | Signed magic links; codes high-entropy, not `1234`. |
| Theft | 30 min, single-use, bind to slug. Show page name on confirm. |
| Spam | 10 claims / page / hour. |
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

What Photon *does* buy is unofficial consumer-iMessage plus a TS SDK. That is the same class as Sendblue / LoopMessage, with a nicer free tier (10 users, $0) and a worse Apple-policy story if we productize it. **Do not ship. Do not recommend as the aims iMessage path.** Revisit only if Apple blesses a consumer bot API or we later pick an MSP for Messages for Business.

---

## 12. bird CLI → Sweetistics (X / Twitter)

**Correction:** this is **not** [bird.com](https://bird.com) / MessageBird. That CPaaS evaluation is withdrawn. One-line leftover: MessageBird-now-Bird is a later SMS/WhatsApp/email aggregator if we ever want one; it is not Alex’s “bird.”

**Confirmed CLI (very high confidence — ~95%).**  
**`bird`** is Peter Steinberger’s (**[steipete](https://github.com/steipete)**) X/Twitter CLI. npm **[@steipete/bird](https://www.npmjs.com/package/@steipete/bird)** (v0.8.0, 2026-01-19). Homebrew `steipete/tap/bird`. Marketing site **[bird.fast](https://bird.fast)** (CLI install page, not a hosted app). Original GitHub **`github.com/steipete/bird`** now **404** (private or removed; [v0.1.0 notes](https://newreleases.io/project/github/steipete/bird/release/v0.1.0) still point there). Public mirrors: [jawond/bird](https://github.com/jawond/bird) (steipete 52 commits; homepage bird.fast), [rsaisankalp/bird](https://github.com/rsaisankalp/bird). The published README’s own disclaimer: undocumented X **web GraphQL** + **cookie auth**; expect it to break.

**Confirmed SaaS (high confidence — ~80% this is “the SaaS version”).**  
**[Sweetistics](https://sweetistics.com)** — steipete-orbit Twitter/X analytics + actions host. npm [`sweetistics`](https://www.npmjs.com/package/sweetistics) (homepage sweetistics.com; depends on `github:steipete/node-twitter-api-v2`). Early bird releases and the jawond mirror document `--engine sweetistics|graphql|auto` and `SWEETISTICS_API_KEY` → Sweetistics **`/api/actions/tweet`** (optional `--sweetistics-base-url` for self-host). Published `@steipete/bird@0.8.0` README is GraphQL/cookie-only; the SaaS engine lives in earlier tags / forks. Sweetistics Pro marketing lists **“Pulse monitoring with webhook + API access.”** Purchasing is **disabled** (beta).

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
| **Sweetistics Pro** | Advertised **$49/mo** (GPT-5 analysis, Friendimizer, Pulse, **API access**, export). **“Purchasing disabled during beta.”** | same |
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
| **1** | **Discord shared app + claim + OAuth install URL** (auto-bind system/first text channel; `/aims here` to move) | **1 click:** Authorize + pick server | **First** |
| 2 | Telegram shared bot + `t.me/aimsbot?start=CLAIM` | **1 tap** Start (groups: + add bot) | Next consumer channel |
| 3 | Slack shared app + Add to Slack (`app_mention`) | **1 click** Approve workspace | After Telegram; easier infra than Discord |
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

### Rank-1 Discord self-serve (locked)

```
Human → Grok: "connect me up with aims"
Grok  → POST /api/v1/pages { name, webhookUrl }
Grok  → POST /api/v1/pages/:slug/connect { "channels": ["discord"] }
      ← { claim: "AIMS-7K2P",
          discord: { installUrl: "https://discord.com/oauth2/authorize?client_id=…&scope=bot%20applications.commands&state=<signed claim>",
                     expiresAt },
          ownerToken, page }
Grok  → Human: "Click to add me to your Discord server: {installUrl}"
Human → Authorize (pick server)     ← ONLY required vendor click
aims  → bind guild_id + system_channel_id + handle=slugified name
      → role + reply webhook
      → POST owner webhook { event: "connect.ready", discord: { mention, guildId, channelId } }
```

Unavoidable humans named:

1. **Discord Authorize + pick server** — Discord will not add a bot without a user. Agent cannot.
2. **(House, once)** Create shared Discord app + MESSAGE_CONTENT toggle + paste secrets.
3. **(Optional)** `/aims here` if the default channel is wrong.

Everything else is the Grok bot.

---

### Red-team findings

_(empty — second, different-model agent fills this. In scope: ranks 1–11, the Discord self-serve lock, **§11 Photon** (product identity, Apple consumer-iMessage ToS, $0/10-user vs $25/$250, “does not beat building Discord”), and **§12 bird / Sweetistics** (steipete CLI identity, Sweetistics as the SaaS, cookie vs official X API, two-way-is-poll-only, $0 CLI / $49 Pro disabled, X ToS + ban risk, “does not beat Discord or official X”). MessageBird/bird.com is **out of scope** — wrong product.)_

### Resolution

_(empty — fold red-team findings here)_
