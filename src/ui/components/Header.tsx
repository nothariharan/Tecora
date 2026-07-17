import React from 'react';
import type { Chat, Platform } from '@/src/core/types';
import { useExport } from '../ExportContext';
import { HelpButton } from './HelpButton';
import { IconExport } from './Icons';
import { T } from '../theme';

const PLATFORM_LABEL: Record<Platform, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
};

interface Props {
  platform: Platform | null;
  allChats: Chat[];
  editMode: boolean;
  setEditMode: (v: boolean) => void;
}

export function Header({ platform, allChats, editMode, setEditMode }: Props) {
  const { busy, exportChats } = useExport();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '11px 12px',
      borderBottom: `1px solid ${T.border}`,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 22, height: 22, borderRadius: 6,
          background: T.fg, color: T.bg,
          fontWeight: 700, fontSize: 13, letterSpacing: '-0.5px',
        }}>
          T
        </span>
        <span style={{ fontWeight: 650, fontSize: 15, letterSpacing: '-0.3px', color: T.fg }}>
          Tecora
        </span>
        <HelpButton />
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {allChats.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setEditMode(!editMode)}
              style={{
                fontSize: 11.5,
                fontWeight: 550,
                color: editMode ? T.fg : T.muted,
                background: editMode ? T.hover : 'transparent',
                border: `1px solid ${editMode ? T.fg : T.borderStrong}`,
                borderRadius: 6,
                padding: '3px 9px',
                cursor: 'pointer',
              }}
            >
              {editMode ? 'Cancel' : 'Select'}
            </button>
            <button
              type="button"
              disabled={busy || editMode}
              onClick={() => exportChats(allChats, 'all-chats')}
              title="Export every chat as one markdown file"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 11.5,
                fontWeight: 550,
                color: T.muted,
                background: 'transparent',
                border: `1px solid ${T.borderStrong}`,
                borderRadius: 6,
                padding: '3px 9px 3px 7px',
                cursor: busy || editMode ? 'default' : 'pointer',
                opacity: busy || editMode ? 0.5 : 1,
              }}
              onMouseEnter={(e) => { if (!busy && !editMode) { e.currentTarget.style.background = T.hover; e.currentTarget.style.color = T.fg; } }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.muted; }}
            >
              <IconExport size={13} />
              Export all
            </button>
          </>
        )}
        {platform && (
          <span style={{
            fontSize: 11,
            fontWeight: 550,
            color: T.pillFg,
            background: T.pillBg,
            borderRadius: 6,
            padding: '3px 8px',
          }}>
            {PLATFORM_LABEL[platform]}
          </span>
        )}
      </span>
    </div>
  );
}
