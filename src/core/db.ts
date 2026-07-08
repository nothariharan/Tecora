import Dexie, { type Table } from 'dexie';
import type { Chat, Folder, Tag } from './types';

export class TecoraDB extends Dexie {
  chats!: Table<Chat, string>;
  folders!: Table<Folder, string>;
  tags!: Table<Tag, string>;

  constructor() {
    super('tecora');
    this.version(1).stores({
      chats:   'pk, [platform+account], folderId, updatedAt',
      folders: 'id, platform, account',
      tags:    'id, platform, account',
    });
  }
}

// never import this from content scripts — extension IndexedDB is not reachable there
export const db = new TecoraDB();
