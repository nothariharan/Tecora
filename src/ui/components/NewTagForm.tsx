import React, { useState } from 'react';
import type { Tag, Platform } from '@/src/core/types';
import type { RuntimeRequest } from '@/src/core/bus';
import { IconPlus, IconClose } from './Icons';
import { T } from '../theme';

interface Props {
  platform: Platform;
  account: string;
}

export function NewTagForm({ platform, account }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    const tag: Tag = {
      id: `${platform}:${account}:${Date.now()}`,
      platform,
      account,
      name: trimmed,
    };

    await browser.runtime.sendMessage({
      type: 'upsert_tag',
      tag,
    } satisfies RuntimeRequest);

    setName('');
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          width: 'calc(100% - 12px)',
          textAlign: 'left',
          margin: '3px 6px 1px',
          padding: '6px 10px',
          borderRadius: 7,
          fontSize: 13,
          fontWeight: 450,
          color: T.muted,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = T.hover; e.currentTarget.style.color = T.fg; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = T.muted; }}
      >
        <IconPlus size={15} style={{ color: 'currentColor' }} />
        <span>New tag</span>
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{ padding: '4px 8px', display: 'flex', gap: 6 }}>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tag name"
        style={{
          flex: 1,
          minWidth: 0,
          border: `1px solid ${T.borderStrong}`,
          borderRadius: 6,
          padding: '5px 9px',
          fontSize: 12.5,
          color: T.fg,
          outline: 'none',
        }}
      />
      <button
        type="submit"
        style={{
          fontSize: 12.5,
          fontWeight: 550,
          padding: '5px 12px',
          borderRadius: 6,
          cursor: 'pointer',
          background: T.fg,
          color: T.bg,
          border: `1px solid ${T.fg}`,
        }}
      >
        Add
      </button>
      <button
        type="button"
        aria-label="Cancel"
        onClick={() => { setOpen(false); setName(''); }}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 28, flexShrink: 0,
          borderRadius: 6, cursor: 'pointer', color: T.muted,
          background: 'none', border: `1px solid ${T.borderStrong}`,
        }}
      >
        <IconClose size={14} />
      </button>
    </form>
  );
}
