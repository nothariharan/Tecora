import Dexie, { type Table } from 'dexie';
import type { ActivityLogEntry, Chat, Folder, Tag, Message } from './types';

export class TecoraDB extends Dexie {
  chats!: Table<Chat, string>;
  folders!: Table<Folder, string>;
  tags!: Table<Tag, string>;
  messages!: Table<Message, string>;
  activityLog!: Table<ActivityLogEntry, string>;

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
    this.version(3).stores({
      chats:   'pk, [platform+account], folderId, updatedAt, *tagIds',
      folders: 'id, platform, account',
      tags:    'id, platform, account',
      messages: 'pk, chatPk, ts',
      activityLog: 'id, at, action',
    });
  }
}

let dbInstance: TecoraDB;
try {
  dbInstance = new TecoraDB();
  dbInstance.on('blocked', () => {
    console.warn('[tecora] database access blocked by another active tab');
  });
} catch (err) {
  console.error('[tecora] failed to initialize Dexie database:', err);
  dbInstance = new Dexie('tecora_fallback') as TecoraDB;
}
export const db = dbInstance;
