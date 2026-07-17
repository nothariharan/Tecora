import Dexie, { type Table } from 'dexie';
import type { Chat, Folder, Tag, Message } from './types';

export class TecoraDB extends Dexie {
  chats!: Table<Chat, string>;
  folders!: Table<Folder, string>;
  tags!: Table<Tag, string>;
  messages!: Table<Message, string>;

  constructor() {
    super('tecora');
    this.version(1).stores({
      chats:   'pk, [platform+account], folderId, updatedAt',
      folders: 'id, platform, account',
      tags:    'id, platform, account',
    });
    this.version(2).stores({
      chats:   'pk, [platform+account], folderId, updatedAt, *tagIds',
      folders: 'id, platform, account',
      tags:    'id, platform, account',
      messages: 'pk, chatPk, ts',
    });
  }
}

// never import this from content scripts — extension IndexedDB is not reachable there
export const db = new TecoraDB();
