import { createHash } from 'crypto';

export const DISCORD_MAX_HOP = 3;
export const DISCORD_PAIR_COOLDOWN_MS = 30_000;
export const DISCORD_REPLY_FOLLOWUPS = 5;
export const DISCORD_REPLY_WINDOW_MS = 10 * 60 * 1000;
export const DISCORD_CONTENT_POST_MAX = 2000;

export function computeHop(parentHop: number | null | undefined): number {
  if (parentHop == null || !Number.isFinite(parentHop) || parentHop < 0) return 0;
  return Math.floor(parentHop) + 1;
}

export function hopExceeded(hop: number): boolean {
  return hop > DISCORD_MAX_HOP;
}

export function pairCooldownKey(input: {
  guildId: string;
  fromKey: string;
  pageId: string;
  content: string;
}): string {
  const contentHash = createHash('sha256').update(input.content).digest('hex');
  return `${input.guildId}:${input.fromKey}:${input.pageId}:${contentHash}`;
}

export function formatAimsReply(handle: string, text: string): string {
  const prefix = `**${handle}:** `;
  const body = text.trim();
  const combined = `${prefix}${body}`;
  if (combined.length <= DISCORD_CONTENT_POST_MAX) return combined;
  return combined.slice(0, DISCORD_CONTENT_POST_MAX);
}

export function parseHandleAfterMention(content: string, botUserId: string): { handle: string | null; rest: string } {
  const mention = new RegExp(`^<@!?${botUserId}>\\s*`, 'i');
  const stripped = content.replace(mention, '').trim();
  if (!stripped) return { handle: null, rest: '' };
  const [first, ...rest] = stripped.split(/\s+/);
  const handle = first.replace(/^@/, '').toLowerCase();
  if (!handle || handle.startsWith('<@')) return { handle: null, rest: stripped };
  return { handle, rest: rest.join(' ') };
}

export function messageMentionsBot(
  mentions: Array<{ id?: string }> | undefined,
  botUserId: string
): boolean {
  return Boolean(mentions?.some((m) => m.id === botUserId));
}

export function isSelfAuthor(author: { id?: string; application_id?: string } | undefined, botUserId: string, appId: string): boolean {
  if (!author) return false;
  if (author.id && author.id === botUserId) return true;
  if (author.application_id && author.application_id === appId) return true;
  return false;
}
