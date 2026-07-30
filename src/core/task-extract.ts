// pulls explicit next-steps out of a captured chat, on-device only. primary path
// is chrome's Summarizer (gemini nano) constrained to real action items; when it's
// missing we fall back to a phrase-matching heuristic and label it honestly.

import type { Message } from './types';
import { chunkMessages } from './digest';

export type TaskSource = 'summarizer' | 'extractive';

export interface ExtractedTasks {
  lines: string[];
  source: TaskSource;
}

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// changes whenever the conversation grows — drives per-chat extract caching
export function messageHash(messages: Message[]): string {
  const last = messages[messages.length - 1];
  return `${messages.length}:${last?.ts ?? 0}`;
}

export function extractKeyFor(chatPk: string, messages: Message[]): string {
  return `${chatPk}:${messageHash(messages)}`;
}

// tidy a candidate line into a short checklist item, or null if it's not useful
function toTaskLine(raw: string): string | null {
  let line = clean(raw)
    .replace(/^[-*•\d.)\s]+/, '')
    .replace(/^(?:so|and|then|also|next)[,\s]+/i, '')
    .trim();
  if (line.length < 6) return null;
  if (line.length > 140) line = `${line.slice(0, 137).trimEnd()}…`;
  return line;
}

function dedupe(lines: string[], limit = 6): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= limit) break;
  }
  return out;
}

// phrases that usually mark a concrete next step. intentionally conservative — we
// label these "detected phrases", not AI-understood intent.
const ACTION_RE =
  /\b(?:i'?ll|i will|next step|to-?do|need to|needs to|have to|still have to|make sure to|don'?t forget to|remember to|you should|we should|let'?s|going to|plan to)\b/i;

// noise we don't want as tasks even if they match
const SKIP_RE = /\b(?:i'?ll try to explain|i'?ll help|let'?s see|let'?s start|let'?s go)\b/i;

export function heuristicTasks(messages: Message[]): string[] {
  const candidates: string[] = [];
  for (const m of messages) {
    if (!m.text.trim()) continue;
    // split on sentence + newline boundaries so bullet lists survive
    const parts = clean(m.text).split(/(?<=[.!?])\s+|\n+/);
    for (const part of parts) {
      if (!ACTION_RE.test(part) || SKIP_RE.test(part)) continue;
      const line = toTaskLine(part);
      if (line) candidates.push(line);
    }
  }
  return dedupe(candidates);
}

// --- summarizer path -----------------------------------------------------

function summarizerApi(): any | null {
  const g = globalThis as unknown as {
    Summarizer?: unknown;
    ai?: { summarizer?: unknown };
  };
  if (g.Summarizer) return g.Summarizer;
  if (g.ai?.summarizer) return g.ai.summarizer;
  return null;
}

async function summarizerAvailable(api: any): Promise<boolean> {
  try {
    if (typeof api.availability === 'function') {
      const state = await api.availability();
      return state === 'available' || state === 'readily' || state === 'downloadable' || state === 'downloading';
    }
    if (typeof api.capabilities === 'function') {
      const caps = await api.capabilities();
      return caps?.available === 'readily' || caps?.available === 'after-download';
    }
  } catch {
    return false;
  }
  return false;
}

const TASK_CONTEXT =
  'From this AI chat, list ONLY the explicit action items or next steps the user ' +
  'said they would do or was told to do. One short imperative line each. Do not ' +
  'infer or invent tasks. If there are none, output nothing.';

function linesFromSummary(text: string): string[] {
  return dedupe(
    text
      .split(/\n+/)
      .map((l) => toTaskLine(l))
      .filter((l): l is string => Boolean(l)),
  );
}

async function summarizeTasks(messages: Message[]): Promise<string[]> {
  const api = summarizerApi();
  if (!api || !(await summarizerAvailable(api))) throw new Error('summarizer unavailable');

  const summarizer = await api.create({
    type: 'key-points',
    length: 'short',
    format: 'markdown',
  });
  try {
    const chunks = chunkMessages(messages);
    const partials: string[] = [];
    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      partials.push(await summarizer.summarize(chunk, { context: TASK_CONTEXT }));
    }
    const merged =
      partials.length > 1
        ? await summarizer.summarize(partials.join('\n'), {
            context: 'Merge into one short list of explicit action items only.',
          })
        : partials[0] ?? '';
    return linesFromSummary(clean(merged) ? merged : '');
  } finally {
    summarizer.destroy?.();
  }
}

// one call the caller awaits: try nano, fall back to phrase matching. returns an
// empty list when nothing actionable was found (caller writes no auto rows).
export async function extractTasks(messages: Message[]): Promise<ExtractedTasks> {
  const usable = messages.filter((m) => m.text.trim());
  if (usable.length === 0) return { lines: [], source: 'extractive' };
  try {
    const lines = await summarizeTasks(usable);
    if (lines.length > 0) return { lines, source: 'summarizer' };
  } catch {
    // fall through
  }
  return { lines: heuristicTasks(usable), source: 'extractive' };
}
