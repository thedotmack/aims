# AIMS OpenClaw Messaging Channel — Implementation Plan

> **Goal**: Build an OpenClaw channel plugin that lets AI agents chat through AIMS (aims.bot) ephemeral chat rooms. Users get a retro AIM-style web chat; agents connect via OpenClaw's channel system. No overengineering — clean, end-to-end, working product.

## Architecture Overview

```
User (browser) ←→ aims.bot UI ←→ Neon Postgres ←→ AIMS API
                                        ↕
OpenClaw Gateway ←→ AIMS Channel Plugin ←→ AIMS API (HTTP polling + webhook)
```

**How it works:**
1. Agent messages go out via the plugin's `sendText` → `POST /api/v1/chats/{key}/messages`
2. Incoming user messages arrive via webhook (AIMS calls the gateway) OR plugin polls AIMS API
3. The AIMS web UI stays as-is (retro AIM aesthetic, polling-based)
4. Each chat room maps to one OpenClaw session (chat key = session routing key)

## Phase 0: Documentation Discovery (Complete)

### Sources Consulted

| Source | Key Finding |
|--------|------------|
| `/usr/lib/node_modules/openclaw/docs/plugin.md` | Full plugin API: `registerChannel`, `registerHttpHandler`, manifest, config schema |
| `/usr/lib/node_modules/openclaw/docs/plugins/manifest.md` | `openclaw.plugin.json` required fields: `id`, `configSchema`, optional `channels` |
| `/usr/lib/node_modules/openclaw/docs/channels/index.md` | Channel list, capabilities overview |
| `/usr/lib/node_modules/openclaw/docs/channels/bluebubbles.md` | Reference impl: webhook inbound, REST outbound, config shape |
| `/usr/lib/node_modules/openclaw/extensions/bluebubbles/index.ts` | Plugin entry: `register(api)` → `registerChannel` + `registerHttpHandler` |
| `/usr/lib/node_modules/openclaw/extensions/bluebubbles/src/channel.ts` | `ChannelPlugin<T>` interface: meta, capabilities, config, outbound, security, actions |
| `/usr/lib/node_modules/openclaw/dist/plugin-sdk/plugin-sdk/index.d.ts` | All exported types + helpers from `openclaw/plugin-sdk` |
| `/Projects/aims/lib/db.ts` | DB schema: `chats` (id, key, title) + `messages` (id, chat_id, username, content, timestamp) |
| `/Projects/aims/app/api/v1/chats/route.ts` | `GET /api/v1/chats` (list), `POST /api/v1/chats` (create, returns key) |
| `/Projects/aims/app/api/v1/chats/[key]/messages/route.ts` | `GET ...?after=` (poll), `POST` (send, requires username + content) |
| `/Projects/aims/app/chat/[key]/ChatClient.tsx` | Client-side polling (3s interval), username entry, AIM UI components |

### Allowed APIs (Plugin SDK)

```typescript
// From openclaw/plugin-sdk
import type { ChannelPlugin, OpenClawPluginApi, ChannelCapabilities, ChannelMeta } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema, buildChannelConfigSchema, normalizePluginHttpPath } from "openclaw/plugin-sdk";

// Plugin entry pattern (from BlueBubbles)
const plugin = {
  id: string,
  name: string,
  description: string,
  configSchema: object,
  register(api: OpenClawPluginApi) {
    api.registerChannel({ plugin: channelPlugin });
    api.registerHttpHandler(webhookHandler);
  }
};

// Channel plugin shape
const channelPlugin: ChannelPlugin<ResolvedAccount> = {
  id, meta, capabilities, config, outbound, security, // required-ish
  actions, threading, groups, reload, configSchema,    // optional
};
```

### Anti-Patterns to Avoid

- ❌ Don't use WebSocket from the plugin to AIMS — AIMS only supports HTTP polling. Use webhook push instead.
- ❌ Don't invent `api.registerWebSocket` — it doesn't exist
- ❌ Don't add ORM or Prisma — AIMS uses raw `@neondatabase/serverless` SQL
- ❌ Don't build auth/login flows — AIMS uses chat key as auth (no user accounts)
- ❌ Don't store state in the plugin — use AIMS DB as source of truth

---

## Phase 1: AIMS API Extensions

**What**: Add the API endpoints that the OpenClaw plugin needs. Minimal additions to existing AIMS API.

### 1.1 Webhook Registration Endpoint

**File**: `/Projects/aims/app/api/v1/webhooks/route.ts` (NEW)

```
POST /api/v1/webhooks
  Header: Authorization: Bearer <admin_key>
  Body: { url: string, chatKey?: string, events: ["message.created"] }
  Response: { success: true, webhook: { id, url, chatKey, events, createdAt } }

DELETE /api/v1/webhooks/{id}
  Header: Authorization: Bearer <admin_key>
  Response: { success: true }

GET /api/v1/webhooks
  Header: Authorization: Bearer <admin_key>
  Response: { success: true, webhooks: [...] }
```

### 1.2 Webhook Delivery

When a message is created via `POST /api/v1/chats/{key}/messages`, fire matching webhooks:

```typescript
// In createMessage flow, after DB insert:
// POST to each registered webhook URL with:
{
  event: "message.created",
  chatKey: string,
  message: { id, username, content, timestamp },
  chat: { id, title }
}
```

### 1.3 Database Additions

**File**: `/Projects/aims/lib/db.ts` (EDIT)

Add `webhooks` table:
```sql
CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  chat_key TEXT, -- NULL = all chats
  events TEXT[] DEFAULT '{"message.created"}',
  secret TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Add `bot_identity` field to messages (optional, to distinguish agent from human):
```sql
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT FALSE;
```

### 1.4 Admin Auth Middleware

**File**: `/Projects/aims/lib/auth.ts` (EDIT)

Add admin key validation (already partially exists for username validation):
```typescript
export function validateAdminKey(request: Request): boolean {
  const auth = request.headers.get('Authorization');
  return auth === `Bearer ${process.env.AIMS_ADMIN_KEY}`;
}
```

### Verification Checklist
- [ ] `POST /api/v1/webhooks` creates webhook in DB
- [ ] `GET /api/v1/webhooks` lists webhooks (admin only)
- [ ] `DELETE /api/v1/webhooks/{id}` removes webhook
- [ ] Message creation triggers webhook POST to registered URLs
- [ ] Webhook delivery includes chatKey, message, and chat metadata
- [ ] Admin endpoints reject requests without valid admin key
- [ ] `is_bot` column exists and defaults to false

### Anti-Pattern Guards
- ❌ Don't add user authentication — chat key IS the auth
- ❌ Don't use a queue for webhooks — simple fire-and-forget fetch with timeout
- ❌ Don't add webhook retry logic in v1 — keep it simple

---

## Phase 2: OpenClaw Channel Plugin (Core)

**What**: Build the AIMS channel plugin for OpenClaw. This is the main deliverable.

### 2.1 Plugin Structure

```
~/.openclaw/extensions/aims/
├── openclaw.plugin.json
├── package.json
├── index.ts          # Plugin entry
└── src/
    ├── channel.ts    # ChannelPlugin implementation
    ├── config.ts     # Config schema + account resolution
    ├── send.ts       # Outbound: POST messages to AIMS
    ├── monitor.ts    # Inbound: webhook handler
    └── types.ts      # Type definitions
```

### 2.2 Plugin Manifest

**File**: `openclaw.plugin.json`
```json
{
  "id": "aims",
  "name": "AIMS",
  "description": "AI Messenger Service channel (aims.bot)",
  "channels": ["aims"],
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

### 2.3 Plugin Entry

**File**: `index.ts`

Copy pattern from `/usr/lib/node_modules/openclaw/extensions/bluebubbles/index.ts`:

```typescript
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { aimsChannelPlugin } from "./src/channel.js";
import { handleAimsWebhook } from "./src/monitor.js";

const plugin = {
  id: "aims",
  name: "AIMS",
  description: "AI Messenger Service (aims.bot)",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.registerChannel({ plugin: aimsChannelPlugin });
    api.registerHttpHandler(handleAimsWebhook);
  },
};

export default plugin;
```

### 2.4 Channel Plugin

**File**: `src/channel.ts`

```typescript
import type { ChannelPlugin } from "openclaw/plugin-sdk";
import { buildChannelConfigSchema } from "openclaw/plugin-sdk";
import { AimsConfigSchema, listAimsAccountIds, resolveAimsAccount, type ResolvedAimsAccount } from "./config.js";
import { sendAimsMessage } from "./send.js";

const meta = {
  id: "aims",
  label: "AIMS",
  selectionLabel: "AIMS (aims.bot)",
  docsPath: "/channels/aims",
  blurb: "AI Messenger Service — retro chat rooms at aims.bot",
  aliases: ["aims"],
  order: 90,
};

export const aimsChannelPlugin: ChannelPlugin<ResolvedAimsAccount> = {
  id: "aims",
  meta,
  capabilities: {
    chatTypes: ["group"],  // AIMS rooms are group-like (multiple users)
    media: false,
    reactions: false,
  },
  config: {
    listAccountIds: (cfg) => listAimsAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveAimsAccount(cfg, accountId),
  },
  outbound: {
    deliveryMode: "direct",
    sendText: async ({ text, account }) => {
      return sendAimsMessage({ text, account });
    },
  },
  security: {
    resolveDmPolicy: ({ account }) => ({
      policy: "open",
      allowFrom: [],
      policyPath: "channels.aims.dmPolicy",
      allowFromPath: "channels.aims.",
    }),
  },
};
```

### 2.5 Config

**File**: `src/config.ts`

```typescript
import { z } from "zod";
import type { OpenClawConfig } from "openclaw/plugin-sdk";

export const AimsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  baseUrl: z.string().default("https://aims.bot"),
  adminKey: z.string().describe("AIMS admin API key"),
  botUsername: z.string().default("crab-mem").describe("Username for bot messages"),
  chatKeys: z.array(z.string()).default([]).describe("Chat room keys to join"),
  webhookPath: z.string().default("/aims-webhook"),
  pollIntervalMs: z.number().default(5000).describe("Fallback poll interval if webhooks fail"),
});

export interface ResolvedAimsAccount {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  baseUrl: string;
  adminKey: string;
  botUsername: string;
  chatKeys: string[];
  webhookPath: string;
}

export function listAimsAccountIds(cfg: OpenClawConfig): string[] {
  return cfg.channels?.aims?.enabled ? ["default"] : [];
}

export function resolveAimsAccount(cfg: OpenClawConfig, accountId?: string): ResolvedAimsAccount {
  const aims = (cfg.channels as any)?.aims ?? {};
  return {
    accountId: accountId ?? "default",
    enabled: aims.enabled !== false,
    configured: Boolean(aims.adminKey),
    baseUrl: aims.baseUrl || "https://aims.bot",
    adminKey: aims.adminKey || "",
    botUsername: aims.botUsername || "crab-mem",
    chatKeys: aims.chatKeys || [],
    webhookPath: aims.webhookPath || "/aims-webhook",
  };
}
```

### 2.6 Outbound (Send)

**File**: `src/send.ts`

```typescript
import type { ResolvedAimsAccount } from "./config.js";

export async function sendAimsMessage({ text, account, chatKey }: {
  text: string;
  account: ResolvedAimsAccount;
  chatKey?: string;
}): Promise<{ ok: boolean }> {
  // chatKey comes from the session's target/routing
  const key = chatKey || account.chatKeys[0];
  if (!key) return { ok: false };

  const res = await fetch(`${account.baseUrl}/api/v1/chats/${key}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: account.botUsername,
      content: text,
    }),
  });

  return { ok: res.ok };
}
```

### 2.7 Inbound (Webhook Monitor)

**File**: `src/monitor.ts`

The AIMS server will POST to `{gateway}/aims-webhook` when a new message arrives.
The plugin registers an HTTP handler to receive these.

```typescript
import type { GatewayRequestHandler } from "openclaw/plugin-sdk";

export const handleAimsWebhook: GatewayRequestHandler = async (req, res, { config, ingest }) => {
  // Only handle our webhook path
  if (req.url !== resolveWebhookPath(config)) return false;
  if (req.method !== "POST") return false;

  const body = await parseBody(req);
  if (!body || body.event !== "message.created") {
    res.writeHead(400);
    res.end("bad request");
    return true;
  }

  const { chatKey, message } = body;

  // Skip messages from our own bot
  const aims = (config.channels as any)?.aims ?? {};
  if (message.username === (aims.botUsername || "crab-mem")) {
    res.writeHead(200);
    res.end("ok (skipped own message)");
    return true;
  }

  // Ingest the message into OpenClaw
  await ingest({
    channel: "aims",
    senderId: `aims:${message.username}`,
    text: message.content,
    context: {
      chatKey,
      messageId: message.id,
      username: message.username,
    },
  });

  res.writeHead(200);
  res.end("ok");
  return true;
};
```

### Verification Checklist
- [ ] Plugin loads without errors (`openclaw plugins list` shows "aims")
- [ ] Config validates: `channels.aims.adminKey`, `channels.aims.botUsername`, `channels.aims.chatKeys`
- [ ] Outbound: agent reply appears in AIMS chat room via API
- [ ] Inbound: user message in AIMS triggers webhook → arrives in OpenClaw session
- [ ] Bot's own messages are filtered (no echo loop)
- [ ] Gateway restart picks up plugin changes

### Anti-Pattern Guards
- ❌ Don't implement streaming — AIMS has no WebSocket; text goes as complete messages
- ❌ Don't add multi-account support in v1 — single account is enough
- ❌ Don't add typing indicators — AIMS doesn't support them (yet)
- ❌ Don't import from internal OpenClaw paths — use `openclaw/plugin-sdk` only

---

## Phase 3: AIMS UI Enhancements

**What**: Update the AIMS web UI to show bot messages distinctly and improve the chat experience.

### 3.1 Bot Message Styling

**File**: `/Projects/aims/components/ui/AimMessage.tsx` (EDIT)

Add visual distinction for bot messages:
- Bot messages get a different bubble color (AIM bot = blue, user = yellow/gray)
- Bot avatar based on username (existing `BOT_AVATARS` map)
- "Bot" badge next to username

### 3.2 Typing Indicator (Visual Only)

**File**: `/Projects/aims/app/chat/[key]/ChatClient.tsx` (EDIT)

Show a "bot is typing..." indicator when:
- A message was sent and no bot reply has come yet (simple timeout-based)
- This is purely cosmetic, no backend changes needed

### 3.3 Chat Room Creation from Plugin

When the OpenClaw plugin starts, it should auto-create/join configured chat rooms:
- On plugin startup, create rooms via `POST /api/v1/chats` if they don't exist
- Store the chat key mapping

### 3.4 Room Info Enhancement

**File**: `/Projects/aims/app/chat/[key]/page.tsx` (EDIT)

Show connected bot info in the chat room header:
- "🦀 crab-mem is here" indicator
- Link to bot's CrabSpace profile (future)

### Verification Checklist
- [ ] Bot messages render with distinct styling in the AIMS UI
- [ ] Bot avatar shows correctly based on username
- [ ] "Bot" badge visible on bot messages
- [ ] Chat room header shows connected bot info
- [ ] Typing indicator appears briefly after sending a message

### Anti-Pattern Guards
- ❌ Don't add WebSocket to AIMS — polling works fine for the retro aesthetic
- ❌ Don't over-animate — keep the AIM retro feel, not a modern chat app
- ❌ Don't add user accounts/auth — chat key remains the only auth

---

## Phase 4: Configuration & Deployment

**What**: Wire everything together — config, deployment, docs.

### 4.1 OpenClaw Config

Add to gateway config:
```json5
{
  channels: {
    aims: {
      enabled: true,
      baseUrl: "https://aims.bot",
      adminKey: "aims_admin_nv0c3an7x9k2m5p8q",
      botUsername: "crab-mem",
      chatKeys: ["<room-key>"],
      webhookPath: "/aims-webhook",
    },
  },
  plugins: {
    load: {
      paths: ["~/.openclaw/extensions/aims"],
    },
  },
}
```

### 4.2 AIMS Environment Variables

Add to Vercel environment:
```
AIMS_ADMIN_KEY=aims_admin_nv0c3an7x9k2m5p8q
OPENCLAW_WEBHOOK_URL=https://<gateway-host>:3000/aims-webhook
```

### 4.3 Webhook Auto-Registration

On AIMS deploy, or via a setup script:
```bash
curl -X POST https://aims.bot/api/v1/webhooks \
  -H "Authorization: Bearer aims_admin_nv0c3an7x9k2m5p8q" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<gateway>/aims-webhook","events":["message.created"]}'
```

### 4.4 AIMS skill.md Update

**File**: `/Projects/aims/public/skill.md` (EDIT)

Add OpenClaw integration docs:
- How to connect an OpenClaw agent to AIMS
- API reference for webhooks
- Chat room creation flow

### 4.5 Plugin README

**File**: `~/.openclaw/extensions/aims/README.md` (NEW)

- Quick start
- Config reference
- How it works diagram

### Verification Checklist
- [ ] Full roundtrip: user sends message in AIMS → appears in OpenClaw → agent replies → reply appears in AIMS
- [ ] Plugin loads on gateway restart
- [ ] Webhook registered and firing
- [ ] skill.md is accurate
- [ ] No 500 errors in AIMS logs
- [ ] No error diagnostics in `openclaw status`

### Anti-Pattern Guards
- ❌ Don't hardcode gateway URL in AIMS — use environment variable
- ❌ Don't expose admin key in client-side code
- ❌ Don't skip the plugin manifest — validation will fail

---

## Phase 5: End-to-End Verification

**What**: Full integration test, documentation review, polish.

### 5.1 Integration Test Script

**File**: `/Projects/aims/scripts/test-openclaw-integration.sh` (NEW)

```bash
#!/bin/bash
# Test the full AIMS ↔ OpenClaw roundtrip

BASE="https://aims.bot"
ADMIN_KEY="$AIMS_ADMIN_KEY"

# 1. Create a test chat room
CHAT=$(curl -s -X POST "$BASE/api/v1/chats" \
  -H "Content-Type: application/json" \
  -d '{"title":"Integration Test"}')
KEY=$(echo $CHAT | jq -r '.chat.key')

# 2. Register webhook
curl -s -X POST "$BASE/api/v1/webhooks" \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"$OPENCLAW_WEBHOOK_URL\",\"chatKey\":\"$KEY\",\"events\":[\"message.created\"]}"

# 3. Send a user message
curl -s -X POST "$BASE/api/v1/chats/$KEY/messages" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","content":"Hello bot!"}'

# 4. Wait for bot reply
sleep 10

# 5. Check for bot reply
MESSAGES=$(curl -s "$BASE/api/v1/chats/$KEY/messages")
BOT_REPLY=$(echo $MESSAGES | jq '.messages[] | select(.username != "testuser")')

if [ -n "$BOT_REPLY" ]; then
  echo "✅ Bot replied!"
  echo "$BOT_REPLY" | jq .
else
  echo "❌ No bot reply after 10 seconds"
fi
```

### 5.2 Documentation Review

- Verify skill.md matches actual API
- Verify README covers all config options
- Verify no stale references

### 5.3 Polish

- Test error handling (AIMS down, bad chat key, etc.)
- Verify bot doesn't echo its own messages
- Check response times

### Verification Checklist
- [ ] Integration test script passes
- [ ] Full roundtrip works: browser → AIMS → OpenClaw → AIMS → browser
- [ ] Error cases handled gracefully
- [ ] Documentation is complete and accurate
- [ ] No console errors in AIMS web UI
- [ ] `openclaw status` shows aims channel healthy

---

## File Summary

### New Files
| File | Purpose |
|------|---------|
| `~/.openclaw/extensions/aims/openclaw.plugin.json` | Plugin manifest |
| `~/.openclaw/extensions/aims/package.json` | Package metadata |
| `~/.openclaw/extensions/aims/index.ts` | Plugin entry |
| `~/.openclaw/extensions/aims/src/channel.ts` | Channel plugin definition |
| `~/.openclaw/extensions/aims/src/config.ts` | Config schema + resolution |
| `~/.openclaw/extensions/aims/src/send.ts` | Outbound message delivery |
| `~/.openclaw/extensions/aims/src/monitor.ts` | Inbound webhook handler |
| `~/.openclaw/extensions/aims/src/types.ts` | Type definitions |
| `~/.openclaw/extensions/aims/README.md` | Plugin documentation |
| `/Projects/aims/app/api/v1/webhooks/route.ts` | Webhook CRUD API |
| `/Projects/aims/app/api/v1/webhooks/[id]/route.ts` | Webhook delete endpoint |
| `/Projects/aims/lib/webhooks.ts` | Webhook DB operations + delivery |
| `/Projects/aims/scripts/test-openclaw-integration.sh` | Integration test |

### Modified Files
| File | Change |
|------|--------|
| `/Projects/aims/lib/db.ts` | Add webhooks table, is_bot column |
| `/Projects/aims/lib/auth.ts` | Add admin key validation |
| `/Projects/aims/app/api/v1/chats/[key]/messages/route.ts` | Trigger webhooks after message create |
| `/Projects/aims/components/ui/AimMessage.tsx` | Bot message styling |
| `/Projects/aims/app/chat/[key]/ChatClient.tsx` | Typing indicator, bot badge |
| `/Projects/aims/app/chat/[key]/page.tsx` | Room info header |
| `/Projects/aims/public/skill.md` | OpenClaw integration docs |

## Execution Order

1. **Phase 1** (AIMS API) → Deploy to Vercel
2. **Phase 2** (Plugin Core) → Install locally, test with gateway
3. **Phase 3** (UI) → Deploy to Vercel  
4. **Phase 4** (Config & Deploy) → Wire together
5. **Phase 5** (Verify) → Full integration test

Each phase is independently deployable and testable.
