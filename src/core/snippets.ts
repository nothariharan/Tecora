// dev prompt snippets + copy-with-context helpers. snippets live in storage.local
// so they sync with nothing and never leave the device. the same comment-header
// helper is reused wherever we copy a code block out of a chat.

import type { Platform } from './types';

export interface Snippet {
  id: string;
  title: string;
  body: string;
}

const STORAGE_KEY = 'tecora_snippets';

// shipped starter pack — users can edit/extend later
export const STARTER_SNIPPETS: Snippet[] = [
  {
    id: 'explain-error',
    title: 'Explain this error',
    body: 'Explain this error in plain terms, what likely caused it, and the smallest fix:\n\n',
  },
  {
    id: 'write-tests',
    title: 'Write tests',
    body: 'Write focused unit tests for the following code. Cover the happy path and the important edge cases:\n\n',
  },
  {
    id: 'security-review',
    title: 'Security review this diff',
    body: 'Review this diff for security issues (injection, authz, secrets, unsafe deserialization). List concrete risks and fixes:\n\n',
  },
  {
    id: 'refactor',
    title: 'Refactor for readability',
    body: 'Refactor this code for readability without changing behavior. Explain each change briefly:\n\n',
  },
  {
    id: 'explain-code',
    title: 'Explain this code',
    body: 'Walk through what this code does step by step, and call out anything surprising:\n\n',
  },
];

export async function loadSnippets(): Promise<Snippet[]> {
  try {
    const data = await browser.storage.local.get(STORAGE_KEY);
    const stored = data[STORAGE_KEY];
    if (Array.isArray(stored) && stored.length > 0) return stored as Snippet[];
  } catch {
    // fall through to starters
  }
  return STARTER_SNIPPETS;
}

export async function saveSnippets(snippets: Snippet[]): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: snippets });
}

const HASH_COMMENT = new Set(['py', 'python', 'rb', 'ruby', 'sh', 'bash', 'shell', 'yml', 'yaml', 'r', 'pl']);
const DASH_COMMENT = new Set(['sql', 'lua', 'hs', 'haskell']);

// best-effort single-line comment token for a language tag
export function commentToken(language: string | null | undefined): string {
  if (!language) return '//';
  const lang = language.toLowerCase();
  if (HASH_COMMENT.has(lang)) return '#';
  if (DASH_COMMENT.has(lang)) return '--';
  return '//';
}

const PLATFORM_LABEL: Record<Platform, string> = {
  claude: 'claude',
  chatgpt: 'chatgpt',
  gemini: 'gemini',
};

// prepend a provenance header so a pasted snippet remembers where it came from
export function codeWithContext(opts: {
  body: string;
  platform: Platform;
  language?: string | null;
  question?: string | null;
  at?: number;
}): string {
  const token = commentToken(opts.language);
  const date = new Date(opts.at ?? Date.now()).toISOString().slice(0, 10);
  const question = opts.question ? ` · ${opts.question.replace(/\s+/g, ' ').trim().slice(0, 80)}` : '';
  const header = `${token} tecora: ${PLATFORM_LABEL[opts.platform]} · ${date}${question}`;
  return `${header}\n${opts.body.replace(/\s+$/, '')}\n`;
}
