# Tecora

folders, search, bulk cleanup and export for your ai chats — added on top of
Claude, ChatGPT and Gemini. local-first: nothing leaves your device, no backend.

it's a manifest v3 browser extension. not an ai wrapper, just a layer that makes
living in three chat apps less chaotic.

## where things stand

early build. claude is the only platform wired up so far.

- extension scaffold (wxt + typescript + mv3)
- main-world fetch interceptor catches claude's chat list
- claude adapter normalizes conversations into a shared `Chat` type
- dexie stores chats + folders locally (via the service worker)
- side panel ui — browse chats, search by title, create folders, assign chats

not done yet: full-text search index, bulk archive/delete, export, chatgpt +
gemini adapters, remote selector config.

## stack

- [WXT](https://wxt.dev) — mv3 boilerplate, hot reload
- React — side panel ui (for now; shadow dom overlay comes later)
- Dexie.js — indexeddb, scoped per platform + account
- typescript

## architecture (quick version)

```
page (main world)     patches fetch, catches chat-list json
       ↓ postMessage
content script        adapter normalizes, sends to background
       ↓ runtime msg
service worker        writes to dexie, handles folder ops
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

load unpacked from `.output/chrome-mv3` in `chrome://extensions`, open claude.ai,
click the extension icon to open the side panel.

```bash
npm run build    # production build
npm run compile  # typecheck only
```

## layout

```
entrypoints/
  injected.content.ts   main-world fetch patch
  content.ts            isolated script, adapter routing
  background.ts         service worker, db writes
  sidepanel/            react ui

src/
  core/                 types, message bus, dexie schema
  adapters/             per-platform adapters (claude first)
  ui/                   side panel components + hooks
```

## platforms

| platform | status |
| --- | --- |
| claude.ai | reading chats, folders work |
| chatgpt.com | not yet |
| gemini.google.com | not yet |
