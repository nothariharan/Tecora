import { db } from '@/src/core/db';
import type { Folder, Platform } from '@/src/core/types';
import { useLiveQuery } from './useLiveQuery';

export function useFolders(platform: Platform | null, account: string | null): Folder[] {
  return (
    useLiveQuery(
      async () => {
        if (!platform || !account) return [];
        return db.folders.where({ platform, account }).toArray();
      },
      [platform, account],
      [],
    ) ?? []
  );
}
