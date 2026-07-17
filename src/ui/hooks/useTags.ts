import { db } from '@/src/core/db';
import type { Tag, Platform } from '@/src/core/types';
import { useLiveQuery } from './useLiveQuery';

export function useTags(platform: Platform | null, account: string | null): Tag[] {
  return (
    useLiveQuery(
      async () => {
        if (!platform || !account) return [];
        return db.tags.where({ platform, account }).toArray();
      },
      [platform, account],
      [],
    ) ?? []
  );
}
