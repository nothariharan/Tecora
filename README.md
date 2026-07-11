# Tecora

folders, search, bulk cleanup and export for your ai chats — added on top of
Claude, ChatGPT and Gemini. local-first: nothing leaves your device, no backend.

it's a manifest v3 browser extension. not an ai wrapper, just a layer that makes
living in three chat apps less chaotic.

## where things stand

m1 done, early m2/m3 in progress. claude is the only platform wired up so far.

- extension scaffold (wxt + typescript + mv3)
- main-world fetch interceptor catches claude's chat list
- claude adapter normalizes conversations into a shared `Chat` type
- dexie stores chats + folders locally (via the service worker)
- side panel ui — browse chats, filter by title, create folders, assign chats
- chats survive page reloads and browser restarts
- minisearch index in the background (titles for now)
- `ctrl/cmd+k` command palette on the page (shadow dom) — search + open chat

not done yet: message-content indexing, tags, bulk archive/delete, export,
chatgpt + gemini adapters, remote selector config.

## stack

- [WXT](https://wxt.dev) — mv3 boilerplate, hot reload
- React — side panel + palette (shadow dom)
- Dexie.js — indexeddb, scoped per platform + account
- MiniSearch — on-device title index
- typescript

## architecture (quick version)

```
page (main world)     patches fetch, catches chat-list json
       ↓ postMessage
content script        adapter normalizes, hosts ctrl+k palette
       ↓ runtime msg
service worker        dexie writes, folder ops, search index
       ↓
indexeddb             chats + folders, all on-device
```

the service worker gets killed when idle (mv3 thing) — anything that needs to
survive a restart lives in storage, not in memory.

## develop

```bash
npm install
npm run dev
```

then in `chrome://extensions` → developer mode → load unpacked → pick
`.output/chrome-mv3`. open claude.ai (logged in), click the toolbar icon for
the side panel, or press `ctrl/cmd+k` on the page for the palette.

```bash
npm run build     # production build
npm run compile   # typecheck only
npm test          # unit tests (adapter + search + bus)
```

optional chromium smoke (checks the unpacked build loads; does not log into claude):

```bash
node scripts/extension-smoke.mjs
```

## how to try the main flows

**chats load and persist**
1. load the extension, open claude.ai
2. toolbar icon → side panel should list your chats
3. hard reload (`ctrl+shift+r`) → chats still there
4. quit and reopen the browser → open the side panel → chats still there

**folders**
1. `+ New folder` → name it → add
2. hover a chat → `⋯` → move to folder
3. reload — assignment should stick
4. click a folder to filter; `✕` deletes the folder (chats go back to unassigned)

**search**
- side panel search bar filters by title
- on claude.ai, `ctrl/cmd+k` opens the palette (titles only for now)
- ↑↓ to move, enter to open, esc to close
- type `>` for command hints

## layout

```
entrypoints/
  injected.content.ts   main-world fetch patch
  content.tsx           isolated script + palette mount
  background.ts         service worker, db + search
  sidepanel/            react side panel

src/
  core/                 types, bus, dexie, search index
  adapters/             per-platform adapters (claude first)
  ui/                   side panel components + palette

scripts/
  extension-smoke.mjs   load unpacked build in chromium
```

## platforms

| platform | status |
| --- | --- |
| claude.ai | reading chats, folders, title search |
| chatgpt.com | not yet |
| gemini.google.com | not yet |
