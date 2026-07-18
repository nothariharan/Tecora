// Markdown export + a dependency-free browser download. Runs in the side panel
// (an extension page), so createObjectURL + a synthetic <a download> is enough:
// no `downloads` permission required.

import type { Chat, Message, Platform } from './types';

const PLATFORM_LABEL: Record<Platform, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
};

function roleLabel(role: Message['role'], platform: Platform): string {
  if (role === 'user') return 'You';
  if (role === 'assistant') return PLATFORM_LABEL[platform];
  return 'System';
}

function isoDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function chatMetadata(chat: Chat, messages: Message[]): string[] {
  return [
    '---',
    'tecora_export: 1',
    `platform: ${chat.platform}`,
    `account: ${yamlString(chat.account)}`,
    `chat_id: ${yamlString(chat.chatId)}`,
    `title: ${yamlString(chat.title)}`,
    `updated_at: ${yamlString(new Date(chat.updatedAt).toISOString())}`,
    `message_count: ${messages.length}`,
    '---',
    '',
  ];
}

// Filesystem-safe, lowercase, hyphenated. Falls back to `chat` when empty.
export function slugify(title: string): string {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s || 'chat';
}

// One conversation as markdown turns, with machine-readable metadata for future import.
export function chatToMarkdown(chat: Chat, messages: Message[]): string {
  const lines: string[] = [
    ...chatMetadata(chat, messages),
    `# ${chat.title}`,
    '',
    `> ${PLATFORM_LABEL[chat.platform]} · exported ${new Date().toISOString().slice(0, 10)}`,
    '',
  ];

  if (messages.length === 0) {
    lines.push('_No messages captured for this conversation._', '');
  }

  messages.forEach((m, i) => {
    lines.push(`**${roleLabel(m.role, chat.platform)}**`, '', m.text.trim() || '_(empty)_', '');
    if (i < messages.length - 1) lines.push('---', '');
  });

  return lines.join('\n');
}

export interface BulkEntry {
  chat: Chat;
  messages: Message[];
}

export interface PortableArchive {
  tecora_export: 1;
  export_type: 'portable_archive';
  exported_at: string;
  chat_count: number;
  message_count: number;
  chats: Array<{
    chat: Chat;
    messages: Message[];
  }>;
}

export function portableArchive(entries: BulkEntry[]): PortableArchive {
  return {
    tecora_export: 1,
    export_type: 'portable_archive',
    exported_at: new Date().toISOString(),
    chat_count: entries.length,
    message_count: entries.reduce((sum, entry) => sum + entry.messages.length, 0),
    chats: entries.map((entry) => ({
      chat: entry.chat,
      messages: entry.messages,
    })),
  };
}

// Many conversations into a single combined file, each chat a `##` section.
export function bulkToMarkdown(entries: BulkEntry[], heading: string): string {
  const out: string[] = [
    '---',
    'tecora_export: 1',
    'export_type: bulk_markdown',
    `title: ${yamlString(heading)}`,
    `chat_count: ${entries.length}`,
    `message_count: ${entries.reduce((sum, entry) => sum + entry.messages.length, 0)}`,
    `exported_at: ${yamlString(new Date().toISOString())}`,
    '---',
    '',
    `# ${heading}`,
    '',
    `> ${entries.length} chat${entries.length === 1 ? '' : 's'} · exported ${new Date()
      .toISOString()
      .slice(0, 10)}`,
    '',
    '---',
    '',
  ];

  entries.forEach((entry) => {
    out.push(`## ${entry.chat.title}`, '');
    out.push(
      `<!-- tecora: platform=${entry.chat.platform} account=${JSON.stringify(
        entry.chat.account,
      )} chat_id=${JSON.stringify(entry.chat.chatId)} messages=${entry.messages.length} -->`,
      '',
    );
    if (entry.messages.length === 0) {
      out.push('_No messages captured._', '');
    }
    entry.messages.forEach((m) => {
      out.push(`**${roleLabel(m.role, entry.chat.platform)}**`, '', m.text.trim() || '_(empty)_', '');
    });
    out.push('---', '');
  });

  return out.join('\n');
}

export function singleFilename(chat: Chat): string {
  return `${slugify(chat.title)}-${isoDate(chat.updatedAt)}.md`;
}

export function bulkFilename(label: string): string {
  return `tecora-${slugify(label)}-${isoDate(Date.now())}.md`;
}

export function archiveFilename(label: string): string {
  return `tecora-${slugify(label)}-${isoDate(Date.now())}.json`;
}

// Trigger a browser download of text content without any permission.
export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the click a tick to start before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJson(filename: string, value: unknown): void {
  const json = `${JSON.stringify(value, null, 2)}\n`;
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
