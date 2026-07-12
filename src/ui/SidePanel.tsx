import React, { useState } from 'react';
import { useActivePlatform } from './hooks/useActivePlatform';
import { useChats } from './hooks/useChats';
import { useFolders } from './hooks/useFolders';
import { Header } from './components/Header';
import { HealthBanner } from './components/HealthBanner';
import { SearchBar } from './components/SearchBar';
import { FolderList } from './components/FolderList';
import { ChatList } from './components/ChatList';
import { useExporter } from './export-actions';
import { ExportProvider } from './ExportContext';
import { T } from './theme';

export function SidePanel() {
  const active = useActivePlatform();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const platform = active?.platform ?? null;
  const account = active?.account ?? null;

  const allChats = useChats(platform, account, null, '');
  const filteredChats = useChats(platform, account, selectedFolderId, query);
  const folders = useFolders(platform, account);

  const { busy, progress, error, exportChats } = useExporter();

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
        <Header platform={platform} allChats={allChats} />
        <HealthBanner
          hasData={allChats.length > 0}
          hasActiveAccount={Boolean(platform && account)}
        />

        {(busy || error) && (
          <div style={{
            padding: '6px 14px',
            fontSize: 12,
            borderBottom: `1px solid ${T.border}`,
            color: error ? '#b91c1c' : T.muted,
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

        {platform && account && (
          <FolderList
            folders={folders}
            allChats={allChats}
            selectedFolderId={selectedFolderId}
            onSelect={setSelectedFolderId}
            platform={platform}
            account={account}
          />
        )}

        <ChatList chats={filteredChats} folders={folders} />
      </div>
    </ExportProvider>
  );
}
