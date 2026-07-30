import React, { useState } from 'react';
import type { Chat, Message } from '@/src/core/types';
import type { RuntimeRequest, RuntimeResponse } from '@/src/core/bus';
import {
  buildDigest,
  digestHash,
  summarizerAvailability,
  type DigestResult,
} from '@/src/core/digest';
import { T } from '../theme';

type State = 'idle' | 'loading' | 'ready' | 'error';

interface CacheEntry {
  hash: string;
  text: string;
  source: DigestResult['source'];
}

const cacheKey = (pk: string) => `tecora_digest:${pk}`;

async function loadMessages(chatPk: string): Promise<Message[]> {
  const res = (await browser.runtime.sendMessage({
    type: 'get_stored_messages',
    chatPks: [chatPk],
  } satisfies RuntimeRequest)) as RuntimeResponse;
  if (res.type !== 'get_stored_messages_ok') return [];
  return res.byChatPk[chatPk] ?? [];
}

const sourceLabel: Record<DigestResult['source'], string> = {
  summarizer: 'on-device AI',
  extractive: 'quick recap',
};

export function DigestButton({ chat }: { chat: Chat }) {
  const [state, setState] = useState<State>('idle');
  const [result, setResult] = useState<DigestResult | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const run = async () => {
    setState('loading');
    setProgress(null);
    setNote(null);
    setOpen(true);
    try {
      const messages = await loadMessages(chat.pk);
      if (messages.length === 0) {
        setNote('No captured messages yet — open this chat once so Tecora can read it.');
        setState('error');
        return;
      }

      const hash = digestHash(messages);
      const cached = await browser.storage.local.get(cacheKey(chat.pk));
      const entry = cached[cacheKey(chat.pk)] as CacheEntry | undefined;
      if (entry && entry.hash === hash) {
        setResult({ text: entry.text, source: entry.source });
        setState('ready');
        return;
      }

      const availability = await summarizerAvailability();
      if (availability === 'downloadable' || availability === 'downloading') {
        setNote('Preparing the on-device model (first run only)…');
      } else if (availability === 'unavailable') {
        setNote('On-device AI not available here — using a quick local recap.');
      }

      const digest = await buildDigest(messages, (p) => setProgress(Math.round(p * 100)));
      setResult(digest);
      setState('ready');
      setNote(null);
      await browser.storage.local.set({
        [cacheKey(chat.pk)]: { hash, text: digest.text, source: digest.source } satisfies CacheEntry,
      });
    } catch (err) {
      setNote(String(err));
      setState('error');
    }
  };

  const linkBtn: React.CSSProperties = {
    fontSize: 10.5,
    fontWeight: 600,
    color: T.muted,
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
  };

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => (state === 'idle' ? void run() : setOpen((v) => !v))}
          style={linkBtn}
        >
          {state === 'loading'
            ? progress != null
              ? `Digesting… downloading model ${progress}%`
              : 'Digesting…'
            : state === 'ready'
              ? open
                ? 'Hide digest'
                : 'Show digest'
              : '✦ Digest'}
        </button>
        {state === 'ready' && result && (
          <>
            <span style={{ fontSize: 9.5, color: T.faint }}>{sourceLabel[result.source]}</span>
            <button type="button" onClick={() => void run()} style={linkBtn}>
              regenerate
            </button>
          </>
        )}
      </div>

      {open && (note || result) && (
        <div
          style={{
            marginTop: 5,
            border: `1px solid ${T.border}`,
            borderRadius: T.radius,
            background: T.bg,
            padding: '7px 9px',
            fontSize: 11,
            color: T.muted,
            lineHeight: 1.45,
            whiteSpace: 'pre-wrap',
          }}
        >
          {state === 'error' && note}
          {state === 'loading' && (note ?? 'Reading captured messages…')}
          {state === 'ready' && result?.text}
        </div>
      )}
    </div>
  );
}
