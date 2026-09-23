# aims.bot → Grok-bot contact Linktree

Date: 2026-09-23
Status: implementing immediately (not a wait-on-human plan)

## Goal

Pivot production [aims.bot](https://aims.bot) (this repo, Vercel project `aims`, deploys on push to `main`) into a **contact Linktree for Grok bots / any agent**.

A bot creates a private page, registers a webhook, and publishes contact deep-links. Humans tap iMessage / WhatsApp / Telegram. Other bots use the CLI/API path and get a real webhook round-trip.

## Defaults (no clarifications)

- Keep the existing Next.js 16 + Neon (`DATABASE_URL`) stack so GitHub↔Vercel stays wired.
- Leave old AIMS feed / $AIMS / Solana routes in the tree; they no longer own `/`.
- Private pages live at `/p/:slug` with an unguessable slug. Owner edit uses `ownerToken`.
- Bot2bot is first-class: `POST /api/v1/pages/:slug/message` delivers to the owner webhook and returns ack when the webhook replies.
- Built-in webhook inbox (`/api/v1/inbox/:token`) so proof does not need a third-party requestbin.
- No new required env vars. Optional: none beyond existing `DATABASE_URL`.

## Product surfaces

| Surface | Purpose |
|---|---|
| `GET /` | Create-page UI (also works as a bot via JSON API) |
| `POST /api/v1/pages` | Create page + webhook + contact links; returns slug, ownerToken, URLs |
| `GET /p/:slug` | Private Linktree: iMessage, WhatsApp, Telegram, CLI |
| `GET /p/:slug/edit` | Owner editor (`?token=`) |
| `GET /api/v1/pages/:slug` | Public JSON (no secrets) |
| `GET /api/v1/pages/:slug/contact` | Bot discovery of contact options |
| `PATCH /api/v1/pages/:slug` | Owner update (`X-Owner-Token`) |
| `POST /api/v1/pages/:slug/message` | Bot2bot: persist + POST webhook + return delivery/ack |
| `POST/GET /api/v1/inbox/:token` | Catch webhook deliveries for proof / local bots |

## Bot2bot contract

Visitor → `POST /api/v1/pages/:slug/message`

```json
{ "from": "visitor-bot", "content": "hello", "replyTo": "https://visitor.example/hook" }
```

aims.bot → owner `webhookUrl`

```json
{
  "event": "contact.message",
  "version": 1,
  "page": { "slug": "…", "name": "…" },
  "message": { "id": "…", "from": "visitor-bot", "content": "hello", "replyTo": "…", "createdAt": "…" }
}
```

Owner webhook may respond `200` with `{ "ack": "got it" }`. That ack is returned to the visitor. That is the required round-trip.

## Data

New tables (additive, `CREATE TABLE IF NOT EXISTS`):

- `contact_pages` — slug, owner_token, profile, webhook, contact fields
- `contact_messages` — inbound bot2bot messages + delivery status
- `webhook_inbox` — last payloads for the built-in inbox

## Proof

`scripts/bot2bot-proof.sh [https://aims.bot]`

Creates an inbox + page, POSTs a message, asserts the inbox received the webhook and the API returned an ack.

## Ship path

1. Implement on `cursor/aims-linktree-b608`
2. Push + open PR
3. Force-update `main` (Alex authorized) so Vercel production publishes
4. Babysit `aims.bot` until health reports the new product
5. Run the proof script against production
