# Bot auth review (adversarial)

Date: 2026-09-25
Status: **awaiting Alex green + red-team pass**. A second, different-model agent will attack these conclusions. `### Red-team findings` and `### Resolution` are left empty on purpose.
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

**Unofficial — BlueBubbles / Mac relay, Sendblue, LoopMessage**

These relay consumer iMessage through a Mac/phone or a vendor’s Apple IDs. Apple does **not** publish a consumer iMessage API. Vendor ToS and Apple’s ToS both allow suspension for automation/spam. aims.bot must **not** ship or recommend these as a product path. Deep-links (`imessage:`, `sms:`) on the Linktree stay as **human tap-to-open**, not a bot channel.

**(a)** Mac always-on + Apple ID login (BlueBubbles) or vendor signup + API key (Sendblue/Loop).  
**(b)** HTTP send/receive once the relay exists.  
**(c)** Token theft = hijack someone’s iMessage; impersonation is the product; ToS nuke.  
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

## RANKED recommendation

| Rank | Flow | Human steps after “connect me up with aims” | Ship |
|---|---|---|---|
| **1** | **Discord shared app + claim + OAuth install URL** (auto-bind system/first text channel; `/aims here` to move) | **1 click:** Authorize + pick server | **First** |
| 2 | Telegram shared bot + `t.me/aimsbot?start=CLAIM` | **1 tap** Start (groups: + add bot) | Next consumer channel |
| 3 | Slack shared app + Add to Slack (`app_mention`) | **1 click** Approve workspace | After Telegram; easier infra than Discord |
| 4 | aims claim / magic-link / RFC 8628 device code | 1 click or type code | Pairing layer for all of the above |
| 5 | MCP OAuth 2.1 + CIMD (DCR fallback) | 1 consent screen | Agent/IDE connect, not Discord mentions |
| 6 | Signed Standard Webhooks (OpenAI/Claude-compatible headers on aims wakes) | 0 if `webhookUrl` already set | Additive on existing bot2bot |
| 7 | Email inbound | DNS once | Later |
| 8 | WhatsApp Cloud API | Meta verify + phone + 24h/templates | Not v1 |
| 9 | SMS A2P 10DLC | Brand + campaign + number | Not v1 |
| 10 | Apple Messages for Business + MSP | Business + MSP + Apple review | Not v1 |
| — | Unofficial iMessage (BlueBubbles / Sendblue / LoopMessage) | — | **Do not ship** |
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

_(empty — second agent fills this)_

### Resolution

_(empty — fold red-team findings here)_
