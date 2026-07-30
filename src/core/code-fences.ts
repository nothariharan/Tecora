// shared fenced-code parsing. used by the search index, the code gallery, and
// export naming so we detect code the same way everywhere.

export interface CodeFence {
  language: string | null; // normalized lowercase tag, or null when unlabelled
  info: string; // full info string after the opening ```
  body: string; // code content, trailing whitespace trimmed
}

const FENCE_RE = /```([^\n`]*)\n([\s\S]*?)```/g;
const FILENAME_RE = /[A-Za-z0-9_.\-/]+\.[A-Za-z0-9]{1,8}/;

// pull every fenced block out of a markdown-ish string (assistant answers, etc.)
export function extractCodeFences(text: string): CodeFence[] {
  if (!text) return [];
  const fences: CodeFence[] = [];
  FENCE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FENCE_RE.exec(text)) !== null) {
    const info = (match[1] ?? '').trim();
    const body = (match[2] ?? '').replace(/\s+$/, '');
    if (!body.trim()) continue;
    const first = info.split(/\s+/)[0]?.toLowerCase() || '';
    fences.push({ language: first || null, info, body });
  }
  return fences;
}

export function hasCodeFence(text: string): boolean {
  FENCE_RE.lastIndex = 0;
  return FENCE_RE.test(text);
}

// distinct language tags present in a string, lowercased
export function codeLanguages(text: string): string[] {
  const set = new Set<string>();
  for (const fence of extractCodeFences(text)) {
    if (fence.language) set.add(fence.language);
  }
  return [...set];
}

// distinct language tags across many message texts
export function codeLanguagesFromTexts(texts: string[]): string[] {
  const set = new Set<string>();
  for (const text of texts) {
    for (const lang of codeLanguages(text)) set.add(lang);
  }
  return [...set];
}

// a filename hint sitting on the fence info line, e.g. ```ts title=utils.ts
export function filenameFromFenceInfo(info: string): string | null {
  const keyed = info.match(
    /(?:title|file|filename|name)\s*[:=]\s*["'`]?([^"'`\s]+)["'`]?/i,
  );
  if (keyed?.[1] && FILENAME_RE.test(keyed[1])) return keyed[1];
  const bare = info.match(FILENAME_RE);
  return bare ? bare[0] : null;
}

// a filename hint on the line just before a fence, e.g. **auth.py**, `utils.ts`,
// or "File: server.js" — the way people label code in chat
export function filenameFromContextLine(line: string): string | null {
  const cleaned = line.replace(/[`*_>#]/g, ' ').trim();
  if (!cleaned) return null;
  const keyed = cleaned.match(/(?:file|filename|path)\s*[:\-]?\s*([A-Za-z0-9_.\-/]+\.[A-Za-z0-9]{1,8})/i);
  if (keyed?.[1]) return keyed[1];
  const trailing = cleaned.match(/([A-Za-z0-9_.\-/]+\.[A-Za-z0-9]{1,8})\s*[:\-]?\s*$/);
  if (trailing?.[1]) return trailing[1];
  return null;
}
