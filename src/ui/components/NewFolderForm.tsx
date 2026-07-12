import React, { useState } from 'react';
import type { Folder, Platform } from '@/src/core/types';
import type { RuntimeRequest } from '@/src/core/bus';
import { T } from '../theme';

interface Props {
  platform: Platform;
  account: string;
}

export function NewFolderForm({ platform, account }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    const folder: Folder = {
      id: `${platform}:${account}:${Date.now()}`,
      platform,
      account,
      name: trimmed,
    };

    await browser.runtime.sendMessage({
      type: 'upsert_folder',
      folder,
    } satisfies RuntimeRequest);

    setName('');
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '6px 14px',
          fontSize: 12,
          color: T.muted,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        + New folder
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{ padding: '6px 10px', display: 'flex', gap: 6 }}>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Folder name"
        style={{
          flex: 1,
          border: `1px solid ${T.borderStrong}`,
          borderRadius: 5,
          padding: '4px 8px',
          fontSize: 12,
          color: T.fg,
          outline: 'none',
        }}
      />
      <button
        type="submit"
        style={{
          fontSize: 12,
          padding: '4px 8px',
          borderRadius: 5,
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
        onClick={() => { setOpen(false); setName(''); }}
        style={{ fontSize: 12, padding: '4px 8px', borderRadius: 5, cursor: 'pointer', color: T.fg, background: 'none', border: `1px solid ${T.borderStrong}` }}
      >
        ✕
      </button>
    </form>
  );
}
