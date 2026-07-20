import { useCallback, useState } from 'react';
import type { Chat, Folder, Message, Platform, Tag } from '@/src/core/types';
import type { ChatAsset } from '@/src/core/assets';
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
import { buildExportZip, downloadZip, zipFilename } from '@/src/core/zip-export';

export type ExportFormat = 'markdown' | 'archive' | 'zip';

// find an open tab for the platform whose content script can do an authed fetch.
async function findPlatformTab(platform: Platform): Promise<number | null> {
  const tabs = await browser.tabs.query({ url: `https://${platformHost(platform)}/*` });
  return tabs[0]?.id ?? null;
}

async function fetchLiveBundle(
  tabId: number,
  orgId: string,
  chatIds: string[],
): Promise<Map<string, { messages: Message[]; assets: ChatAsset[] }>> {
  const map = new Map<string, { messages: Message[]; assets: ChatAsset[] }>();
  try {
    const res = (await browser.tabs.sendMessage(tabId, {
      type: 'fetch_conversations',
      orgId,
      chatIds,
    })) as RuntimeResponse | undefined;

    if (res?.type === 'fetch_conversations_ok') {
      for (const r of res.results) {
        map.set(r.chatId, {
          messages: r.messages,
          assets: r.assets ?? [],
        });
      }
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

async function logActivity(
  action: 'export_markdown' | 'export_archive' | 'export_zip',
  detail: string,
) {
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

      setBusy(true);
      setProgress({ done: 0, total: chats.length });

      try {
        const messagesByChatId = new Map<string, Message[]>();
        const assetsByChatId = new Map<string, ChatAsset[]>();

        // group by platform so "all platforms" zip can harvest each site
        const byPlatform = new Map<Platform, Chat[]>();
        for (const chat of chats) {
          const list = byPlatform.get(chat.platform) || [];
          list.push(chat);
          byPlatform.set(chat.platform, list);
        }

        let done = 0;
        const chunkSize = 4;

        for (const [platform, platformChats] of byPlatform.entries()) {
          const tabId = await findPlatformTab(platform);
          // zip always wants a live harvest when possible; markdown/archive too for messages
          if (tabId !== null) {
            const chatsByAccount = new Map<string, Chat[]>();
            for (const chat of platformChats) {
              const list = chatsByAccount.get(chat.account) || [];
              list.push(chat);
              chatsByAccount.set(chat.account, list);
            }

            for (const [orgId, accountChats] of chatsByAccount.entries()) {
              for (let i = 0; i < accountChats.length; i += chunkSize) {
                const chunk = accountChats.slice(i, i + chunkSize);
                const map = await fetchLiveBundle(
                  tabId,
                  orgId,
                  chunk.map((c) => c.chatId),
                );
                for (const [chatId, bundle] of map.entries()) {
                  if (bundle.messages.length > 0) {
                    messagesByChatId.set(chatId, bundle.messages);
                  }
                  if (bundle.assets.length > 0) {
                    assetsByChatId.set(chatId, bundle.assets);
                  }
                }
                done += chunk.length;
                setProgress({ done: Math.min(done, chats.length), total: chats.length });
              }
            }
          } else {
            done += platformChats.length;
            setProgress({ done: Math.min(done, chats.length), total: chats.length });
          }
        }

        // fill message gaps from indexeddb (opened chats, gemini scrape, prior intercepts)
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
          assets: assetsByChatId.get(chat.chatId) ?? [],
        }));

        if (format === 'zip') {
          const { bytes, included, missing: missingAssets } = buildExportZip(entries, label);
          downloadZip(zipFilename(label), bytes);
          await logActivity(
            'export_zip',
            `Exported zip "${label}" with ${chats.length} chats, ${included} files, ${missingAssets} missing`,
          );
          if (included === 0 && missingAssets === 0) {
            setError(
              'ZIP exported with conversation text only — no artifacts/files were found. Open chats that contain artifacts or images and export again.',
            );
          } else if (missingAssets > 0) {
            setError(
              `ZIP exported with ${included} file${included === 1 ? '' : 's'}; ${missingAssets} asset${missingAssets === 1 ? '' : 's'} listed in MISSING.md (expired urls or chat not open).`,
            );
          }
        } else if (format === 'archive') {
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

        if (format !== 'zip' && isMetadataOnly) {
          const platforms = [...byPlatform.keys()];
          const anyTabMissing = (
            await Promise.all(platforms.map(async (p) => (await findPlatformTab(p)) === null))
          ).some(Boolean);
          const hint = anyTabMissing
            ? ' Open the matching AI site and export again to try fetching full messages.'
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
