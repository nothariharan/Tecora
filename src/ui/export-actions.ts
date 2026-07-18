import { useCallback, useState } from 'react';
import type { Chat, Folder, Message, Platform, Tag } from '@/src/core/types';
import type { RuntimeRequest, RuntimeResponse } from '@/src/core/bus';
import { platformHost } from '@/src/core/chat-url';
import {
  archiveFilename,
  bulkFilename,
  bulkToMarkdown,
  chatToMarkdown,
  downloadJson,
  downloadText,
  portableArchive,
  singleFilename,
} from '@/src/core/export';

export type ExportFormat = 'markdown' | 'archive';

// find an open tab for the platform whose content script can do an authed fetch.
async function findPlatformTab(platform: Platform): Promise<number | null> {
  const tabs = await browser.tabs.query({ url: `https://${platformHost(platform)}/*` });
  return tabs[0]?.id ?? null;
}

async function fetchLiveMessages(
  tabId: number,
  orgId: string,
  chatIds: string[],
): Promise<Map<string, Message[]>> {
  const map = new Map<string, Message[]>();
  try {
    const res = (await browser.tabs.sendMessage(tabId, {
      type: 'fetch_conversations',
      orgId,
      chatIds,
    })) as RuntimeResponse | undefined;

    if (res?.type === 'fetch_conversations_ok') {
      for (const r of res.results) map.set(r.chatId, r.messages);
    }
  } catch (err) {
    console.warn('[tecora] live export fetch failed; falling back to stored messages', err);
  }
  return map;
}

async function fetchStoredMessages(chatPks: string[]): Promise<Map<string, Message[]>> {
  const res = (await browser.runtime.sendMessage({
    type: 'get_stored_messages',
    chatPks,
  } satisfies RuntimeRequest)) as RuntimeResponse;

  const map = new Map<string, Message[]>();
  if (res?.type === 'get_stored_messages_ok') {
    for (const [pk, messages] of Object.entries(res.byChatPk)) {
      map.set(pk, messages);
    }
  }
  return map;
}

async function fetchArchiveMetadata(
  chats: Chat[],
): Promise<{ folders: Folder[]; tags: Tag[] }> {
  const scopes = new Map<string, { platform: Platform; account: string }>();
  for (const chat of chats) {
    scopes.set(`${chat.platform}:${chat.account}`, {
      platform: chat.platform,
      account: chat.account,
    });
  }

  const folders: Folder[] = [];
  const tags: Tag[] = [];

  for (const scope of scopes.values()) {
    const [folderRes, tagRes] = await Promise.all([
      browser.runtime.sendMessage({
        type: 'list_folders',
        platform: scope.platform,
        account: scope.account,
      } satisfies RuntimeRequest) as Promise<RuntimeResponse>,
      browser.runtime.sendMessage({
        type: 'list_tags',
        platform: scope.platform,
        account: scope.account,
      } satisfies RuntimeRequest) as Promise<RuntimeResponse>,
    ]);

    if (folderRes.type === 'list_folders_ok') folders.push(...folderRes.folders);
    if (tagRes.type === 'list_tags_ok') tags.push(...tagRes.tags);
  }

  return { folders, tags };
}

async function logActivity(action: 'export_markdown' | 'export_archive', detail: string) {
  await browser.runtime.sendMessage({
    type: 'log_activity',
    action,
    detail,
  } satisfies RuntimeRequest);
}

export interface ExportProgress {
  done: number;
  total: number;
}

export function useExporter() {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportChats = useCallback(
    async (chats: Chat[], label: string, single = false, format: ExportFormat = 'markdown') => {
      setError(null);
      if (chats.length === 0) {
        setError('Nothing to export.');
        return;
      }

      const platform = chats[0]!.platform;
      const tabId = await findPlatformTab(platform);

      setBusy(true);
      setProgress({ done: 0, total: chats.length });

      try {
        const messagesByChatId = new Map<string, Message[]>();

        // live fetch when a platform tab is open (gemini has no live path yet)
        if (tabId !== null && platform !== 'gemini') {
          const chatsByAccount = new Map<string, Chat[]>();
          for (const chat of chats) {
            const list = chatsByAccount.get(chat.account) || [];
            list.push(chat);
            chatsByAccount.set(chat.account, list);
          }

          let done = 0;
          const chunkSize = 4;

          for (const [orgId, accountChats] of chatsByAccount.entries()) {
            for (let i = 0; i < accountChats.length; i += chunkSize) {
              const chunk = accountChats.slice(i, i + chunkSize);
              const map = await fetchLiveMessages(
                tabId,
                orgId,
                chunk.map((c) => c.chatId),
              );
              map.forEach((v, k) => messagesByChatId.set(k, v));
              done += chunk.length;
              setProgress({ done, total: chats.length });
            }
          }
        }

        // fill gaps from indexeddb (opened chats, gemini scrape, prior intercepts)
        const missing = chats.filter((c) => !(messagesByChatId.get(c.chatId)?.length));
        if (missing.length > 0) {
          const stored = await fetchStoredMessages(missing.map((c) => c.pk));
          for (const chat of missing) {
            const msgs = stored.get(chat.pk) ?? [];
            if (msgs.length > 0) messagesByChatId.set(chat.chatId, msgs);
          }
        }

        const empty = chats.filter((c) => !(messagesByChatId.get(c.chatId)?.length));
        const isMetadataOnly = empty.length === chats.length;

        const entries = chats.map((chat) => ({
          chat,
          messages: messagesByChatId.get(chat.chatId) ?? [],
        }));

        if (format === 'archive') {
          const metadata = await fetchArchiveMetadata(chats);
          downloadJson(archiveFilename(label), portableArchive(entries, metadata));
          await logActivity('export_archive', `Exported archive "${label}" with ${chats.length} chats`);
        } else if (single && chats.length === 1) {
          const chat = chats[0]!;
          downloadText(
            singleFilename(chat),
            chatToMarkdown(chat, messagesByChatId.get(chat.chatId) ?? []),
          );
          await logActivity('export_markdown', `Exported markdown for "${chat.title}"`);
        } else {
          downloadText(bulkFilename(label), bulkToMarkdown(entries, label));
          await logActivity('export_markdown', `Exported markdown "${label}" with ${chats.length} chats`);
        }

        if (isMetadataOnly) {
          const hint =
            tabId === null && platform !== 'gemini'
              ? ` Open ${platformHost(platform)} and export again to try fetching full messages.`
              : ' Open the chats once, then export again to capture full messages.';
          setError(`Exported chat metadata only; no messages were captured yet.${hint}`);
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setBusy(false);
        setProgress(null);
      }
    },
    [],
  );

  return { busy, progress, error, exportChats };
}
