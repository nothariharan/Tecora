import { db } from '@/src/core/db';
import type { RuntimeRequest, RuntimeResponse } from '@/src/core/bus';
import {
  rebuildIndex,
  upsertChatsIntoIndex,
  type SearchHit,
} from '@/src/core/search';
import type MiniSearch from 'minisearch';

// rebuilt from dexie whenever the worker wakes cold — never trust in-memory alone
let chatIndex: MiniSearch<SearchHit> | null = null;
let indexReady: Promise<void> | null = null;

export default defineBackground(() => {
  restoreSessionContext();
  ensureIndex();

  browser.action.onClicked.addListener((tab) => {
    if (tab.id) browser.sidePanel.open({ tabId: tab.id });
  });

  browser.runtime.onMessage.addListener(
    (message: RuntimeRequest, _sender, sendResponse): true => {
      handleMessage(message).then(sendResponse);
      return true;
    },
  );
});

async function restoreSessionContext() {
  const existing = await browser.storage.session.get(['activePlatform', 'activeAccount']);
  if (existing['activePlatform']) return;

  const latest = await db.chats.orderBy('updatedAt').last();
  if (latest) {
    await browser.storage.session.set({
      activePlatform: latest.platform,
      activeAccount: latest.account,
    });
  }
}

function ensureIndex(): Promise<void> {
  if (!indexReady) {
    indexReady = (async () => {
      const chats = await db.chats.toArray();
      chatIndex = rebuildIndex(chats);
    })();
  }
  return indexReady;
}

async function handleMessage(msg: RuntimeRequest): Promise<RuntimeResponse> {
  switch (msg.type) {
    case 'ping':
      return { type: 'pong', at: Date.now() };

    case 'upsert_chats':
      await db.chats.bulkPut(msg.chats);
      await browser.storage.session.set({
        activePlatform: msg.chats[0]?.platform,
        activeAccount: msg.chats[0]?.account,
      });
      await ensureIndex();
      if (chatIndex) upsertChatsIntoIndex(chatIndex, msg.chats);
      return { type: 'upsert_chats_ok', count: msg.chats.length };

    case 'upsert_folder':
      await db.folders.put(msg.folder);
      return { type: 'upsert_folder_ok', folder: msg.folder };

    case 'assign_folder':
      await db.chats.update(msg.chatPk, {
        folderId: msg.folderId ?? undefined,
      });
      // keep search docs in sync with folder moves
      await ensureIndex();
      if (chatIndex) {
        const chat = await db.chats.get(msg.chatPk);
        if (chat) upsertChatsIntoIndex(chatIndex, [chat]);
      }
      return { type: 'assign_folder_ok' };

    case 'delete_folder':
      await db.transaction('rw', db.folders, db.chats, async () => {
        await db.folders.delete(msg.folderId);
        await db.chats
          .where('folderId')
          .equals(msg.folderId)
          .modify({ folderId: undefined });
      });
      // cheapest fix: rebuild after a folder wipe
      indexReady = null;
      chatIndex = null;
      await ensureIndex();
      return { type: 'delete_folder_ok' };

    case 'search_chats': {
      await ensureIndex();
      const q = msg.query.trim();
      let hits: SearchHit[] = [];

      if (!chatIndex) {
        return { type: 'search_chats_ok', hits: [], titlesOnly: true };
      }

      if (q) {
        hits = chatIndex.search(q).map((r) => ({
          pk: r.pk as string,
          chatId: r.chatId as string,
          title: r.title as string,
          platform: r.platform as SearchHit['platform'],
          account: r.account as string,
          folderId: r.folderId as string | undefined,
          updatedAt: r.updatedAt as number,
        }));
      } else {
        // empty query → recent chats for the active scope
        const chats = await db.chats.orderBy('updatedAt').reverse().limit(msg.limit ?? 12).toArray();
        hits = chats.map((c) => ({
          pk: c.pk,
          chatId: c.chatId,
          title: c.title,
          platform: c.platform,
          account: c.account,
          folderId: c.folderId,
          updatedAt: c.updatedAt,
        }));
      }

      if (msg.platform) hits = hits.filter((h) => h.platform === msg.platform);
      if (msg.account) hits = hits.filter((h) => h.account === msg.account);

      return {
        type: 'search_chats_ok',
        hits: hits.slice(0, msg.limit ?? 20),
        titlesOnly: true,
      };
    }

    case 'list_folders': {
      const folders = await db.folders
        .where({ platform: msg.platform, account: msg.account })
        .toArray();
      return { type: 'list_folders_ok', folders };
    }

    case 'fetch_conversations':
      // handled by the content script (authed page context), never the worker.
      // this branch only exists to keep the switch exhaustive.
      return { type: 'fetch_conversations_ok', results: [] };
  }
}
