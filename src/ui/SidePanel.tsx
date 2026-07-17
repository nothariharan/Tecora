import React, { useState, useEffect, useMemo } from 'react';
import { useActivePlatform } from './hooks/useActivePlatform';
import { useChats } from './hooks/useChats';
import { useFolders } from './hooks/useFolders';
import { useTags } from './hooks/useTags';
import { Header } from './components/Header';
import { HealthBanner } from './components/HealthBanner';
import { SearchBar } from './components/SearchBar';
import { FolderList } from './components/FolderList';
import { TagList } from './components/TagList';
import { ChatList } from './components/ChatList';
import { useExporter } from './export-actions';
import { ExportProvider } from './ExportContext';
import { T } from './theme';
import type { BulkStatus } from '@/src/core/bus';

export function SidePanel() {
  const active = useActivePlatform();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const [editMode, setEditMode] = useState(false);
  const [selectedChatPks, setSelectedChatPks] = useState<Set<string>>(new Set());
  const [bulkQueue, setBulkQueue] = useState<BulkStatus | null>(null);

  const platform = active?.platform ?? null;
  const account = active?.account ?? null;

  const allChats = useChats(platform, account, null, null, '');

  const filteredChats = useMemo(() => {
    let list = allChats;
    if (selectedFolderId === '') {
      list = list.filter((c) => !c.folderId);
    } else if (selectedFolderId !== null) {
      list = list.filter((c) => c.folderId === selectedFolderId);
    }
    if (selectedTagId !== null) {
      list = list.filter((c) => c.tagIds && c.tagIds.includes(selectedTagId));
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((c) => c.title.toLowerCase().includes(q));
    }
    return list;
  }, [allChats, selectedFolderId, selectedTagId, query]);

  const folders = useFolders(platform, account);
  const tags = useTags(platform, account);

  const { busy, progress, error, exportChats } = useExporter();

  useEffect(() => {
    // Initial fetch of bulk status
    browser.runtime.sendMessage({ type: 'get_bulk_status' }).then((res: any) => {
      if (res && res.type === 'get_bulk_status_ok') {
        setBulkQueue(res.status);
      }
    });

    const listener = (changes: any, area: string) => {
      if (area === 'local' && changes['tecora_bulk_queue']) {
        setBulkQueue(changes['tecora_bulk_queue'].newValue);
      }
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);

  const toggleSelectChat = (chatPk: string) => {
    setSelectedChatPks((prev) => {
      const next = new Set(prev);
      if (next.has(chatPk)) {
        next.delete(chatPk);
      } else {
        next.add(chatPk);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedChatPks(new Set(filteredChats.map((c) => c.pk)));
  };

  const clearSelection = () => {
    setSelectedChatPks(new Set());
  };

  const exportSelected = () => {
    const selectedChats = filteredChats.filter((c) => selectedChatPks.has(c.pk));
    exportChats(selectedChats, 'selected-chats');
    setEditMode(false);
    setSelectedChatPks(new Set());
  };

  const deleteSelected = async () => {
    const count = selectedChatPks.size;
    if (count === 0) return;
    const confirmMessage = `Are you sure you want to permanently delete the ${count} selected chats?\n\nThis will programmatically drive each deletion modal and CANNOT be undone.`;
    if (window.confirm(confirmMessage)) {
      const pks = Array.from(selectedChatPks);
      setEditMode(false);
      setSelectedChatPks(new Set());
      await browser.runtime.sendMessage({
        type: 'start_bulk_delete',
        chatPks: pks,
      });
    }
  };

  const btnStyle: React.CSSProperties = {
    fontSize: 11.5,
    fontWeight: 550,
    background: 'transparent',
    border: `1px solid ${T.borderStrong}`,
    borderRadius: 5,
    padding: '3px 8px',
    cursor: 'pointer',
    color: T.muted,
  };

  const actionBtnStyle: React.CSSProperties = {
    ...btnStyle,
    background: T.fg,
    color: T.bg,
    border: `1px solid ${T.fg}`,
  };

  const dangerBtnStyle: React.CSSProperties = {
    ...btnStyle,
    background: T.dangerBg,
    color: T.danger,
    border: `1px solid ${T.danger}`,
  };

  return (
    <ExportProvider value={{ busy, exportChats }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: 13,
        color: T.fg,
        background: T.bg,
      }}>
        <Header platform={platform} allChats={allChats} editMode={editMode} setEditMode={setEditMode} />
        <HealthBanner
          hasData={allChats.length > 0}
          hasActiveAccount={Boolean(platform && account)}
        />

        {bulkQueue && bulkQueue.active && (
          <div style={{
            padding: '10px 14px',
            background: T.noticeBg,
            borderBottom: `1px solid ${T.border}`,
            color: T.fg,
          }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>
              {bulkQueue.status === 'running' ? 'Executing bulk delete...' : `Bulk delete ${bulkQueue.status}`}
            </div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>
              Progress: {bulkQueue.currentIdx} / {bulkQueue.chatPks.length} completed.
              {bulkQueue.errors > 0 && ` (${bulkQueue.errors} consecutive errors)`}
            </div>
            {bulkQueue.status === 'paused' && (
              <div style={{ color: T.danger, fontSize: 11, marginTop: 4 }}>
                Queue paused. Please make sure the platform tab is open!
              </div>
            )}
          </div>
        )}

        {(busy || error) && (
          <div style={{
            padding: '6px 14px',
            fontSize: 12,
            borderBottom: `1px solid ${T.border}`,
            color: error ? T.danger : T.muted,
            background: T.noticeBg,
          }}>
            {error
              ? error
              : progress
                ? `Exporting ${progress.done}/${progress.total}…`
                : 'Exporting…'}
          </div>
        )}

        <SearchBar value={query} onChange={setQuery} />

        {editMode && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            background: T.noticeBg,
            borderBottom: `1px solid ${T.border}`,
          }}>
            <span style={{ display: 'flex', gap: 6 }}>
              <button onClick={selectAll} style={btnStyle}>Select all</button>
              <button onClick={clearSelection} style={btnStyle}>Clear</button>
            </span>
            <span style={{ display: 'flex', gap: 6 }}>
              <button onClick={exportSelected} disabled={selectedChatPks.size === 0} style={actionBtnStyle}>Export ({selectedChatPks.size})</button>
              <button onClick={deleteSelected} disabled={selectedChatPks.size === 0} style={dangerBtnStyle}>Delete ({selectedChatPks.size})</button>
            </span>
          </div>
        )}

        {!editMode && platform && account && (
          <>
            <FolderList
              folders={folders}
              allChats={allChats}
              selectedFolderId={selectedFolderId}
              onSelect={(fid) => {
                setSelectedFolderId(fid);
                setSelectedTagId(null);
              }}
              platform={platform}
              account={account}
            />
            <TagList
              tags={tags}
              allChats={allChats}
              selectedTagId={selectedTagId}
              onSelect={(tid) => {
                setSelectedTagId(tid);
                setSelectedFolderId(null);
              }}
              platform={platform}
              account={account}
            />
          </>
        )}

        <ChatList
          chats={filteredChats}
          folders={folders}
          tags={tags}
          editMode={editMode}
          selectedChatPks={selectedChatPks}
          onToggleSelectChat={toggleSelectChat}
        />
      </div>
    </ExportProvider>
  );
}
