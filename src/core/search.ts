import MiniSearch from 'minisearch';
import type { Chat } from './types';

// tiny wrapper so background doesn't care about minisearch details.
// titles only for now — message content lands here once we intercept transcripts.

export type SearchHit = {
  pk: string;
  chatId: string;
  title: string;
  platform: Chat['platform'];
  account: string;
  folderId?: string;
  updatedAt: number;
};

export function createChatIndex() {
  return new MiniSearch<SearchHit>({
    idField: 'pk',
    fields: ['title'],
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

export function upsertChatsIntoIndex(index: MiniSearch<SearchHit>, chats: Chat[]) {
  for (const chat of chats) {
    const doc = chatToDoc(chat);
    if (index.has(doc.pk)) {
      index.replace(doc);
    } else {
      index.add(doc);
    }
  }
}

export function rebuildIndex(chats: Chat[]): MiniSearch<SearchHit> {
  const index = createChatIndex();
  index.addAll(chats.map(chatToDoc));
  return index;
}
