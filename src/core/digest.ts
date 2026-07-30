// on-device chat digests. primary path is chrome's built-in Summarizer (gemini
// nano); when it's missing or still downloading we fall back to a dependency-free
// extractive recap. nothing ever leaves the device.

import type { Message } from './types';

export type DigestSource = 'summarizer' | 'extractive';

export interface DigestResult {
  text: string;
  source: DigestSource;
}

export type SummarizerAvailability =
  | 'unavailable'
  | 'downloadable'
  | 'downloading'
  | 'available';

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function roleName(role: Message['role']): string {
  if (role === 'user') return 'User';
  if (role === 'assistant') return 'Assistant';
  return 'System';
}

// a plain transcript the summarizer can read
function formatTranscript(messages: Message[]): string {
  return messages
    .filter((m) => m.text.trim())
    .map((m) => `${roleName(m.role)}: ${clean(m.text)}`)
    .join('\n\n');
}

// split a long chat into chunks that stay under nano's context window.
// ~6k chars ≈ well under the ~8k-token budget with headroom for the prompt.
export function chunkMessages(
  messages: Message[],
  maxChars = 6000,
  maxMsgs = 25,
): string[] {
  const usable = messages.filter((m) => m.text.trim());
  const chunks: string[] = [];
  let buf: Message[] = [];
  let size = 0;

  const flush = () => {
    if (buf.length > 0) chunks.push(formatTranscript(buf));
    buf = [];
    size = 0;
  };

  for (const m of usable) {
    const line = clean(m.text);
    if (buf.length >= maxMsgs || (size + line.length > maxChars && buf.length > 0)) flush();
    buf.push(m);
    size += line.length;
  }
  flush();
  return chunks.length > 0 ? chunks : [''];
}

// cache key that changes when the conversation grows
export function digestHash(messages: Message[]): string {
  const last = messages[messages.length - 1];
  return `${messages.length}:${last?.ts ?? 0}`;
}

// --- extractive fallback -------------------------------------------------

const STOPWORDS = new Set(
  ('the a an and or but if then else for to of in on at by with from as is are was were be been ' +
    'this that these those it its i you he she they we me my your our their can could would should ' +
    'will just so not no do does did have has had how what when where why which who whom about into ' +
    'up down out over under again more most some any all one two also very really okay ok yeah yes')
    .split(' '),
);

function sentences(text: string): string[] {
  return clean(text)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);
}

function wordFrequencies(text: string): Map<string, number> {
  const freq = new Map<string, number>();
  for (const raw of clean(text).toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || STOPWORDS.has(raw)) continue;
    freq.set(raw, (freq.get(raw) ?? 0) + 1);
  }
  return freq;
}

// score sentences by keyword weight + a small early-position bonus, keep the top
// few in their original order — a cheap, always-available recap.
export function extractiveDigest(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === 'user' && m.text.trim());
  const assistantText = messages
    .filter((m) => m.role === 'assistant')
    .map((m) => m.text)
    .join('\n');

  const freq = wordFrequencies(assistantText || messages.map((m) => m.text).join('\n'));
  const sents = sentences(assistantText);

  const scored = sents.map((sentence, i) => {
    const words = sentence.toLowerCase().split(/[^a-z0-9]+/);
    const weight = words.reduce((sum, w) => sum + (freq.get(w) ?? 0), 0);
    const positionBonus = 1 + Math.max(0, 3 - i) * 0.15;
    return { sentence, i, score: (weight / Math.sqrt(words.length || 1)) * positionBonus };
  });

  const top = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .sort((a, b) => a.i - b.i)
    .map((s) => `- ${s.sentence}`);

  const lines: string[] = [];
  if (firstUser) lines.push(`You asked: ${clean(firstUser.text).slice(0, 200)}`);
  if (top.length > 0) {
    lines.push('', 'Key points:', ...top);
  } else if (!firstUser) {
    lines.push('Not enough captured text to summarize yet.');
  }
  return lines.join('\n').trim();
}

// --- chrome summarizer (gemini nano) ------------------------------------

function summarizerApi(): any | null {
  const g = globalThis as unknown as {
    Summarizer?: unknown;
    ai?: { summarizer?: unknown };
  };
  if (g.Summarizer) return g.Summarizer;
  if (g.ai?.summarizer) return g.ai.summarizer;
  return null;
}

export async function summarizerAvailability(): Promise<SummarizerAvailability> {
  const api = summarizerApi();
  if (!api) return 'unavailable';
  try {
    if (typeof api.availability === 'function') {
      const state = await api.availability();
      if (state === 'available' || state === 'readily') return 'available';
      if (state === 'downloading') return 'downloading';
      if (state === 'downloadable' || state === 'after-download') return 'downloadable';
      return 'unavailable';
    }
    if (typeof api.capabilities === 'function') {
      const caps = await api.capabilities();
      if (caps?.available === 'readily') return 'available';
      if (caps?.available === 'after-download') return 'downloadable';
    }
  } catch {
    return 'unavailable';
  }
  return 'unavailable';
}

// summarize with nano, chunking long chats map-reduce style. onDownload fires
// with 0-1 progress while the model downloads on first use.
export async function summarizeWithNano(
  messages: Message[],
  onDownload?: (progress: number) => void,
): Promise<string> {
  const api = summarizerApi();
  if (!api) throw new Error('summarizer unavailable');

  const summarizer = await api.create({
    type: 'key-points',
    length: 'short',
    format: 'markdown',
    monitor(monitor: EventTarget) {
      monitor.addEventListener('downloadprogress', (e: Event) => {
        const evt = e as ProgressEvent;
        if (evt.total) onDownload?.(evt.loaded / evt.total);
        else onDownload?.(evt.loaded);
      });
    },
  });

  try {
    const chunks = chunkMessages(messages);
    if (chunks.length === 1) {
      return clean(await summarizer.summarize(chunks[0], { context: 'An AI chat conversation.' }));
    }
    const partials: string[] = [];
    for (const chunk of chunks) {
      partials.push(await summarizer.summarize(chunk, { context: 'One part of a longer AI chat.' }));
    }
    const combined = await summarizer.summarize(partials.join('\n'), {
      context: 'Merge these partial notes into one short recap of the whole chat.',
    });
    return clean(combined);
  } finally {
    summarizer.destroy?.();
  }
}

// one call the UI can await: try nano, fall back to extractive on any failure.
export async function buildDigest(
  messages: Message[],
  onDownload?: (progress: number) => void,
): Promise<DigestResult> {
  const availability = await summarizerAvailability();
  if (availability === 'available' || availability === 'downloadable' || availability === 'downloading') {
    try {
      const text = await summarizeWithNano(messages, onDownload);
      if (text.trim()) return { text, source: 'summarizer' };
    } catch {
      // fall through to extractive
    }
  }
  return { text: extractiveDigest(messages), source: 'extractive' };
}
