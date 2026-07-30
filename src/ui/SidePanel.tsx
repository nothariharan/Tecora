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
import { CodeGallery } from './components/CodeGallery';
import { ResumeSection } from './components/ResumeSection';
import { PrivacyActivityPanel } from './components/PrivacyActivityPanel';
import { UsageAwarenessPanel } from './components/UsageAwarenessPanel';
import { useExporter } from './export-actions';
import { ExportProvider } from './ExportContext';
import { T } from './theme';
import type { BulkStatus } from '@/src/core/bus';
import { sortMemoryChats } from '@/src/core/memory';
import { useChatPresentations } from './hooks/useChatPresentations';
import { useUsageAwareness } from './hooks/useUsageAwareness';
import { useLiveUsage } from './hooks/useLiveUsage';

type ScopeMode = 'active' | 'all';

export function SidePanel() {
  const active = useActivePlatform();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [scopeMode, setScopeMode] = useState<ScopeMode>('active');
  const [codeOnly, setCodeOnly] = useState(false);
  const [codeLang, setCodeLang] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [selectedChatPks, setSelectedChatPks] = useState<Set<string>>(new Set());
  const [bulkQueue, setBulkQueue] = useState<BulkStatus | null>(null);

  const platform = active?.platform ?? null;
  const account = active?.account ?? null;
  const scopedPlatform = scopeMode === 'active' ? platform : null;
  const scopedAccount = scopeMode === 'active' ? account : null;

  const allChats = sortMemoryChats(useChats(scopedPlatform, scopedAccount, null, null, ''));
  const presentations = useChatPresentations(allChats);
  const usageEstimates = useUsageAwareness(allChats);
  const liveUsage = useLiveUsage(platform);

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
    if (codeOnly) {
      list = list.filter((c) => (c.codeLangs?.length ?? 0) > 0);
    }
    if (codeLang) {
      list = list.filter((c) => c.codeLangs?.includes(codeLang));
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((c) => {
        const presentation = presentations[c.pk];
        return (
          c.title.toLowerCase().includes(q) ||
          presentation?.title.toLowerCase().includes(q) ||
          presentation?.preview?.toLowerCase().includes(q)
        );
      });
    }
    return sortMemoryChats(list);
  }, [allChats, selectedFolderId, selectedTagId, query, presentations, codeOnly, codeLang]);

  const langPool = useMemo(() => {
    const pool = new Set<string>();
    for (const c of allChats) for (const l of c.codeLangs ?? []) pool.add(l);
    return [...pool].sort();
  }, [allChats]);

  const folders = useFolders(scopedPlatform, scopedAccount);
  const tags = useTags(scopedPlatform, scopedAccount);

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

  const switchScope = (next: ScopeMode) => {
    setScopeMode(next);
    setSelectedFolderId(null);
    setSelectedTagId(null);
    setSelectedChatPks(new Set());
    setEditMode(false);
  };

  const exportSelected = () => {
    const selectedChats = filteredChats.filter((c) => selectedChatPks.has(c.pk));
    exportChats(selectedChats, 'selected-chats');
    setEditMode(false);
    setSelectedChatPks(new Set());
  };

  const archiveSelected = () => {
    const selectedChats = filteredChats.filter((c) => selectedChatPks.has(c.pk));
    exportChats(selectedChats, 'selected-chats', false, 'archive');
    setEditMode(false);
    setSelectedChatPks(new Set());
  };

  const zipSelected = () => {
    const selectedChats = filteredChats.filter((c) => selectedChatPks.has(c.pk));
    exportChats(selectedChats, 'selected-chats', false, 'zip');
    setEditMode(false);
    setSelectedChatPks(new Set());
  };

  const deleteSelected = async () => {
    const count = selectedChatPks.size;
    if (count === 0) return;
    const confirmMessage = `Delete ${count} selected chats permanently?\n\nThis removes them on the platform (Claude / ChatGPT / Gemini) and from Tecora. Keep that site's tab open. Cannot be undone.`;
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
    fontWeight: 500,
    background: 'transparent',
    border: `1px solid ${T.borderStrong}`,
    borderRadius: T.radius,
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
    border: `1px solid ${T.borderStrong}`,
  };

  return (
    <ExportProvider value={{ busy, exportChats }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: 13,
        color: T.fg,
        background: T.bg,
      }}>
        <Header platform={platform} allChats={allChats} editMode={editMode} setEditMode={setEditMode} />

        {/* one scroll plane so folders + chats aren't trapped above a zero-height flex child */}
        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}>
          <HealthBanner
            hasData={allChats.length > 0}
            hasActiveAccount={Boolean(platform && account)}
          />
          <PrivacyActivityPanel />

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
                <div style={{ color: T.fg, fontSize: 11, marginTop: 4 }}>
                  Queue paused — open the matching platform tab (Claude / ChatGPT / Gemini). It resumes automatically.
                </div>
              )}
            </div>
          )}

          {(busy || error) && (
            <div style={{
              padding: '6px 14px',
              fontSize: 12,
              borderBottom: `1px solid ${T.border}`,
              color: error ? T.fg : T.muted,
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

          {langPool.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
              padding: '8px 12px',
              borderBottom: `1px solid ${T.border}`,
            }}>
              <button
                type="button"
                onClick={() => {
                  setCodeOnly((v) => !v);
                  setCodeLang(null);
                }}
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: codeOnly ? T.bg : T.muted,
                  background: codeOnly ? T.fg : 'transparent',
                  border: `1px solid ${codeOnly ? T.fg : T.borderStrong}`,
                  borderRadius: T.radius,
                  padding: '3px 8px',
                  cursor: 'pointer',
                  fontFamily: 'ui-monospace, monospace',
                }}
              >
                {'</>'} Code only
              </button>
              {codeOnly &&
                langPool.map((lang) => {
                  const on = codeLang === lang;
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setCodeLang((v) => (v === lang ? null : lang))}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: on ? T.bg : T.muted,
                        background: on ? T.fg : 'transparent',
                        border: `1px solid ${on ? T.fg : T.borderStrong}`,
                        borderRadius: T.radius,
                        padding: '3px 8px',
                        cursor: 'pointer',
                      }}
                    >
                      {lang}
                    </button>
                  );
                })}
            </div>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderBottom: `1px solid ${T.border}`,
            gap: 8,
            flexWrap: 'wrap',
          }}>
            <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['active', 'all'] as ScopeMode[]).map((mode) => {
                const activeMode = scopeMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => switchScope(mode)}
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: activeMode ? T.bg : T.muted,
                      background: activeMode ? T.fg : 'transparent',
                      border: `1px solid ${activeMode ? T.fg : T.borderStrong}`,
                      borderRadius: T.radius,
                      padding: '3px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    {mode === 'active' ? 'Current account' : 'All platforms'}
                  </button>
                );
              })}
            </span>
            <span style={{ fontSize: 11, color: T.faint }}>
              {filteredChats.length} chat{filteredChats.length === 1 ? '' : 's'}
            </span>
          </div>

          {!editMode && !query.trim() && (
            <UsageAwarenessPanel estimates={usageEstimates} live={liveUsage} />
          )}

          {!editMode && !query.trim() && selectedFolderId === null && selectedTagId === null && (
            <ResumeSection
              chats={allChats.slice(0, 3)}
              presentations={presentations}
            />
          )}

          {editMode && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: T.noticeBg,
              borderBottom: `1px solid ${T.border}`,
              gap: 8,
              flexWrap: 'wrap',
            }}>
              <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={selectAll} style={btnStyle}>Select all</button>
                <button onClick={clearSelection} style={btnStyle}>Clear</button>
              </span>
              <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={exportSelected} disabled={selectedChatPks.size === 0} style={actionBtnStyle}>Export ({selectedChatPks.size})</button>
                <button onClick={archiveSelected} disabled={selectedChatPks.size === 0} style={actionBtnStyle}>Archive ({selectedChatPks.size})</button>
                <button onClick={zipSelected} disabled={selectedChatPks.size === 0} style={actionBtnStyle}>ZIP ({selectedChatPks.size})</button>
                <button onClick={deleteSelected} disabled={selectedChatPks.size === 0} style={dangerBtnStyle}>Delete ({selectedChatPks.size})</button>
              </span>
            </div>
          )}

          {!editMode && scopedPlatform && scopedAccount && (
            <>
              <FolderList
                folders={folders}
                allChats={allChats}
                selectedFolderId={selectedFolderId}
                onSelect={(fid) => {
                  setSelectedFolderId(fid);
                  setSelectedTagId(null);
                }}
                platform={scopedPlatform}
                account={scopedAccount}
              />
              <TagList
                tags={tags}
                allChats={allChats}
                selectedTagId={selectedTagId}
                onSelect={(tid) => {
                  setSelectedTagId(tid);
                  setSelectedFolderId(null);
                }}
                platform={scopedPlatform}
                account={scopedAccount}
              />
            </>
          )}

          {codeOnly && !editMode ? (
            <CodeGallery chats={filteredChats} language={codeLang} query={query} />
          ) : (
            <ChatList
              chats={filteredChats}
              folders={folders}
              tags={tags}
              presentations={presentations}
              editMode={editMode}
              selectedChatPks={selectedChatPks}
              onToggleSelectChat={toggleSelectChat}
            />
          )}
        </div>
      </div>
    </ExportProvider>
  );
}
