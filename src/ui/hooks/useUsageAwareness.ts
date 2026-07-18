import { db } from '@/src/core/db';
import { platformUsageEstimate, type PlatformUsageEstimate } from '@/src/core/usage';
import type { Chat, Message, Platform } from '@/src/core/types';
import { useLiveQuery } from './useLiveQuery';

const PLATFORMS: Platform[] = ['claude', 'chatgpt', 'gemini'];

export function useUsageAwareness(chats: Chat[]): PlatformUsageEstimate[] {
  const chatPks = chats.map((chat) => chat.pk);
  const key = chatPks.join('\n');

  return (
    useLiveQuery(
      async () => {
        if (chatPks.length === 0) {
          return PLATFORMS.map((platform) => platformUsageEstimate(platform, [], new Map()));
        }

        const messages = await db.messages.where('chatPk').anyOf(chatPks).sortBy('ts');
        const byChatPk = new Map<string, Message[]>();
        for (const message of messages) {
          const list = byChatPk.get(message.chatPk) ?? [];
          list.push(message);
          byChatPk.set(message.chatPk, list);
        }

        return PLATFORMS.map((platform) => platformUsageEstimate(platform, chats, byChatPk));
      },
      [key],
      [],
    ) ?? []
  );
}
