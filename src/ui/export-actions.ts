import { useCallback, useState } from 'react';
import type { Chat, Message, Platform } from '@/src/core/types';
import type { RuntimeResponse } from '@/src/core/bus';
import {
  bulkFilename,
  bulkToMarkdown,
  chatToMarkdown,
  downloadText,
  singleFilename,
} from '@/src/core/export';

const PLATFORM_HOST: Record<Platform, string> = {
  claude: 'claude.ai',
  chatgpt: 'chatgpt.com',
  gemini: 'gemini.google.com',
};

// find an open tab for the platform whose content script can do an authed fetch.
async function findPlatformTab(platform: Platform): Promise<number | null> {
  const tabs = await browser.tabs.query({ url: `https://${PLATFORM_HOST[platform]}/*` });
  return tabs[0]?.id ?? null;
}

async function fetchMessages(
  tabId: number,
  orgId: string,
  chatIds: string[],
): Promise<Map<string, Message[]>> {
  const res = (await browser.tabs.sendMessage(tabId, {
    type: 'fetch_conversations',
    orgId,
    chatIds,
  })) as RuntimeResponse | undefined;

  const map = new Map<string, Message[]>();
  if (res?.type === 'fetch_conversations_ok') {
    for (const r of res.results) map.set(r.chatId, r.messages);
  }
  return map;
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
    async (chats: Chat[], label: string, single = false) => {
      setError(null);
      if (chats.length === 0) {
        setError('Nothing to export.');
        return;
      }

      const platform = chats[0]!.platform;
      const orgId = chats[0]!.account;

      const tabId = await findPlatformTab(platform);
      if (tabId === null) {
        setError(`Open ${PLATFORM_HOST[platform]} in a tab to export.`);
        return;
      }

      setBusy(true);
      setProgress({ done: 0, total: chats.length });

      try {
        const messagesByChat = new Map<string, Message[]>();
        
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
            const map = await fetchMessages(
              tabId,
              orgId,
              chunk.map((c) => c.chatId),
            );
            map.forEach((v, k) => messagesByChat.set(k, v));
            done += chunk.length;
            setProgress({ done, total: chats.length });
          }
        }

        if (single && chats.length === 1) {
          const chat = chats[0]!;
          downloadText(
            singleFilename(chat),
            chatToMarkdown(chat, messagesByChat.get(chat.chatId) ?? []),
          );
        } else {
          const entries = chats.map((chat) => ({
            chat,
            messages: messagesByChat.get(chat.chatId) ?? [],
          }));
          downloadText(bulkFilename(label), bulkToMarkdown(entries, label));
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
