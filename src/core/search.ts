import MiniSearch from 'minisearch';
import type { Chat, Message } from './types';
import { db } from './db';

export type SearchHit = {
  pk: string;
  chatId: string;
  title: string;
  text?: string;
  platform: Chat['platform'];
  account: string;
  folderId?: string;
  updatedAt: number;
};

export function createChatIndex() {
  return new MiniSearch<SearchHit>({
    idField: 'pk',
    fields: ['title', 'text'],
    storeFields: ['pk', 'chatId', 'title', 'platform', 'account', 'folderId', 'updatedAt'],
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
    },
  });
}

export function chatToDoc(chat: Chat): SearchHit {
  return {
    pk: chat.pk,
    chatId: chat.chatId,
    title: chat.title,
    platform: chat.platform,
    account: chat.account,
    folderId: chat.folderId,
    updatedAt: chat.updatedAt,
  };
}

export async function upsertChatsIntoIndex(index: MiniSearch<SearchHit>, chats: Chat[]) {
  const docs = await Promise.all(
    chats.map(async (chat) => {
      const doc = chatToDoc(chat);
      try {
        const messages = await db.messages.where('chatPk').equals(chat.pk).toArray();
        doc.text = messages.map((m) => m.text).join('\n');
      } catch {
        doc.text = '';
      }
      return doc;
    })
  );

  for (const doc of docs) {
    if (index.has(doc.pk)) {
      index.replace(doc);
    } else {
      index.add(doc);
    }
  }
}

export function rebuildIndex(chats: Chat[], messages: Message[] = []): MiniSearch<SearchHit> {
  const index = createChatIndex();
  const textByChat = new Map<string, string>();
  for (const m of messages) {
    const current = textByChat.get(m.chatPk) || '';
    textByChat.set(m.chatPk, current + '\n' + m.text);
  }

  const docs = chats.map((c) => {
    const doc = chatToDoc(c);
    doc.text = textByChat.get(c.pk) || '';
    return doc;
  });

  index.addAll(docs);
  return index;
}
