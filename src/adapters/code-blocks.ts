// read-only DOM scan of the OPEN chat's rendered code blocks. used by the palette
// outline to jump straight to a block. platform selectors live here next to the
// adapters so there's one place to fix when a site reshuffles its markup.

import type { Platform } from '@/src/core/types';

export interface CodeBlockRef {
  index: number;
  language: string | null;
  preview: string; // first non-empty line
  lineCount: number;
  el: HTMLElement;
}

const SELECTORS: Record<Platform, string> = {
  chatgpt: 'main pre',
  claude: 'pre',
  gemini: 'code-block, pre',
};

function languageFromEl(pre: HTMLElement): string | null {
  const code = pre.querySelector('code');
  const cls = `${code?.className ?? ''} ${pre.className}`;
  const m = cls.match(/language-([A-Za-z0-9+#._-]+)/);
  if (m?.[1]) return m[1].toLowerCase();
  // gemini shows the language in a small decoration bar above the block
  const deco = pre.closest('code-block')?.querySelector('.code-block-decoration');
  const label = deco?.textContent?.trim().toLowerCase();
  return label || null;
}

function firstLine(text: string): string {
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line) return line.slice(0, 80);
  }
  return '';
}

// every rendered code block in the open conversation, in document order
export function collectCodeBlocks(
  platform: Platform,
  root: ParentNode = document,
): CodeBlockRef[] {
  const nodes = Array.from(root.querySelectorAll(SELECTORS[platform])) as HTMLElement[];
  const seen = new Set<HTMLElement>();
  const blocks: CodeBlockRef[] = [];

  for (const el of nodes) {
    // avoid double-counting a <pre> nested inside a matched <code-block>
    if (seen.has(el)) continue;
    const codeEl = el.querySelector('code') ?? el;
    const text = codeEl.textContent ?? '';
    if (!text.trim()) continue;
    seen.add(el);
    blocks.push({
      index: blocks.length,
      language: languageFromEl(el),
      preview: firstLine(text),
      lineCount: text.replace(/\n$/, '').split('\n').length,
      el,
    });
  }

  return blocks;
}

// scroll a block into view and flash a brief outline so the eye can find it
export function revealCodeBlock(el: HTMLElement): void {
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const prev = el.style.outline;
  const prevOffset = el.style.outlineOffset;
  el.style.outline = '2px solid #22c55e';
  el.style.outlineOffset = '3px';
  window.setTimeout(() => {
    el.style.outline = prev;
    el.style.outlineOffset = prevOffset;
  }, 1600);
}
