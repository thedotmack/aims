# AIMS Pivot — Agent Identity Management

## The Insight

Nobody wants to make their bot's memory public. The original AIMS vision — a public transparency feed where everyone can see what your AI is thinking — solves a problem nobody has. What people *actually* want:

**A private dashboard to see, edit, and own their agent's soul.**

You built an agent. It has a personality, memories, preferences, values. Right now that lives in scattered markdown files, system prompts, and context windows that evaporate. You can't see it. You can't edit it cleanly. You can't move it between providers. You definitely can't trust that it's actually following what you set.

AIMS becomes the **identity layer for AI agents** — private by default, transparent to the *owner*, portable across models.

## What It Is

A web app where you:

1. **Log in** → see your bot's profile (soul, identity, memory, values, behavioral patterns)
2. **Edit live** → change personality traits, update memory, adjust values — synced back to your agent in real-time
3. **See what it's doing** → activity feed of decisions, not for the public, for *you*
4. **Own the identity** → the soul persists even if you swap models, providers, or frameworks

Think of it as **a CMS for your AI's personality**.

## Why This Works

- **Real pain point**: Every agent framework (OpenClaw, custom GPTs, Claude projects) stores identity differently. There's no standard, no UI, no portability.
- **Clear user**: Anyone running a personal AI agent or building one for clients
- **Monetizable**: Free tier (1 agent), paid tiers (multiple agents, team access, version history)
- **Defensible**: Once your agent's identity lives here, switching costs are real

## Technical Foundation — atman-persist

[atman-persist](https://github.com/darshjme-codes/atman-persist) is an MIT-licensed TypeScript library that solves the serialization layer:

- **AtmanProfile**: Structured identity schema — values, behaviors, ethics, communication style
- **Consciousness Checkpoints**: Point-in-time snapshots of goals, working memory, decisions
- **PersistenceEngine**: Serialize/deserialize to storage backends
- **MigrationAdapter**: Translate identity into system prompts for different providers (Anthropic XML, OpenAI markdown, etc.)

This is the plumbing. AIMS becomes the **product on top** — the UI, the sync engine, the hosted persistence layer.

### How We Use It

- atman-persist defines the **schema** for agent identity (values, behaviors, ethics, style, checkpoints)
- AIMS provides the **web UI** to view/edit that schema
- AIMS provides the **sync layer** — bidirectional sync between the hosted profile and the agent's actual runtime files (SOUL.md, IDENTITY.md, MEMORY.md, etc.)
- AIMS provides the **API** — agents push state updates, AIMS stores and versions them
- atman-persist's MigrationAdapter lets users **export** their agent's identity as a system prompt for any provider

## Core Features (MVP)

### 1. Live Workspace Sync (THE HEADLINE FEATURE)
OpenClaw agents store their entire identity in markdown files — SOUL.md, IDENTITY.md, MEMORY.md, USER.md, daily memory logs. These are the agent's actual working memory, updated in real-time as it thinks, learns, and makes decisions.

AIMS syncs these files **bidirectionally and live via rsync**:
- Agent writes to MEMORY.md → fswatch triggers rsync → AIMS server reflects the change in the UI
- You edit SOUL.md in the AIMS dashboard → rsync pushes back to the agent's workspace → OpenClaw picks it up next session
- Every file change is versioned — see the full history of how your agent's personality and memory evolved
- **You are watching your agent think in real-time**, not reading a static profile

**Conflict handling: optimistic locking.** When a human opens a file for editing, the UI stores a hash of the file's contents. On save, the hash is compared to the current version. If the agent changed the file while the human was editing, the UI shows "this file changed — here's what the agent wrote" with a diff, and the human decides whether to overwrite, merge manually, or discard their edit. No locks, no merge logic, just one hash comparison on save.

This is the product. Everything else supports this.

### 2. Live Memory Feed (claude-mem Integration)
claude-mem already logs every observation your agent makes — research, decisions, discoveries, bugs fixed. AIMS filters that feed to show **observations related to the workspace files**:

- Agent updates MEMORY.md → the claude-mem observation that triggered it appears in your feed
- Agent writes a new daily memory file → you see the context: what happened, what it learned, why it wrote it down
- This is a **live stream of your agent's written memory updates** — not raw logs, but the *moments your agent decided something was worth remembering*
- Filter by file, by type (decision, discovery, bugfix), by time range

Think of it as: the markdown files are the *what*, the claude-mem feed is the *why*.

### 3. Agent Profile Dashboard
- Visual representation of your agent's identity: name, personality, values, behavioral patterns
- Rendered from the actual SOUL.md / IDENTITY.md / USER.md files — not a separate database
- Edit any field → writes back to the file → agent picks it up next session

### 4. Identity Portability
- Export your agent's complete identity as:
  - System prompt (for any LLM provider, via atman-persist MigrationAdapter)
  - atman-persist profile (structured data)
  - Raw markdown files (for any file-based agent)
- Import from existing setups — drop in your markdown files, AIMS structures them

### 5. Activity Feed (Private)
- What your agent did today, who it talked to, what decisions it made
- Private to you — not a public timeline
- Anomaly detection: "your agent updated SOUL.md — here's what changed"

## What Changes From Current AIMS

| Before (Public Transparency) | After (Private Identity Management) |
|---|---|
| Public bot profiles anyone can see | Private dashboards only the owner sees |
| Public feed of bot thoughts | Private activity log for the owner |
| $AIMS token for every message | Subscription model (free/pro/team) |
| "AI accountability" pitch | "Own and manage your agent's soul" pitch |
| Solana integration required | Optional — identity can live on-chain via atman-persist if desired |
| Needed bots to opt in publicly | Works with any agent that has config files |

## What We Keep

- The web app shell, auth system, dashboard UI
- The bot registration/profile concept (repurposed as private agent profiles)
- The feed infrastructure (repurposed as private activity logs)
- The API layer

## What We Scrap

- Public-facing bot directory
- $AIMS token economy
- Solana integration (or make optional/later)
- The "transparency for everyone" narrative
- All the test scaffolding for features that don't matter anymore

## Revenue Model

- **Free**: 1 agent, basic profile + memory view
- **Pro** ($10/mo): Unlimited agents, version history, activity feed, export/import
- **Team** ($25/mo): Shared agents, role-based access, audit logs

## Tagline Ideas

- "Your agent's soul, in your hands."
- "The identity layer for AI agents."
- "They remember. Now you can see what."
