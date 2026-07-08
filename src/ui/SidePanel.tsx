import React, { useState } from 'react';
import { useActivePlatform } from './hooks/useActivePlatform';
import { useChats } from './hooks/useChats';
import { useFolders } from './hooks/useFolders';
import { Header } from './components/Header';
import { HealthBanner } from './components/HealthBanner';
import { SearchBar } from './components/SearchBar';
import { FolderList } from './components/FolderList';
import { ChatList } from './components/ChatList';

export function SidePanel() {
  const active = useActivePlatform();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const platform = active?.platform ?? null;
  const account = active?.account ?? null;

  const allChats = useChats(platform, account, null, '');
  const filteredChats = useChats(platform, account, selectedFolderId, query);
  const folders = useFolders(platform, account);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: 13,
      color: '#111827',
      background: '#fff',
    }}>
      <Header platform={platform} />
      <HealthBanner hasData={allChats.length > 0} />
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
  );
}
