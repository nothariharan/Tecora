// internal model every adapter normalizes into. three platforms, three json shapes,
// one Chat type — search + folders can treat them the same.

export type Platform = 'claude' | 'chatgpt' | 'gemini';

export interface Chat {
  // `${platform}:${account}:${chatId}` — stops folders bleeding across logins
  pk: string;
  platform: Platform;
  account: string;
  chatId: string;
  title: string;
  updatedAt: number;
  folderId?: string; // tecora metadata, not from the platform
  tagIds?: string[];  // local tags
  pinned?: boolean;   // local pin state
}

export interface Message {
  pk: string; // `${chatPk}:${index}`
  chatPk: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  ts: number;
}

export interface Folder {
  id: string;
  platform: Platform;
  account: string;
  name: string;
  parentId?: string; // one level deep in v1
}

export interface Tag {
  id: string;
  platform: Platform;
  account: string;
  name: string;
}

export interface ActivityLogEntry {
  id: string;
  at: number;
  action:
    | 'export_markdown'
    | 'export_archive'
    | 'import_archive'
    | 'set_pinned'
    | 'bulk_delete_started'
    | 'privacy_settings_updated'
    | 'wipe_all_data';
  detail: string;
}

export interface PrivacySettings {
  captureMessages: Record<Platform, boolean>;
}

// adapter self-test result. destructive stuff only runs on green.
export type HealthState =
  | { level: 'green' }
  | { level: 'degraded'; failing: string[] } // read-only ok, no archive/delete
  | { level: 'red'; reason: string }; // basically dead, show a notice
