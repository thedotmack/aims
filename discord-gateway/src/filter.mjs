export const DISCORD_INTENTS = 1 | 512; // GUILDS | GUILD_MESSAGES

export function messageMentionsBot(message, botUserId) {
  if (!botUserId || !Array.isArray(message?.mentions)) return false;
  return message.mentions.some((m) => m && m.id === botUserId);
}

export function isSelfAuthor(message, botUserId, appId) {
  const author = message?.author;
  if (!author) return false;
  if (botUserId && author.id === botUserId) return true;
  if (appId && author.application_id === appId) return true;
  return false;
}

export function shouldForwardMessage(message, botUserId, appId) {
  if (!message?.id) return false;
  if (isSelfAuthor(message, botUserId, appId)) return false;
  return messageMentionsBot(message, botUserId);
}
