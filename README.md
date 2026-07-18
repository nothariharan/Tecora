# Tecora

folders, search, bulk cleanup and export for your ai chats — added on top of
Claude, ChatGPT and Gemini. local-first: nothing leaves your device, no backend.

it's a manifest v3 browser extension. not an ai wrapper, just a layer that makes
living in three chat apps less chaotic.

## where things stand

v0.1 — usable across all three platforms. ui is minimal black / white.

- extension scaffold (wxt + typescript + mv3)
- main-world fetch interceptor for claude + chatgpt chat lists and details
- gemini via dom scrape + open-chat message capture
- adapters normalize into a shared `Chat` / `Message` type
- dexie stores chats, messages, folders, tags (via the service worker)
- side panel — browse, folders, tags, select/export/bulk delete
- minisearch index (titles + captured message text)
- `ctrl/cmd+k` command palette on the page (shadow dom)
- remote selector config (baked + github fetch) for delete ui resilience

not done yet: archive/rename, store listing polish.

## stack

- [WXT](https://wxt.dev) — mv3 boilerplate, hot reload
- React — side panel + palette (shadow dom)
- Dexie.js — indexeddb, scoped per platform + account
- MiniSearch — on-device title + message index
- typescript

## architecture (quick version)

```
page (main world)     patches fetch/xhr, catches chat-list + detail json
       ↓ postMessage
content script        adapter normalizes, hosts ctrl+k palette, platform fetch
       ↓ runtime msg
service worker        dexie writes, folder/tag ops, search index, bulk queue
       ↓
indexeddb             chats + messages + folders + tags, all on-device
```

the service worker gets killed when idle (mv3 thing) — anything that needs to
survive a restart lives in storage, not in memory.

## develop

```bash
npm install
npm run dev
```

then in `chrome://extensions` → developer mode → load unpacked → pick
`.output/chrome-mv3`. open claude.ai / chatgpt.com / gemini.google.com (logged
in), click the toolbar icon for the side panel, or press `ctrl/cmd+k` on the
page for the palette.

```bash
npm run build     # production build
npm run compile   # typecheck only
npm test          # unit tests
```

optional chromium smoke (checks the unpacked build loads; does not log in):

```bash
node scripts/extension-smoke.mjs
```

## how to try the main flows

**chats load and persist**
1. load the extension, open a supported site
2. toolbar icon → side panel should list your chats
3. hard reload → chats still there
4. quit and reopen the browser → chats still there

**folders & tags**
1. `+ New folder` / `+ New tag` → name it → add
2. hover a chat → `⋯` → assign folder or toggle tags
3. click a folder/tag to filter

**search**
- side panel search bar filters by title
- on a platform page, `ctrl/cmd+k` opens the palette (titles + message text)
- ↑↓ to move, enter to open, esc to close

**export & bulk delete**
- export one chat from `⋯`, or Export all / Select → Export N
- Select → Delete N runs a safety-gated queue (platform tab must stay open)

## layout

```
entrypoints/
  injected.content.ts   main-world fetch/xhr patch
  content.tsx           isolated script + palette mount
  background.ts         service worker, db + search + bulk queue
  sidepanel/            react side panel

src/
  core/                 types, bus, dexie, search, export, chat urls
  adapters/             claude / chatgpt / gemini
  ui/                   side panel + palette (monochrome theme)

config/
  selectors.v1.json     delete-ui selectors (baked + remote)

scripts/
  extension-smoke.mjs   load unpacked build in chromium
```

## platforms

| platform | status |
| --- | --- |
| claude.ai | list, messages, folders/tags, search, export, delete |
| chatgpt.com | list (+ fallback), messages, folders/tags, search, export, delete |
| gemini.google.com | list via scrape, messages when chat open, folders/tags, search, export from stored msgs, delete |
