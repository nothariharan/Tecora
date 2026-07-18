import React, { useRef, useState } from 'react';
import type { Chat, Platform } from '@/src/core/types';
import { useExport } from '../ExportContext';
import { HelpButton } from './HelpButton';
import { IconExport } from './Icons';
import { T } from '../theme';
import { isPortableArchive } from '@/src/core/export';
import type { RuntimeRequest, RuntimeResponse } from '@/src/core/bus';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const headerButtonStyle = (disabled = false): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 11.5,
    fontWeight: 500,
    color: T.muted,
    background: 'transparent',
    border: `1px solid ${T.borderStrong}`,
    borderRadius: T.radius,
    padding: '3px 9px 3px 7px',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  });

  const liftButton = (e: React.MouseEvent<HTMLButtonElement>, disabled = false) => {
    if (disabled) return;
    e.currentTarget.style.background = T.hover;
    e.currentTarget.style.color = T.fg;
  };

  const resetButton = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'transparent';
    e.currentTarget.style.color = T.muted;
  };

  async function importArchiveFile(file: File) {
    setImporting(true);
    try {
      const raw = await file.text();
      const parsed: unknown = JSON.parse(raw);
      if (!isPortableArchive(parsed)) {
        window.alert('That file is not a valid Tecora portable archive.');
        return;
      }

      const res = (await browser.runtime.sendMessage({
        type: 'import_archive',
        archive: parsed,
      } satisfies RuntimeRequest)) as RuntimeResponse;

      if (res.type === 'import_archive_ok') {
        window.alert(
          `Imported ${res.chats} chat${res.chats === 1 ? '' : 's'}, ${res.messages} message${res.messages === 1 ? '' : 's'}, ${res.folders} folder${res.folders === 1 ? '' : 's'}, and ${res.tags} tag${res.tags === 1 ? '' : 's'}.`,
        );
      }
    } catch (err) {
      window.alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const importDisabled = busy || editMode || importing;
  const exportDisabled = busy || editMode;

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
          width: 22, height: 22, borderRadius: T.radius,
          background: T.fg, color: T.bg,
          fontWeight: 700, fontSize: 13, letterSpacing: '-0.5px',
        }}>
          T
        </span>
        <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.3px', color: T.fg }}>
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
                fontWeight: 500,
                color: editMode ? T.fg : T.muted,
                background: editMode ? T.hover : 'transparent',
                border: `1px solid ${editMode ? T.fg : T.borderStrong}`,
                borderRadius: T.radius,
                padding: '3px 9px',
                cursor: 'pointer',
              }}
            >
              {editMode ? 'Cancel' : 'Select'}
            </button>
            <button
              type="button"
              disabled={exportDisabled}
              onClick={() => exportChats(allChats, 'all-chats')}
              title="Export every chat as one markdown file"
              style={headerButtonStyle(exportDisabled)}
              onMouseEnter={(e) => liftButton(e, exportDisabled)}
              onMouseLeave={resetButton}
            >
              <IconExport size={13} />
              Export all
            </button>
            <button
              type="button"
              disabled={exportDisabled}
              onClick={() => exportChats(allChats, 'all-chats', false, 'archive')}
              title="Export every chat as a portable JSON archive"
              style={headerButtonStyle(exportDisabled)}
              onMouseEnter={(e) => liftButton(e, exportDisabled)}
              onMouseLeave={resetButton}
            >
              <IconExport size={13} />
              Archive
            </button>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            if (file) void importArchiveFile(file);
          }}
        />
        <button
          type="button"
          disabled={importDisabled}
          onClick={() => fileInputRef.current?.click()}
          title="Import a Tecora portable JSON archive"
          style={headerButtonStyle(importDisabled)}
          onMouseEnter={(e) => liftButton(e, importDisabled)}
          onMouseLeave={resetButton}
        >
          {importing ? 'Importing...' : 'Import'}
        </button>

        {platform && (
          <span style={{
            fontSize: 11,
            fontWeight: 500,
            color: T.pillFg,
            background: T.pillBg,
            border: `1px solid ${T.border}`,
            borderRadius: T.radius,
            padding: '3px 8px',
          }}>
            {PLATFORM_LABEL[platform]}
          </span>
        )}
      </span>
    </div>
  );
}
