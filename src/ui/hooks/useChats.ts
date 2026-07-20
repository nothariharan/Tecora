import { db } from '@/src/core/db';
import type { Chat, Platform } from '@/src/core/types';
import { useLiveQuery } from './useLiveQuery';

export function useChats(
  platform: Platform | null,
  account: string | null,
  folderId: string | null,
  tagId: string | null,
  query: string,
): Chat[] {
  return (
    useLiveQuery(
      async () => {
        let chats: Chat[] = [];

        if (platform && account) {
          chats = await db.chats
            .where('[platform+account]')
            .equals([platform, account])
            .reverse()
            .sortBy('updatedAt');

          // gemini account ids can drift (cookie hint vs default) — don't show an
          // empty panel when we clearly have chats for this platform
          if (chats.length === 0) {
            chats = await db.chats.where('platform').equals(platform).reverse().sortBy('updatedAt');
          }
        } else if (platform) {
          chats = await db.chats.where('platform').equals(platform).reverse().sortBy('updatedAt');
        } else {
          chats = await db.chats.orderBy('updatedAt').reverse().toArray();
        }

        if (folderId === '') {
          chats = chats.filter((c) => !c.folderId);
        } else if (folderId !== null) {
          chats = chats.filter((c) => c.folderId === folderId);
        }

        if (tagId !== null) {
          chats = chats.filter((c) => c.tagIds && c.tagIds.includes(tagId));
        }

        if (query.trim()) {
          const q = query.toLowerCase();
          chats = chats.filter((c) => c.title.toLowerCase().includes(q));
        }

        return chats;
      },
      [platform, account, folderId, tagId, query],
      [],
    ) ?? []
  );
}
