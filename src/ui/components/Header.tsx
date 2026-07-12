import React from 'react';
import type { Chat, Platform } from '@/src/core/types';
import { useExport } from '../ExportContext';
import { HelpButton } from './HelpButton';
import { T } from '../theme';

const PLATFORM_LABEL: Record<Platform, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
};

interface Props {
  platform: Platform | null;
  allChats: Chat[];
}

export function Header({ platform, allChats }: Props) {
  const { busy, exportChats } = useExport();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 14px 8px',
      borderBottom: `1px solid ${T.border}`,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px', color: T.fg }}>
          Tecora
        </span>
        <HelpButton />
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {allChats.length > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => exportChats(allChats, 'all-chats')}
            title="Export every chat as one markdown file"
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: T.fg,
              background: T.bg,
              border: `1px solid ${T.borderStrong}`,
              borderRadius: 4,
              padding: '2px 8px',
              cursor: busy ? 'default' : 'pointer',
              opacity: busy ? 0.5 : 1,
            }}
          >
            Export all
          </button>
        )}
        {platform && (
          <span style={{
            fontSize: 11,
            fontWeight: 500,
            color: T.muted,
            background: T.pillBg,
            borderRadius: 4,
            padding: '2px 6px',
          }}>
            {PLATFORM_LABEL[platform]}
          </span>
        )}
      </span>
    </div>
  );
}
