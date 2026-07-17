import { db } from '@/src/core/db';
import type { RuntimeRequest, RuntimeResponse, BulkStatus } from '@/src/core/bus';
import type { Platform } from '@/src/core/types';
import {
  rebuildIndex,
  upsertChatsIntoIndex,
  type SearchHit,
} from '@/src/core/search';
import type MiniSearch from 'minisearch';
import { fetchRemoteConfig } from '@/src/core/config';

// rebuilt from dexie whenever the worker wakes cold — never trust in-memory alone
let chatIndex: MiniSearch<SearchHit> | null = null;
let indexReady: Promise<void> | null = null;
let isProcessingQueue = false;

export default defineBackground(() => {
  restoreSessionContext();
  ensureIndex();
  fetchRemoteConfig().catch(() => {});
  setTimeout(() => processNextQueueItem(), 2000);

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
      const messages = await db.messages.toArray();
      chatIndex = rebuildIndex(chats, messages);
    })();
  }
  return indexReady;
}

async function handleMessage(msg: RuntimeRequest): Promise<RuntimeResponse> {
  switch (msg.type) {
    case 'ping':
      return { type: 'pong', at: Date.now() };

    case 'upsert_chats': {
      let chatsToUpsert = msg.chats;
      if (chatsToUpsert.length > 0) {
        await db.transaction('rw', db.chats, async () => {
          const existingChats = await db.chats.bulkGet(chatsToUpsert.map((c) => c.pk));
          chatsToUpsert = chatsToUpsert.map((chat, idx) => {
            const existing = existingChats[idx];
            if (existing) {
              return {
                ...chat,
                folderId: existing.folderId || chat.folderId,
                tagIds: existing.tagIds || chat.tagIds,
                pinned: existing.pinned !== undefined ? existing.pinned : chat.pinned,
              };
            }
            return chat;
          });
          await db.chats.bulkPut(chatsToUpsert);
        });

        await browser.storage.session.set({
          activePlatform: chatsToUpsert[0]?.platform,
          activeAccount: chatsToUpsert[0]?.account,
        });
      }
      await ensureIndex();
      if (chatIndex) upsertChatsIntoIndex(chatIndex, chatsToUpsert);
      return { type: 'upsert_chats_ok', count: chatsToUpsert.length };
    }

    case 'upsert_messages': {
      await db.transaction('rw', db.messages, db.chats, async () => {
        await db.messages.where('chatPk').equals(msg.chatPk).delete();
        await db.messages.bulkPut(msg.messages);
      });
      await ensureIndex();
      if (chatIndex) {
        const chat = await db.chats.get(msg.chatPk);
        if (chat) {
          await upsertChatsIntoIndex(chatIndex, [chat]);
        }
      }
      return { type: 'upsert_messages_ok' };
    }

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

    case 'upsert_tag':
      await db.tags.put(msg.tag);
      return { type: 'upsert_tag_ok', tag: msg.tag };

    case 'assign_tags':
      await db.chats.update(msg.chatPk, {
        tagIds: msg.tagIds,
      });
      await ensureIndex();
      if (chatIndex) {
        const chat = await db.chats.get(msg.chatPk);
        if (chat) upsertChatsIntoIndex(chatIndex, [chat]);
      }
      return { type: 'assign_tags_ok' };

    case 'delete_tag':
      await db.transaction('rw', db.tags, db.chats, async () => {
        await db.tags.delete(msg.tagId);
        await db.chats.toCollection().modify((chat) => {
          if (chat.tagIds && chat.tagIds.includes(msg.tagId)) {
            chat.tagIds = chat.tagIds.filter((t) => t !== msg.tagId);
          }
        });
      });
      indexReady = null;
      chatIndex = null;
      await ensureIndex();
      return { type: 'delete_tag_ok' };

    case 'search_chats': {
      await ensureIndex();
      const q = msg.query.trim();
      let hits: SearchHit[] = [];

      if (!chatIndex) {
        return { type: 'search_chats_ok', hits: [], titlesOnly: true };
      }

      if (q) {
        const results = chatIndex.search(q);
        const topResults = results.slice(0, msg.limit ?? 12);
        hits = await Promise.all(
          topResults.map(async (r) => {
            let text: string | undefined = undefined;
            const pkVal = (r.pk || r.id) as string;
            try {
              const messages = await db.messages.where('chatPk').equals(pkVal).toArray();
              text = messages.map((m) => m.text).join('\n');
            } catch {
              // ignore
            }
            return {
              pk: pkVal,
              chatId: r.chatId as string,
              title: r.title as string,
              text,
              platform: r.platform as SearchHit['platform'],
              account: r.account as string,
              folderId: r.folderId as string | undefined,
              updatedAt: r.updatedAt as number,
            };
          })
        );
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

    case 'list_tags': {
      const tags = await db.tags
        .where({ platform: msg.platform, account: msg.account })
        .toArray();
      return { type: 'list_tags_ok', tags };
    }

    case 'start_bulk_delete': {
      const queue: BulkStatus = {
        active: true,
        chatPks: msg.chatPks,
        currentIdx: 0,
        errors: 0,
        results: [],
        status: 'running',
      };
      await browser.storage.local.set({ tecora_bulk_queue: queue });
      setTimeout(() => processNextQueueItem(), 500);
      return { type: 'start_bulk_delete_ok' };
    }

    case 'get_bulk_status': {
      const data = await browser.storage.local.get('tecora_bulk_queue');
      const status = (data['tecora_bulk_queue'] as BulkStatus) || {
        active: false,
        chatPks: [],
        currentIdx: 0,
        errors: 0,
        results: [],
        status: 'idle',
      };
      return { type: 'get_bulk_status_ok', status };
    }

    case 'execute_delete':
      // handled in content script, kept for switch exhaustiveness
      return { type: 'execute_delete_ok' };

    case 'fetch_conversations':
      // handled by the content script (authed page context), never the worker.
      // this branch only exists to keep the switch exhaustive.
      return { type: 'fetch_conversations_ok', results: [] };
  }
}

const PLATFORM_HOST: Record<Platform, string> = {
  claude: 'claude.ai',
  chatgpt: 'chatgpt.com',
  gemini: 'gemini.google.com',
};

async function findPlatformTab(platform: Platform): Promise<number | null> {
  const tabs = await browser.tabs.query({ url: `https://${PLATFORM_HOST[platform]}/*` });
  return tabs[0]?.id ?? null;
}

async function processNextQueueItem() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    const data = await browser.storage.local.get('tecora_bulk_queue');
    const queue = data['tecora_bulk_queue'] as BulkStatus | undefined;
    if (!queue || !queue.active || queue.status !== 'running') {
      isProcessingQueue = false;
      return;
    }

    if (queue.currentIdx >= queue.chatPks.length) {
      queue.active = false;
      queue.status = 'completed';
      await browser.storage.local.set({ tecora_bulk_queue: queue });
      isProcessingQueue = false;
      return;
    }

    const chatPk = queue.chatPks[queue.currentIdx];
    const chat = await db.chats.get(chatPk);
    if (!chat) {
      queue.results.push({ chatPk, success: false, error: 'Chat not found in database' });
      queue.currentIdx++;
      await browser.storage.local.set({ tecora_bulk_queue: queue });
      isProcessingQueue = false;
      setTimeout(() => processNextQueueItem(), 1000);
      return;
    }

    const tabId = await findPlatformTab(chat.platform);
    if (!tabId) {
      queue.status = 'paused';
      queue.results.push({ chatPk, success: false, error: `Please open ${chat.platform} in a tab to continue` });
      await browser.storage.local.set({ tecora_bulk_queue: queue });
      isProcessingQueue = false;
      return;
    }

    try {
      const response = (await browser.tabs.sendMessage(tabId, {
        type: 'execute_delete',
        chatPk,
      } as RuntimeRequest)) as RuntimeResponse | undefined;

      if (response && response.type === 'execute_delete_ok') {
        await db.chats.delete(chatPk);
        await db.messages.where('chatPk').equals(chatPk).delete();
        indexReady = null;
        chatIndex = null;

        queue.results.push({ chatPk, success: true });
        queue.errors = 0;
      } else {
        const errMsg = response && response.type === 'execute_delete_error' ? response.error : 'Unknown error';
        queue.results.push({ chatPk, success: false, error: errMsg });
        queue.errors++;
      }
    } catch (err) {
      queue.results.push({ chatPk, success: false, error: String(err) });
      queue.errors++;
    }

    if (queue.errors >= 5) {
      queue.active = false;
      queue.status = 'failed';
    } else {
      queue.currentIdx++;
    }

    await browser.storage.local.set({ tecora_bulk_queue: queue });

    isProcessingQueue = false;
    if (queue.status === 'running') {
      const delay = 1000 + Math.random() * 1000;
      setTimeout(() => processNextQueueItem(), delay);
    }
  } catch (err) {
    console.error('[tecora] queue processor error:', err);
    isProcessingQueue = false;
  }
}
