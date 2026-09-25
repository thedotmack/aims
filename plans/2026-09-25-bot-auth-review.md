# Bot auth review (adversarial)

Date: 2026-09-25
Status: **awaiting Alex green + red-team pass**. A second, different-model agent will attack these conclusions — including **§11 Photon** and **§12 Bird**. `### Red-team findings` and `### Resolution` are left empty on purpose.
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

Photon (photon.codes) is the named candidate Alex asked about — full write-up in **§11**. Same hard-no as the rest for **consumer iMessage**. Official business path stays Messages for Business + MSP (Bird can be that MSP later; see **§12**).

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
**(d)** Vetting delays, carrier filters, $ brand/campaign fees + per SMS. **v1 no.** Bird (§12) is a later aggregator for this row, not a way around 10DLC.

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

What Photon *does* buy is unofficial consumer-iMessage plus a TS SDK. That is the same class as Sendblue / LoopMessage, with a nicer free tier (10 users, $0) and a worse Apple-policy story if we productize it. **Do not ship. Do not recommend as the aims iMessage path.** Revisit only if Apple blesses a consumer bot API or we later pick an MSP for Messages for Business (Bird can be that, §12).

---

## 12. Bird (formerly MessageBird)

**Confirmed product (high confidence — this is the one Alex means).**  
**Bird** at [bird.com](https://bird.com), the CPaaS formerly **MessageBird**. Multichannel messaging API (email, SMS, WhatsApp, RCS, voice, social, Apple **Business** Chat). Docs: [docs.bird.com](https://docs.bird.com). Pricing index: [bird.com/pricing](https://bird.com/pricing). Not consumer iMessage; not Photon.

**Confidence:** **high (~95%)**. “Bird, formerly MessageBird, multichannel messaging API” matches bird.com exactly. Collision worth naming: **Bird** the email client / other “Bird” apps — none are the CPaaS. If Alex meant a different Bird, he would not have said MessageBird.

**Channels unlocked** (Channels API inbound list, [message status and interactions](https://docs.bird.com/api/channels-api/message-status-and-interactions))

| Channel | Two-way inbound event | Official? |
|---|---|---|
| **SMS / MMS** | `sms.inbound` | Yes (carriers + **A2P 10DLC** in the US) |
| **WhatsApp** | `whatsapp.inbound` / `whatsapp.received` | Yes (Meta Cloud API behind Bird) |
| **Email** | `email.inbound` | Yes |
| **RCS** | interactions (read/click/unsubscribe) | Yes (Google / carrier RCS) |
| **LINE, Instagram, Facebook, Viber, LinkedIn, TikTok, Telegram** | `.inbound` per platform | Yes, each network’s rules |
| **Apple Business Chat** | `apple business chat` inbound | Yes — **Messages for Business**, not consumer iMessage |
| **Voice / push** | product pages; not the group-mention path | Yes |
| **Consumer iMessage** | — | **No** |

**Two-way?** **Yes**, when you subscribe. Bird POSTs signed JSON. Current Notifications API follows **Standard Webhooks** (`webhook-id`, `webhook-timestamp`, `webhook-signature`, `whsec_` secret, 5-minute skew, at-least-once, ~27.5h retries) — [webhooks](https://docs.bird.com/api/notifications-api/api-reference/webhook-subscriptions). Older Channels subscriptions also support a Twilio-shaped template and a `signingKey` you set. Inbound is optional: “only needed if you need to receive inbound messages (2-way).” Outbound without a webhook is one-way.

**Automated connecting (clicks vs API)**

Bird is **API-friendly after a workspace exists**. It is **not** “connect me up with aims” in one click.

1. **Human (once, house):** create a Bird workspace. Test API key is instant. Production unlocks after a **payment method** + **verify a sender** ([US SMS pricing page](https://bird.com/en-us/products/sms/pricing/us)).
2. **Email:** verify a domain (DNS). Free plan, **no card**, 1,000 emails/mo ([email pricing](https://bird.com/pricing/email)).
3. **SMS US:** rent a number (API) + **10DLC Brand + Campaign** (TCR). Humans/docs/legal entity. Same wall as Twilio §10.
4. **WhatsApp:** connect a number / WABA. Meta business verification, display-name review, **templates**, **24h service window** — Bird does not waive Meta. Bot can submit templates; Meta still approves.
5. **Apple Business Chat:** Apple business registration + MSP relationship + Apple review. Days to weeks. Same as §5 official.
6. **Webhooks:** **bot can** `POST /v1/webhooks` or `bird webhooks create` once it has a key with `webhooks:write`. No extra human click to attach the URL.

A Grok bot **cannot** finish Meta or 10DLC or Apple review. After those exist, the bot can send, subscribe to inbound, and reply. Number rent is API (`/pricing/numbers`).

**(a) Fewest humans:** workspace + (domain **or** 10DLC **or** Meta **or** Apple). Many.  
**(b) Bot automates:** keys, numbers, webhooks, send/receive **after** the channel is verified. Cannot skip verification.

**Pricing (checked 2026-09-25; cash tight)**

Bird’s pitch: no platform fee, no per-seat, pay for use. That is **not** free SMS/WhatsApp.

| Item | Published rate | Source |
|---|---|---|
| **Email Free** | **$0**, 1,000 emails/mo, **no card**, no time limit. Sandbox does not count. | [bird.com/pricing/email](https://bird.com/pricing/email) |
| Email Startup | from **$15/mo** (50k) / **$30/mo** (100k) | same |
| Email Growth | from **$80/mo** | same |
| Dedicated IP | **$24.95/mo** (Growth+) | same |
| **SMS US** long code / toll-free | **$0.0035 / segment** outbound; short code $0.0070. **Carrier fees extra** (e.g. AT&T $0.0035 in + out). | [bird.com/pricing/sms](https://bird.com/pricing/sms), [fees](https://bird.com/en-us/pricing/sms/fees) |
| **US number rental** | Local **$1/mo**, toll-free **$2/mo** | [bird.com/pricing/numbers](https://bird.com/pricing/numbers) |
| **10DLC** | Brand **$4.50**; campaign submission **$15**; monthly campaign **~$10** typical (low-volume **$1.50**, some use-cases $30) | [SMS fees](https://bird.com/en-us/pricing/sms/fees) |
| **WhatsApp US** (Bird + Meta combined, per delivered) | Marketing **$0.030**; Utility / Auth **$0.0084**; Service **$0.0084** from **2026-10-01** (1,000 free service msgs / business number / month) | [bird.com/pricing/whatsapp](https://bird.com/pricing/whatsapp) |
| RCS / other | Marketing pages have quoted RCS from **$0.005/msg** + passthrough; treat as indicative and re-check the live country table before buying | [bird.com/pricing](https://bird.com/pricing) / marketing-v2 |

No monthly **platform** minimum if you only use email Free. First **SMS** number is $1/mo + 10DLC fees + per segment. First **WhatsApp** production path is Meta + Bird processing + category rates. Flows (if we used their automation) have been listed around **$0.05 / invocation** on older marketing pages — do not use Flows for v1.

**Abuse / ToS (WhatsApp / Meta / A2P)**

Bird is a pipe. **Meta and the carriers still rule.**

- **WhatsApp:** opt-in, quality rating, messaging limits, **approved templates** outside the 24h window, display-name review, unverified WABA caps. Bird’s `whatsapp.received` does not let us cold-text the world.
- **SMS US A2P 10DLC:** Brand + Campaign at TCR; STOP/HELP; campaign rejection; carrier filters. Bird publishes the fees; we still fill the forms and eat the fines (same as Twilio).
- **Apple Business Chat:** Apple Service Terms + MSP + live-agent rules from §5. Still not `@botlord` in a friends’ iMessage group.
- **Telegram / social:** each network’s bot policy. Telegram via Bird is **worse** than a shared `@aimsbot` deep link we host ourselves (extra vendor, extra $).

Spoofing: verify Standard Webhooks (or Channels `signingKey`). Token theft: workspace key = send-as-us on every connected channel — encrypt, rotate. Replay: `webhook-id`. Loops: hop cap; SMS/WhatsApp loops are **expensive**, which is a natural brake. Spam: the whole reason 10DLC and Meta templates exist.

**(c) table**

| Risk | Mitigation |
|---|---|
| Spoofing | Standard Webhooks unwrap; reject skew > 5 min. |
| Token theft | Least-privilege keys (`webhooks:write` ≠ blast-all-channels if we can split). Never public. |
| Spam / 10DLC / Meta | Do not send without Brand+Campaign / WABA. Honor STOP and WhatsApp opt-in. |
| Impersonation | Alphanumeric / WhatsApp display name are reviewed; still not a Discord role. |
| Replay | `webhook-id` idempotency. |
| Loops | Hop ≤ 3; never auto-reply to our own sender IDs. |

**(d) Where it breaks / verdict vs building it ourselves**

Bird does **not** beat building **Discord, Telegram, or Slack** ourselves. Those are $0, official, and closer to “one click.” Bird does **not** unlock consumer iMessage.

Bird **can** beat building **WhatsApp + SMS + RCS + email + M4B** as four separate vendors later: one webhook style (Standard Webhooks, same as OpenAI/Claude), one number API, published PAYG. That is an aggregator decision for **rank 7–10**, not a reason to skip Discord. Cash-tight v1: use Bird’s **email Free** only if we want inbound email without Postmark; do **not** rent SMS/WhatsApp until a real demand shows up.

**Do not** put Bird in front of Discord. **Do** keep it on the short list as the CPaaS if/when we leave the $0 channels.

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
| 7 | Email inbound (Postmark/Resend **or later Bird Free** — 1k/mo, $0, no card) | DNS once | Later |
| 8 | WhatsApp Cloud API (**self or Bird** as aggregator — Meta rules unchanged) | Meta verify + phone + 24h/templates | Not v1 |
| 9 | SMS / RCS A2P 10DLC (**Twilio or Bird** — US number ~$1/mo + brand/campaign + ~$0.0035/segment + carrier fees) | Brand + campaign + number | Not v1 |
| 10 | Apple Messages for Business + MSP (**Bird can be the MSP**; still not consumer iMessage) | Business + MSP + Apple review | Not v1 |
| — | **Bird** as the Discord/Telegram/Slack layer | Workspace + sender verify | **Reject** — does not beat building those |
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

_(empty — second, different-model agent fills this. In scope: ranks 1–10, the Discord self-serve lock, **§11 Photon** (product identity, Apple consumer-iMessage ToS, $0/10-user vs $25/$250, “does not beat building Discord”), and **§12 Bird** (MessageBird confirmation, two-way Standard Webhooks, Meta/A2P humans, PAYG vs building Discord, later-aggregator-only).)_

### Resolution

_(empty — fold red-team findings here)_
