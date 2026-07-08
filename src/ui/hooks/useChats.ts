import { db } from '@/src/core/db';
import type { Chat, Platform } from '@/src/core/types';
import { useLiveQuery } from './useLiveQuery';

export function useChats(
  platform: Platform | null,
  account: string | null,
  // null = all chats, '' = unassigned only, string = specific folder
  folderId: string | null,
  query: string,
): Chat[] {
  return (
    useLiveQuery(
      async () => {
        if (!platform || !account) return [];

        let chats = await db.chats
          .where('[platform+account]')
          .equals([platform, account])
          .reverse()
          .sortBy('updatedAt');

        if (folderId === '') {
          chats = chats.filter((c) => !c.folderId);
        } else if (folderId !== null) {
          chats = chats.filter((c) => c.folderId === folderId);
        }

        if (query.trim()) {
          const q = query.toLowerCase();
          chats = chats.filter((c) => c.title.toLowerCase().includes(q));
        }

        return chats;
      },
      [platform, account, folderId, query],
      [],
    ) ?? []
  );
}
