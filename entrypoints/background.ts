import { db } from '@/src/core/db';
import type { RuntimeRequest, RuntimeResponse, BulkStatus } from '@/src/core/bus';
import type { Message, Platform } from '@/src/core/types';
import {
  rebuildIndex,
  upsertChatsIntoIndex,
  type SearchHit,
} from '@/src/core/search';
import type MiniSearch from 'minisearch';
import { fetchRemoteConfig } from '@/src/core/config';
import { isPortableArchive } from '@/src/core/export';
import {
  normalizePrivacySettings,
  platformFromChatPk,
} from '@/src/core/privacy';
import { platformFromUrl } from '@/src/core/chat-url';
import { codeLanguagesFromTexts } from '@/src/core/code-fences';
import type { ActivityLogEntry, PrivacySettings } from '@/src/core/types';

// rebuilt from dexie whenever the worker wakes cold — never trust in-memory alone
let chatIndex: MiniSearch<SearchHit> | null = null;
let indexReady: Promise<void> | null = null;
let isProcessingQueue = false;
const PRIVACY_SETTINGS_KEY = 'tecora_privacy_settings';

export default defineBackground(() => {
  restoreSessionContext();
  ensureIndex();
  fetchRemoteConfig().catch(() => {});
  setTimeout(() => processNextQueueItem(), 2000);

  // toolbar click still opens the panel; dock file button uses open_side_panel
  browser.action.onClicked.addListener((tab) => {
    if (tab.id) {
      void syncActiveContextFromTab(tab);
      // keep sync — chrome drops the gesture if we await first
      void browser.sidePanel.open({ tabId: tab.id });
    }
  });

  // side panel "On X" must follow the focused tab, not the last upserted chat
  browser.tabs.onActivated.addListener(({ tabId }) => {
    void browser.tabs.get(tabId).then((tab) => {
      void syncActiveContextFromTab(tab);
      if (tab.url) void maybeResumeBulkDelete(tab.url);
    });
  });
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' || changeInfo.url) {
      void browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        if (tabs[0]?.id === tabId) void syncActiveContextFromTab(tab);
      });
      // paused bulk delete waits for a matching platform tab to show up
      if (changeInfo.status === 'complete' && tab.url) {
        void maybeResumeBulkDelete(tab.url);
      }
    }
  });

  browser.runtime.onMessage.addListener(
    (message: RuntimeRequest, sender, sendResponse): boolean => {
      // chrome only keeps the user gesture if open() runs in this turn — no await before it
      if (message.type === 'open_side_panel') {
        const tabId = sender.tab?.id;
        const windowId = sender.tab?.windowId;
        if (tabId == null) {
          sendResponse({
            type: 'open_side_panel_error',
            error: 'no tab to open beside',
          } satisfies RuntimeResponse);
          return false;
        }

        const openOpts =
          windowId != null ? { tabId, windowId } : { tabId };

        try {
          const opening = browser.sidePanel.open(openOpts);
          opening.then(
            () => {
              sendResponse({ type: 'open_side_panel_ok' } satisfies RuntimeResponse);
            },
            async (err: unknown) => {
              // gesture lost / chrome quirk — fall back to a dedicated popup
              try {
                await browser.windows.create({
                  url: browser.runtime.getURL('/sidepanel.html'),
                  type: 'popup',
                  width: 420,
                  height: 740,
                  focused: true,
                });
                sendResponse({ type: 'open_side_panel_ok' } satisfies RuntimeResponse);
              } catch (fallbackErr) {
                const msg =
                  err instanceof Error
                    ? err.message
                    : fallbackErr instanceof Error
                      ? fallbackErr.message
                      : String(err);
                sendResponse({
                  type: 'open_side_panel_error',
                  error: msg,
                } satisfies RuntimeResponse);
              }
            },
          );
        } catch (err) {
          sendResponse({
            type: 'open_side_panel_error',
            error: err instanceof Error ? err.message : String(err),
          } satisfies RuntimeResponse);
        }
        return true;
      }

      handleMessage(message, sender).then(sendResponse);
      return true;
    },
  );
});

async function setActiveContext(
  platform: Platform,
  account: string,
  opts: { force?: boolean } = {},
): Promise<void> {
  if (!opts.force) {
    // only accept if a tab on this platform is active in some window.
    // do NOT use lastFocusedWindow alone — that steals gemini when claude
    // is focused in another window.
    const activeTabs = await browser.tabs.query({ active: true });
    const hasMatchingTab = activeTabs.some((tab) => platformFromUrl(tab.url) === platform);
    if (!hasMatchingTab) return;
  }

  const existing = await browser.storage.session.get(['activePlatform', 'activeAccount']);
  if (existing['activePlatform'] === platform && existing['activeAccount'] === account) return;
  await browser.storage.session.set({
    activePlatform: platform,
    activeAccount: account,
  });
}

async function resolveAccountForPlatform(platform: Platform): Promise<string> {
  const existing = await browser.storage.session.get(['activePlatform', 'activeAccount']);
  if (
    existing['activePlatform'] === platform &&
    typeof existing['activeAccount'] === 'string' &&
    existing['activeAccount']
  ) {
    return existing['activeAccount'] as string;
  }

  const chats = await db.chats.where('platform').equals(platform).toArray();
  if (chats.length === 0) return 'default';
  chats.sort((a, b) => b.updatedAt - a.updatedAt);
  return chats[0]!.account;
}

async function syncActiveContextFromTab(
  tab: { id?: number; url?: string } | undefined | null,
): Promise<{ platform: Platform; account: string } | null> {
  const platform = platformFromUrl(tab?.url);
  if (!platform) return null;

  // prefer the live account from the page's content script
  let account = await resolveAccountForPlatform(platform);
  if (tab?.id != null) {
    try {
      const page = (await browser.tabs.sendMessage(tab.id, {
        type: 'get_page_context',
      } satisfies RuntimeRequest)) as RuntimeResponse;
      if (page?.type === 'get_page_context_ok' && page.platform === platform) {
        account = page.account;
      }
    } catch {
      // content script may not be injected yet
    }
  }

  await setActiveContext(platform, account, { force: true });
  return { platform, account };
}

async function syncActiveContextFromFocusedTab(): Promise<{
  platform: Platform;
  account: string;
} | null> {
  // try a few queries — side panel focus makes lastFocusedWindow flaky
  const queries = [
    { active: true, lastFocusedWindow: true },
    { active: true, currentWindow: true },
  ];
  for (const query of queries) {
    const tabs = await browser.tabs.query(query);
    const synced = await syncActiveContextFromTab(tabs[0]);
    if (synced) return synced;
  }
  return null;
}

async function syncActiveContextFromTabId(
  tabId: number,
): Promise<{ platform: Platform; account: string } | null> {
  try {
    const tab = await browser.tabs.get(tabId);
    return syncActiveContextFromTab(tab);
  } catch {
    return null;
  }
}

async function restoreSessionContext() {
  // prefer the focused supported tab over whatever chat was upserted last
  const fromTab = await syncActiveContextFromFocusedTab();
  if (fromTab) return;

  const existing = await browser.storage.session.get(['activePlatform', 'activeAccount']);
  if (existing['activePlatform']) return;

  const latest = await db.chats.orderBy('updatedAt').last();
  if (latest) {
    await setActiveContext(latest.platform, latest.account, { force: true });
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

function entryId(): string {
  return `log:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

async function logActivity(action: ActivityLogEntry['action'], detail: string) {
  await db.activityLog.put({
    id: entryId(),
    at: Date.now(),
    action,
    detail,
  });
}

async function getPrivacySettings(): Promise<PrivacySettings> {
  const data = await browser.storage.local.get(PRIVACY_SETTINGS_KEY);
  return normalizePrivacySettings(data[PRIVACY_SETTINGS_KEY]);
}

async function setPrivacySettings(settings: PrivacySettings): Promise<PrivacySettings> {
  const normalized = normalizePrivacySettings(settings);
  await browser.storage.local.set({ [PRIVACY_SETTINGS_KEY]: normalized });

  const disabledPlatforms = Object.entries(normalized.captureMessages)
    .filter(([, enabled]) => !enabled)
    .map(([platform]) => platform);

  if (disabledPlatforms.length > 0) {
    await db.transaction('rw', db.messages, async () => {
      for (const platform of disabledPlatforms) {
        const prefix = `${platform}:`;
        await db.messages
          .filter((message) => message.chatPk.startsWith(prefix))
          .delete();
      }
    });
    indexReady = null;
    chatIndex = null;
    await ensureIndex();
  }

  await logActivity('privacy_settings_updated', 'Updated message-content capture settings');
  return normalized;
}

async function handleMessage(
  msg: RuntimeRequest,
  sender?: { tab?: { id?: number; windowId?: number } },
): Promise<RuntimeResponse> {
  switch (msg.type) {
    case 'ping':
      return { type: 'pong', at: Date.now() };

    case 'set_active_context': {
      if (msg.force) {
        await setActiveContext(msg.platform, msg.account, { force: true });
        return { type: 'set_active_context_ok' };
      }

      // content-script announce: only if that tab is active in its own window
      if (sender?.tab?.id != null && sender.tab.windowId != null) {
        const [activeInWindow] = await browser.tabs.query({
          active: true,
          windowId: sender.tab.windowId,
        });
        if (activeInWindow?.id !== sender.tab.id) {
          return { type: 'set_active_context_ok' };
        }
        await setActiveContext(msg.platform, msg.account, { force: true });
        return { type: 'set_active_context_ok' };
      }

      await setActiveContext(msg.platform, msg.account);
      return { type: 'set_active_context_ok' };
    }

    case 'sync_active_context': {
      const fromTab =
        typeof msg.tabId === 'number'
          ? await syncActiveContextFromTabId(msg.tabId)
          : await syncActiveContextFromFocusedTab();
      if (fromTab) {
        return {
          type: 'sync_active_context_ok',
          platform: fromTab.platform,
          account: fromTab.account,
        };
      }
      const existing = await browser.storage.session.get(['activePlatform', 'activeAccount']);
      return {
        type: 'sync_active_context_ok',
        platform: (existing['activePlatform'] as Platform | undefined) ?? null,
        account: (existing['activeAccount'] as string | undefined) ?? null,
      };
    }

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

        // never let a background tab's upsert steal the side panel platform.
        // only refresh the account when an active tab is already this platform.
        const first = chatsToUpsert[0];
        if (first) {
          const activeTabs = await browser.tabs.query({ active: true });
          const matching = activeTabs.find(
            (tab) => platformFromUrl(tab.url) === first.platform,
          );
          if (matching) {
            await setActiveContext(first.platform, first.account, { force: true });
          }
        }
      }
      await ensureIndex();
      if (chatIndex) upsertChatsIntoIndex(chatIndex, chatsToUpsert);
      return { type: 'upsert_chats_ok', count: chatsToUpsert.length };
    }

    case 'upsert_messages': {
      const platform = platformFromChatPk(msg.chatPk);
      const privacy = await getPrivacySettings();
      if (platform && !privacy.captureMessages[platform]) {
        await db.messages.where('chatPk').equals(msg.chatPk).delete();
        indexReady = null;
        chatIndex = null;
        await ensureIndex();
        return { type: 'upsert_messages_ok' };
      }

      const codeLangs = codeLanguagesFromTexts(msg.messages.map((m) => m.text));
      await db.transaction('rw', db.messages, db.chats, async () => {
        await db.messages.where('chatPk').equals(msg.chatPk).delete();
        await db.messages.bulkPut(msg.messages);
        await db.chats.update(msg.chatPk, { codeLangs });
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

    case 'set_pinned':
      await db.chats.update(msg.chatPk, { pinned: msg.pinned });
      await logActivity(
        'set_pinned',
        `${msg.pinned ? 'Pinned' : 'Unpinned'} ${msg.chatPk}`,
      );
      await ensureIndex();
      if (chatIndex) {
        const chat = await db.chats.get(msg.chatPk);
        if (chat) upsertChatsIntoIndex(chatIndex, [chat]);
      }
      return { type: 'set_pinned_ok' };

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
      const wide = Boolean(msg.codeOnly || msg.language);
      const limit = wide ? 200 : msg.limit ?? 20;

      // scope + code filters must run BEFORE the limit — otherwise a mix of
      // platforms/accounts in the recent window starves the active one.
      const inScope = (platform: string, account: string, codeLangs?: string[]) => {
        if (msg.platform && platform !== msg.platform) return false;
        if (msg.account && account !== msg.account) return false;
        if (msg.codeOnly && (codeLangs?.length ?? 0) === 0) return false;
        if (msg.language && !codeLangs?.includes(msg.language.toLowerCase())) return false;
        return true;
      };

      let hits: SearchHit[] = [];

      if (q) {
        if (!chatIndex) return { type: 'search_chats_ok', hits: [], titlesOnly: true };
        const results = chatIndex
          .search(q)
          .filter((r) =>
            inScope(r.platform as string, r.account as string, r.codeLangs as string[] | undefined),
          )
          .slice(0, limit);
        hits = await Promise.all(
          results.map(async (r) => {
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
              codeLangs: r.codeLangs as string[] | undefined,
            };
          }),
        );
      } else {
        // empty query → most-recent chats within scope. query by the
        // [platform+account] index so we page through the right rows, not a
        // global recent window that other platforms can dominate.
        const scoped =
          msg.platform && msg.account
            ? await db.chats
                .where('[platform+account]')
                .equals([msg.platform, msg.account])
                .toArray()
            : (await db.chats.toArray()).filter((c) => inScope(c.platform, c.account, c.codeLangs));
        scoped.sort((a, b) => b.updatedAt - a.updatedAt);
        hits = scoped
          .filter((c) => inScope(c.platform, c.account, c.codeLangs))
          .slice(0, limit)
          .map((c) => ({
            pk: c.pk,
            chatId: c.chatId,
            title: c.title,
            platform: c.platform,
            account: c.account,
            folderId: c.folderId,
            updatedAt: c.updatedAt,
            codeLangs: c.codeLangs,
          }));
      }

      const msgCount = await db.messages.limit(1).count();
      return {
        type: 'search_chats_ok',
        hits,
        titlesOnly: msgCount === 0,
      };
    }

    case 'get_stored_messages': {
      const byChatPk: Record<string, Message[]> = {};
      for (const chatPk of msg.chatPks) {
        const messages = await db.messages.where('chatPk').equals(chatPk).sortBy('ts');
        byChatPk[chatPk] = messages;
      }
      return { type: 'get_stored_messages_ok', byChatPk };
    }

    case 'list_tasks': {
      const tasks = await db.tasks.where('date').equals(msg.date).toArray();
      tasks.sort((a, b) => a.createdAt - b.createdAt);
      return { type: 'list_tasks_ok', tasks };
    }

    case 'upsert_task': {
      await db.tasks.put(msg.task);
      return { type: 'upsert_task_ok', task: msg.task };
    }

    case 'set_task_done': {
      await db.tasks.update(msg.id, { done: msg.done });
      return { type: 'set_task_done_ok' };
    }

    case 'delete_task': {
      await db.tasks.delete(msg.id);
      return { type: 'delete_task_ok' };
    }

    case 'get_notes': {
      const note = (await db.notes.get('scratch')) ?? null;
      return { type: 'get_notes_ok', note };
    }

    case 'set_notes': {
      await db.notes.put({ id: 'scratch', text: msg.text, updatedAt: Date.now() });
      return { type: 'set_notes_ok' };
    }

    case 'get_day_digest': {
      const digest = (await db.dayDigests.get(msg.date)) ?? null;
      return { type: 'get_day_digest_ok', digest };
    }

    case 'put_day_digest': {
      await db.dayDigests.put(msg.digest);
      return { type: 'put_day_digest_ok' };
    }

    case 'get_day_stats': {
      // local-midnight bounds — same wall-clock day the panel buckets tasks by
      const start = new Date(`${msg.date}T00:00:00`).getTime();
      const end = start + 24 * 60 * 60 * 1000;
      const chats = Number.isNaN(start)
        ? []
        : await db.chats.where('updatedAt').between(start, end, true, false).toArray();
      const titles = chats.slice(0, 8).map((c) => c.title);

      let text = '';
      let msgCount = 0;
      for (const chat of chats) {
        const messages = await db.messages.where('chatPk').equals(chat.pk).sortBy('ts');
        msgCount += messages.length;
        for (const m of messages) {
          if (text.length >= 8000) break;
          if (m.text.trim()) text += `${m.role}: ${m.text}\n`;
        }
      }

      const dayTasks = await db.tasks.where('date').equals(msg.date).toArray();
      const tasksCompleted = dayTasks.filter((t) => t.done).length;
      const hash = `${msgCount}:${chats.length}:${tasksCompleted}`;

      return {
        type: 'get_day_stats_ok',
        stats: { chatCount: chats.length, tasksCompleted, titles, text, hash },
      };
    }

    case 'replace_auto_tasks': {
      // swap out just this chat's auto rows for the day, keeping manual rows and
      // preserving done-state for lines the user already ticked
      const rows = await db.transaction('rw', db.tasks, async () => {
        const existing = await db.tasks
          .where('[date+source]')
          .equals([msg.date, 'auto'])
          .and((t) => t.chatPk === msg.chatPk)
          .toArray();
        if (existing.length > 0 && existing.every((t) => t.extractKey === msg.extractKey)) {
          return existing; // unchanged chat — nothing to do
        }
        const doneText = new Set(
          existing.filter((t) => t.done).map((t) => t.text.toLowerCase()),
        );
        await db.tasks.bulkDelete(existing.map((t) => t.id));
        const next = msg.tasks.map((t) => ({
          ...t,
          done: t.done || doneText.has(t.text.toLowerCase()),
        }));
        if (next.length > 0) await db.tasks.bulkPut(next);
        return next;
      });
      return { type: 'replace_auto_tasks_ok', tasks: rows };
    }

    case 'import_archive': {
      if (!isPortableArchive(msg.archive)) {
        throw new Error('Invalid Tecora portable archive');
      }

      const chats = msg.archive.chats.map((entry) => entry.chat);
      const messages = msg.archive.chats.flatMap((entry) => entry.messages);
      const folders = msg.archive.folders ?? [];
      const tags = msg.archive.tags ?? [];
      const tasks = Array.isArray(msg.archive.tasks) ? msg.archive.tasks : [];
      const notes = Array.isArray(msg.archive.notes) ? msg.archive.notes : [];
      const dayDigests = Array.isArray(msg.archive.dayDigests) ? msg.archive.dayDigests : [];

      await db.transaction(
        'rw',
        [db.chats, db.messages, db.folders, db.tags, db.tasks, db.notes, db.dayDigests],
        async () => {
          await db.chats.bulkPut(chats);
          if (folders.length > 0) {
            await db.folders.bulkPut(folders);
          }
          if (tags.length > 0) {
            await db.tags.bulkPut(tags);
          }
          for (const chat of chats) {
            await db.messages.where('chatPk').equals(chat.pk).delete();
          }
          if (messages.length > 0) {
            await db.messages.bulkPut(messages);
          }
          if (tasks.length > 0) await db.tasks.bulkPut(tasks);
          if (notes.length > 0) await db.notes.bulkPut(notes);
          if (dayDigests.length > 0) await db.dayDigests.bulkPut(dayDigests);
        },
      );

      const latest = [...chats].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (latest) await setActiveContext(latest.platform, latest.account, { force: true });

      indexReady = null;
      chatIndex = null;
      await ensureIndex();
      await logActivity(
        'import_archive',
        `Imported ${chats.length} chats, ${messages.length} messages, ${folders.length} folders, ${tags.length} tags`,
      );

      return {
        type: 'import_archive_ok',
        chats: chats.length,
        messages: messages.length,
        folders: folders.length,
        tags: tags.length,
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
      await logActivity('bulk_delete_started', `Started bulk delete for ${msg.chatPks.length} chats`);
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

    case 'get_privacy_settings': {
      return {
        type: 'get_privacy_settings_ok',
        settings: await getPrivacySettings(),
      };
    }

    case 'set_privacy_settings': {
      const settings = await setPrivacySettings(msg.settings);
      return { type: 'set_privacy_settings_ok', settings };
    }

    case 'log_activity':
      await logActivity(msg.action, msg.detail);
      return { type: 'log_activity_ok' };

    case 'list_activity': {
      const entries = await db.activityLog
        .orderBy('at')
        .reverse()
        .limit(msg.limit ?? 20)
        .toArray();
      return { type: 'list_activity_ok', entries };
    }

    case 'wipe_all_data': {
      await db.transaction(
        'rw',
        [db.chats, db.messages, db.folders, db.tags, db.activityLog, db.tasks, db.notes, db.dayDigests],
        async () => {
          await Promise.all([
            db.chats.clear(),
            db.messages.clear(),
            db.folders.clear(),
            db.tags.clear(),
            db.activityLog.clear(),
            db.tasks.clear(),
            db.notes.clear(),
            db.dayDigests.clear(),
          ]);
        },
      );
      await browser.storage.local.remove(['tecora_bulk_queue', PRIVACY_SETTINGS_KEY]);
      // drop any cached on-device digests too
      const allLocal = await browser.storage.local.get(null);
      const digestKeys = Object.keys(allLocal).filter((k) => k.startsWith('tecora_digest:'));
      if (digestKeys.length > 0) await browser.storage.local.remove(digestKeys);
      await browser.storage.session.remove(['activePlatform', 'activeAccount']);
      chatIndex = null;
      indexReady = null;
      await ensureIndex();
      return { type: 'wipe_all_data_ok' };
    }

    case 'execute_delete':
      // handled in content script, kept for switch exhaustiveness
      return { type: 'execute_delete_ok' };

    case 'open_side_panel':
      // opened synchronously in the onMessage listener (gesture-sensitive)
      return { type: 'open_side_panel_ok' };

    case 'get_page_context':
      // handled by the content script
      return { type: 'get_page_context_ok', platform: 'claude', account: 'default' };

    case 'refresh_chats':
      // handled by the content script
      return { type: 'refresh_chats_ok', count: 0 };

    case 'fetch_conversations':
      // handled by the content script (authed page context), never the worker.
      // this branch only exists to keep the switch exhaustive.
      return { type: 'fetch_conversations_ok', results: [] };

    case 'get_usage':
      // handled by the content script (authed page context); stub for exhaustiveness
      return { type: 'get_usage_ok', usage: null };

    case 'migrate_chatgpt_account': {
      await migrateChatGPTAccount(msg.account);
      return { type: 'migrate_chatgpt_account_ok' };
    }
  }
}

// re-key legacy chatgpt rows bucketed under the hardcoded "default" account into
// the real account id, so a single login doesn't fork the library.
async function migrateChatGPTAccount(account: string): Promise<void> {
  if (!account || account === 'default') return;

  const stale = await db.chats
    .filter((c) => c.platform === 'chatgpt' && c.account === 'default')
    .toArray();
  if (stale.length === 0) return;

  await db.transaction('rw', db.chats, db.messages, db.folders, db.tags, async () => {
    for (const chat of stale) {
      const oldPk = chat.pk;
      const newPk = `chatgpt:${account}:${chat.chatId}`;
      if (oldPk === newPk) continue;

      const messages = await db.messages.where('chatPk').equals(oldPk).toArray();
      await db.messages.where('chatPk').equals(oldPk).delete();
      await db.chats.delete(oldPk);
      await db.chats.put({ ...chat, pk: newPk, account });
      if (messages.length > 0) {
        await db.messages.bulkPut(
          messages.map((m, i) => ({ ...m, chatPk: newPk, pk: `${newPk}:${i}` })),
        );
      }
    }
    await db.folders
      .filter((f) => f.platform === 'chatgpt' && f.account === 'default')
      .modify({ account });
    await db.tags
      .filter((t) => t.platform === 'chatgpt' && t.account === 'default')
      .modify({ account });
  });

  indexReady = null;
  chatIndex = null;
  await ensureIndex();
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

async function maybeResumeBulkDelete(url: string): Promise<void> {
  const data = await browser.storage.local.get('tecora_bulk_queue');
  const queue = data['tecora_bulk_queue'] as BulkStatus | undefined;
  if (!queue?.active || queue.status !== 'paused') return;

  const platform = platformFromUrl(url);
  if (!platform) return;

  const chatPk = queue.chatPks[queue.currentIdx];
  if (!chatPk) return;
  const chat = await db.chats.get(chatPk);
  if (!chat || chat.platform !== platform) return;

  queue.status = 'running';
  await browser.storage.local.set({ tecora_bulk_queue: queue });
  setTimeout(() => processNextQueueItem(), 400);
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
      // don't record a failure — resume when the tab appears
      queue.status = 'paused';
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
        // drop related today-tasks so they don't orphan
        await db.tasks.where('chatPk').equals(chatPk).delete();
        indexReady = null;
        chatIndex = null;
        await ensureIndex();

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
