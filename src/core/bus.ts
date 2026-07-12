// all cross-world messages live here so nothing turns into random string checks
//
//   L0 (page)  →  L1 (content)     window.postMessage
//   L1           ↔  L2 (background)  runtime.sendMessage

import type { Chat, Folder, Message, Platform } from './types';
import type { SearchHit } from './search';

// pages spam postMessage for all kinds of stuff — this key is how we filter ours
export const PAGE_MSG_KEY = '__tecora__';

export type PageMessage =
  | { kind: 'hello'; from: 'injected'; at: number }
  // raw = verbatim array from the site's api. adapter normalizes, not L0.
  | {
      kind: 'chats_intercepted';
      platform: Platform;
      account: string;
      raw: unknown[];
      at: number;
    };

export interface PageEnvelope {
  [PAGE_MSG_KEY]: true;
  msg: PageMessage;
}

export function isPageEnvelope(data: unknown): data is PageEnvelope {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>)[PAGE_MSG_KEY] === true
  );
}

// L1 → L2
export type RuntimeRequest =
  | { type: 'ping'; platform: string; at: number }
  | { type: 'upsert_chats'; chats: Chat[] }
  | { type: 'upsert_folder'; folder: Folder }
  | { type: 'assign_folder'; chatPk: string; folderId: string | null }
  | { type: 'delete_folder'; folderId: string }
  | {
      type: 'search_chats';
      query: string;
      platform?: Platform;
      account?: string;
      limit?: number;
    }
  | { type: 'list_folders'; platform: Platform; account: string }
  // side panel → content script (targeted tabs.sendMessage). fetches full
  // conversation bodies from claude in the page's authed context.
  | { type: 'fetch_conversations'; orgId: string; chatIds: string[] };

// per-chat result of a fetch_conversations request
export interface FetchedConversation {
  chatId: string;
  messages: Message[];
  error?: string;
}

// L2 → L1
export type RuntimeResponse =
  | { type: 'pong'; at: number }
  | { type: 'upsert_chats_ok'; count: number }
  | { type: 'upsert_folder_ok'; folder: Folder }
  | { type: 'assign_folder_ok' }
  | { type: 'delete_folder_ok' }
  | { type: 'search_chats_ok'; hits: SearchHit[]; titlesOnly: true }
  | { type: 'list_folders_ok'; folders: Folder[] }
  | { type: 'fetch_conversations_ok'; results: FetchedConversation[] };
