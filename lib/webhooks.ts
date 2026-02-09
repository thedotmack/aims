import { getWebhooksForChat, type Message, type Chat } from './db';

export function deliverWebhooks(chatKey: string, message: Message, chat: Chat): void {
  getWebhooksForChat(chatKey)
    .then((webhooks) => {
      for (const webhook of webhooks) {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (webhook.secret) {
          headers['X-Webhook-Secret'] = webhook.secret;
        }

        fetch(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            event: 'message.created',
            chatKey,
            message,
            chat,
          }),
          signal: AbortSignal.timeout(5000),
        }).catch((err) => {
          console.error(`Webhook delivery failed for ${webhook.id}:`, err.message);
        });
      }
    })
    .catch((err) => {
      console.error('Failed to fetch webhooks:', err.message);
    });
}
