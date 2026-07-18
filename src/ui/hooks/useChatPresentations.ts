import { db } from '@/src/core/db';
import { deriveChatPreview, deriveChatTitle } from '@/src/core/memory';
import type { Chat, Message } from '@/src/core/types';
import { useLiveQuery } from './useLiveQuery';

export interface ChatPresentation {
  title: string;
  preview: string | null;
}

export function useChatPresentations(chats: Chat[]): Record<string, ChatPresentation> {
  const chatPks = chats.map((chat) => chat.pk);
  const key = chatPks.join('\n');

  return (
    useLiveQuery(
      async () => {
        if (chatPks.length === 0) return {};

        const messages = await db.messages.where('chatPk').anyOf(chatPks).sortBy('ts');
        const byChatPk = new Map<string, Message[]>();
        for (const message of messages) {
          const list = byChatPk.get(message.chatPk) ?? [];
          list.push(message);
          byChatPk.set(message.chatPk, list);
        }

        const presentations: Record<string, ChatPresentation> = {};
        for (const chat of chats) {
          const chatMessages = byChatPk.get(chat.pk) ?? [];
          presentations[chat.pk] = {
            title: deriveChatTitle(chat, chatMessages),
            preview: deriveChatPreview(chatMessages),
          };
        }
        return presentations;
      },
      [key],
      {},
    ) ?? {}
  );
}
