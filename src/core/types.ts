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
  // platform-side project/gpt container this chat lives in, when known.
  // chatgpt hides these from the normal conversation list; claude has projects too.
  projectId?: string;
  projectTitle?: string;
  // distinct fenced-code languages seen in captured messages — drives code filters
  codeLangs?: string[];
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

// today panel: a single actionable line for a calendar day. auto rows come from
// background extraction and can be replaced wholesale per chat; manual rows are
// user-owned and never touched by extraction.
export interface TodayTask {
  id: string;
  date: string; // local calendar day, YYYY-MM-DD
  source: 'auto' | 'manual';
  text: string;
  done: boolean;
  createdAt: number;
  // auto-only provenance so the panel can show "from Claude · 2h ago"
  chatPk?: string;
  platform?: Platform;
  // `${chatPk}:${messageCountHash}` — lets extraction skip unchanged chats and
  // replace only its own rows for the day
  extractKey?: string;
  // how the auto row was produced, so the panel can be honest: nano summary vs
  // plain phrase matching
  extractSource?: 'summarizer' | 'extractive';
}

// one persistent scratchpad, keyed by the fixed id 'scratch'
export interface Note {
  id: string;
  text: string;
  updatedAt: number;
}

// cached recap for a past day so we never regenerate an unchanged one
export interface DayDigest {
  date: string; // YYYY-MM-DD
  summary: string;
  chatCount: number;
  tasksCompleted: number;
  source: 'summarizer' | 'extractive';
  hash: string;
}

export interface ActivityLogEntry {
  id: string;
  at: number;
  action:
    | 'export_markdown'
    | 'export_archive'
    | 'export_zip'
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
