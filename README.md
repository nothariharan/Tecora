# Tecora

Folders, search, bulk cleanup, portable archive import/export, and local-first organization for your AI chats on Claude, ChatGPT, and Gemini.

Tecora is a Manifest V3 browser extension. It is not an AI wrapper; it is a layer that makes living across multiple chat apps less chaotic. Nothing leaves your device and there is no backend.

## Where things stand

v0.1 - usable across all three platforms with a minimal black/white UI.

- Extension scaffold using WXT, TypeScript, and MV3.
- Main-world fetch interceptor for Claude and ChatGPT chat lists/details.
- Gemini support via DOM scrape plus open-chat message capture.
- Adapters normalize platform data into shared `Chat` / `Message` types.
- Dexie stores chats, messages, folders, and tags through the service worker.
- Side panel for browsing, folders, tags, select/export, archive import/export, and bulk delete.
- Memory layer with pinned chats, derived titles/previews, and a "continue where you left off" section.
- Portable archive export/import: JSON backups restore chats, messages, folders, and tags.
- Privacy and activity controls: per-platform message capture toggles, recent local activity, and wipe-all-data.
- MiniSearch index for titles plus captured message text.
- `ctrl/cmd+k` command palette on supported pages through a Shadow DOM overlay.
- Remote selector config for delete UI resilience.

Not done yet: platform-native archive/rename, store listing polish, and deeper personalization packs.

## Stack

- [WXT](https://wxt.dev) - MV3 boilerplate and hot reload.
- React - side panel and command palette.
- Dexie.js - IndexedDB storage scoped per platform/account.
- MiniSearch - on-device title and message search.
- TypeScript.

## Architecture

```text
page (main world)     patches fetch/xhr, catches chat-list + detail json
       -> postMessage
content script        adapter normalizes, hosts ctrl+k palette, platform fetch
       -> runtime msg
service worker        dexie writes, folder/tag ops, search index, bulk queue
       -> indexeddb
storage               chats + messages + folders + tags, all on-device
```

The service worker can be killed when idle because of MV3. Anything that needs to survive a restart lives in storage, not memory.

## Develop

```bash
npm install
npm run dev
```

Then open `chrome://extensions`, enable developer mode, load unpacked, and pick `.output/chrome-mv3`. Open `claude.ai`, `chatgpt.com`, or `gemini.google.com` while logged in. Click the toolbar icon for the side panel, or press `ctrl/cmd+k` on a supported page for the palette.

```bash
npm run build     # production build
npm run compile   # typecheck only
npm test          # unit tests
```

Optional Chromium smoke check:

```bash
node scripts/extension-smoke.mjs
```

## How to try the main flows

**Chats load and persist**

1. Load the extension and open a supported site.
2. Open the toolbar icon -> side panel; chats should appear.
3. Hard reload; chats should still be there.
4. Quit and reopen the browser; chats should still be there.

**Folders and tags**

1. Create a folder or tag.
2. Hover a chat, open its menu, then assign a folder or toggle tags.
3. Click a folder or tag to filter.

**Search**

- Side panel search filters by title.
- Switch to All platforms to search and resume across Claude, ChatGPT, and Gemini.
- On a platform page, `ctrl/cmd+k` opens the palette.
- Arrow keys move, Enter opens, Escape closes.

**Memory layer**

- The side panel shows a "Continue where you left off" section from the latest local chats.
- Generic titles such as "New chat" get local derived titles from captured messages.
- Chat rows show a one-line recall preview when message content has been captured.
- Pin important chats from the chat menu to keep them at the top.

**Privacy and activity**

- Expand Privacy & activity to toggle message-content capture per platform.
- Turning capture off removes stored message text for that platform and keeps future capture to titles/metadata.
- Recent local activity shows imports, exports, pins, privacy changes, and bulk delete starts.
- Wipe all Tecora data clears local chats, messages, folders, tags, activity log, settings, and queue state.

**Export, archive, import, and bulk delete**

- Export one chat from its menu, or use Export all / Select -> Export.
- Archive exports a portable `.json` backup.
- Import restores Tecora archive files, including chats, messages, folders, and tags.
- If messages have not been captured yet, export still downloads metadata and shows a warning.
- Bulk delete runs a safety-gated queue; the platform tab must stay open.

## Layout

```text
entrypoints/
  injected.content.ts   main-world fetch/xhr patch
  content.tsx           isolated script + palette mount
  background.ts         service worker, db + search + bulk queue
  sidepanel/            react side panel

src/
  core/                 types, bus, dexie, search, export, chat urls
  adapters/             claude / chatgpt / gemini
  ui/                   side panel + palette

config/
  selectors.v1.json     delete-ui selectors

scripts/
  extension-smoke.mjs   load unpacked build in Chromium
```

## Platforms

| platform | status |
| --- | --- |
| claude.ai | list, messages, folders/tags, search, export, archive, import, delete |
| chatgpt.com | list (+ fallback), messages, folders/tags, search, export, archive, import, delete |
| gemini.google.com | list via scrape, messages when chat open, folders/tags, search, export from stored messages, archive, import, delete |
