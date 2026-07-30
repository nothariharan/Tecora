import MiniSearch from 'minisearch';
import type { Chat, Message } from './types';
import { db } from './db';
import { codeLanguagesFromTexts } from './code-fences';

export type SearchHit = {
  pk: string;
  chatId: string;
  title: string;
  text?: string;
  platform: Chat['platform'];
  account: string;
  folderId?: string;
  updatedAt: number;
  // fenced-code languages present in this chat, for code-only / language filters
  codeLangs?: string[];
};

export function createChatIndex() {
  return new MiniSearch<SearchHit>({
    idField: 'pk',
    fields: ['title', 'text'],
    storeFields: [
      'pk',
      'chatId',
      'title',
      'platform',
      'account',
      'folderId',
      'updatedAt',
      'codeLangs',
    ],
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
    codeLangs: chat.codeLangs,
  };
}

export async function upsertChatsIntoIndex(index: MiniSearch<SearchHit>, chats: Chat[]) {
  const docs = await Promise.all(
    chats.map(async (chat) => {
      const doc = chatToDoc(chat);
      try {
        const messages = await db.messages.where('chatPk').equals(chat.pk).toArray();
        const texts = messages.map((m) => m.text);
        doc.text = texts.join('\n');
        doc.codeLangs = codeLanguagesFromTexts(texts);
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
  const textsByChat = new Map<string, string[]>();
  for (const m of messages) {
    const current = textsByChat.get(m.chatPk) ?? [];
    current.push(m.text);
    textsByChat.set(m.chatPk, current);
  }

  const docs = chats.map((c) => {
    const doc = chatToDoc(c);
    const texts = textsByChat.get(c.pk) ?? [];
    doc.text = texts.join('\n');
    doc.codeLangs = codeLanguagesFromTexts(texts);
    return doc;
  });

  index.addAll(docs);
  return index;
}
