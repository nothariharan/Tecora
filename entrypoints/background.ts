import { db } from '@/src/core/db';
import type { RuntimeRequest, RuntimeResponse } from '@/src/core/bus';

export default defineBackground(() => {
  // open side panel on toolbar click
  browser.action.onClicked.addListener((tab) => {
    if (tab.id) browser.sidePanel.open({ tabId: tab.id });
  });

  browser.runtime.onMessage.addListener(
    (message: RuntimeRequest, _sender, sendResponse): true => {
      handleMessage(message).then(sendResponse);
      return true; // keep port open for async response
    },
  );
});

async function handleMessage(msg: RuntimeRequest): Promise<RuntimeResponse> {
  switch (msg.type) {
    case 'ping':
      return { type: 'pong', at: Date.now() };

    case 'upsert_chats':
      await db.chats.bulkPut(msg.chats);
      await browser.storage.session.set({
        activePlatform: msg.chats[0]?.platform,
        activeAccount: msg.chats[0]?.account,
      });
      return { type: 'upsert_chats_ok', count: msg.chats.length };

    case 'upsert_folder':
      await db.folders.put(msg.folder);
      return { type: 'upsert_folder_ok', folder: msg.folder };

    case 'assign_folder':
      await db.chats.update(msg.chatPk, {
        folderId: msg.folderId ?? undefined,
      });
      return { type: 'assign_folder_ok' };

    case 'delete_folder':
      await db.transaction('rw', db.folders, db.chats, async () => {
        await db.folders.delete(msg.folderId);
        await db.chats
          .where('folderId')
          .equals(msg.folderId)
          .modify({ folderId: undefined });
      });
      return { type: 'delete_folder_ok' };
  }
}
