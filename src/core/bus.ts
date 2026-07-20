// All cross-world messages live here so nothing turns into random string checks.
//
//   L0 (page)  ->  L1 (content)     window.postMessage
//   L1         <-> L2 (background)  runtime.sendMessage

import type { ActivityLogEntry, Chat, Folder, Message, Platform, PrivacySettings, Tag } from './types';
import type { ChatAsset } from './assets';
import type { SearchHit } from './search';
import type { PortableArchive } from './export';

// Pages spam postMessage for all kinds of stuff; this key is how we filter ours.
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
    }
  | {
      kind: 'messages_intercepted';
      platform: Platform;
      account: string;
      chatId: string;
      raw: unknown;
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

export interface BulkStatus {
  active: boolean;
  chatPks: string[];
  currentIdx: number;
  errors: number;
  results: { chatPk: string; success: boolean; error?: string }[];
  status: 'idle' | 'running' | 'completed' | 'failed' | 'paused';
}

// L1 -> L2
export type RuntimeRequest =
  | { type: 'ping'; platform: string; at: number }
  // content script / side panel: pin the side panel to the focused site
  | { type: 'set_active_context'; platform: Platform; account: string; force?: boolean }
  // side panel: re-pin to a specific tab (or the focused one)
  | { type: 'sync_active_context'; tabId?: number }
  // side panel -> content script on the active tab
  | { type: 'get_page_context' }
  | { type: 'refresh_chats' }
  | { type: 'upsert_chats'; chats: Chat[] }
  | { type: 'upsert_messages'; chatPk: string; messages: Message[] }
  | { type: 'set_pinned'; chatPk: string; pinned: boolean }
  | { type: 'upsert_folder'; folder: Folder }
  | { type: 'assign_folder'; chatPk: string; folderId: string | null }
  | { type: 'delete_folder'; folderId: string }
  | { type: 'upsert_tag'; tag: Tag }
  | { type: 'assign_tags'; chatPk: string; tagIds: string[] }
  | { type: 'delete_tag'; tagId: string }
  | { type: 'list_tags'; platform: Platform; account: string }
  | {
      type: 'search_chats';
      query: string;
      platform?: Platform;
      account?: string;
      limit?: number;
    }
  | { type: 'list_folders'; platform: Platform; account: string }
  | { type: 'start_bulk_delete'; chatPks: string[] }
  | { type: 'get_bulk_status' }
  | { type: 'get_privacy_settings' }
  | { type: 'set_privacy_settings'; settings: PrivacySettings }
  | { type: 'log_activity'; action: ActivityLogEntry['action']; detail: string }
  | { type: 'list_activity'; limit?: number }
  | { type: 'wipe_all_data' }
  | { type: 'execute_delete'; chatPk: string }
  | { type: 'open_side_panel' }
  // side panel -> content script (targeted tabs.sendMessage). fetches full
  // conversation bodies in the page's authed context.
  | { type: 'fetch_conversations'; orgId: string; chatIds: string[] }
  | { type: 'get_stored_messages'; chatPks: string[] }
  | { type: 'import_archive'; archive: PortableArchive };

// per-chat result of a fetch_conversations request
export interface FetchedConversation {
  chatId: string;
  messages: Message[];
  assets?: ChatAsset[];
  error?: string;
}

// L2 -> L1
export type RuntimeResponse =
  | { type: 'pong'; at: number }
  | { type: 'set_active_context_ok' }
  | { type: 'sync_active_context_ok'; platform: Platform | null; account: string | null }
  | { type: 'get_page_context_ok'; platform: Platform; account: string }
  | { type: 'refresh_chats_ok'; count: number }
  | { type: 'upsert_chats_ok'; count: number }
  | { type: 'upsert_messages_ok' }
  | { type: 'set_pinned_ok' }
  | { type: 'upsert_folder_ok'; folder: Folder }
  | { type: 'assign_folder_ok' }
  | { type: 'delete_folder_ok' }
  | { type: 'upsert_tag_ok'; tag: Tag }
  | { type: 'assign_tags_ok' }
  | { type: 'delete_tag_ok' }
  | { type: 'list_tags_ok'; tags: Tag[] }
  | { type: 'search_chats_ok'; hits: SearchHit[]; titlesOnly: boolean }
  | { type: 'list_folders_ok'; folders: Folder[] }
  | { type: 'start_bulk_delete_ok' }
  | { type: 'get_bulk_status_ok'; status: BulkStatus }
  | { type: 'get_privacy_settings_ok'; settings: PrivacySettings }
  | { type: 'set_privacy_settings_ok'; settings: PrivacySettings }
  | { type: 'log_activity_ok' }
  | { type: 'list_activity_ok'; entries: ActivityLogEntry[] }
  | { type: 'wipe_all_data_ok' }
  | { type: 'execute_delete_ok' }
  | { type: 'execute_delete_error'; error: string }
  | { type: 'open_side_panel_ok' }
  | { type: 'open_side_panel_error'; error: string }
  | { type: 'fetch_conversations_ok'; results: FetchedConversation[] }
  | { type: 'get_stored_messages_ok'; byChatPk: Record<string, Message[]> }
  | { type: 'import_archive_ok'; chats: number; messages: number; folders: number; tags: number };
