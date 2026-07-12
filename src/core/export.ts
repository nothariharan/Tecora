// markdown export + a dependency-free browser download. runs in the side panel
// (an extension page), so createObjectURL + a synthetic <a download> is enough —
// no `downloads` permission required.

import type { Chat, Message, Platform } from './types';

const PLATFORM_LABEL: Record<Platform, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
};

function roleLabel(role: Message['role']): string {
  if (role === 'user') return 'You';
  if (role === 'assistant') return 'Claude';
  return 'System';
}

function isoDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

// filesystem-safe, lowercase, hyphenated. falls back to `chat` when empty.
export function slugify(title: string): string {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s || 'chat';
}

// one conversation as markdown turns.
export function chatToMarkdown(chat: Chat, messages: Message[]): string {
  const lines: string[] = [
    `# ${chat.title}`,
    '',
    `> ${PLATFORM_LABEL[chat.platform]} · exported ${new Date().toISOString().slice(0, 10)}`,
    '',
  ];

  if (messages.length === 0) {
    lines.push('_No messages captured for this conversation._', '');
  }

  messages.forEach((m, i) => {
    lines.push(`**${roleLabel(m.role)}**`, '', m.text.trim() || '_(empty)_', '');
    if (i < messages.length - 1) lines.push('---', '');
  });

  return lines.join('\n');
}

export interface BulkEntry {
  chat: Chat;
  messages: Message[];
}

// many conversations into a single combined file, each chat a `##` section.
export function bulkToMarkdown(entries: BulkEntry[], heading: string): string {
  const out: string[] = [
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
    if (entry.messages.length === 0) {
      out.push('_No messages captured._', '');
    }
    entry.messages.forEach((m) => {
      out.push(`**${roleLabel(m.role)}**`, '', m.text.trim() || '_(empty)_', '');
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

// trigger a browser download of text content without any permission.
export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // give the click a tick to start before revoking
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
