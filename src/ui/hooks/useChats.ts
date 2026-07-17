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
        // no active account yet — still show whatever we have so the panel
        // isn't empty just because session storage hasn't caught up
        let chats =
          platform && account
            ? await db.chats
                .where('[platform+account]')
                .equals([platform, account])
                .reverse()
                .sortBy('updatedAt')
            : await db.chats.orderBy('updatedAt').reverse().toArray();

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
