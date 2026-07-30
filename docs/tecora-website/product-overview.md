# Product overview

## One line

Local-first browser extension that organizes AI chats across Claude, ChatGPT, and Gemini — folders, search, cleanup, and export. Nothing leaves the device.

## Short pitch (landing hero length)

Tecora sits on top of the AI chat apps you already use. It turns scattered histories into one private library you can search, tag, resume, export, and clean up — without another account or another cloud.

## Fuller description

Tecora is a Manifest V3 Chrome extension (WXT + React). It is **not** a chat client and **not** an AI wrapper. It does not call models. It captures chat metadata (and optionally message content) from `claude.ai`, `chatgpt.com`, and `gemini.google.com`, stores it in on-device IndexedDB, and gives you organization tools those sites don’t share with each other.

**Version today:** v0.1 — usable across all three platforms with a minimal black/white UI.

## What Tecora is

- A cross-platform **memory and organization layer** for AI chats
- A **local archive** with markdown, JSON, and ZIP export
- A **privacy-first** tool: no Tecora account, no Tecora backend, no sync server
- A **side panel + command palette** companion while you browse chat sites

## What Tecora is not

| Claim to avoid | Reality |
| --- | --- |
| “AI chat app” | Uses Claude / ChatGPT / Gemini; does not host chats |
| “AI wrapper / second Copilot” | No model API; no prompt routing |
| “Cloud sync for chats” | Everything stays in the browser’s IndexedDB |
| “Exact messages remaining” | Usage UI is local estimates unless real platform APIs are wired later |
| “Works on every site” | Only the three supported hosts today |

## Positioning statement

> Tecora is the local OS for your AI chat history.

Secondary line:

> Folders, search, bulk cleanup, and portable export — for Claude, ChatGPT, and Gemini. Everything stays on your device.

## Brand mark

- Name: **Tecora**
- Symbol: lowercase Greek **τ** (tau)
- Product surfaces already use τ in the toolbar icon and floating dock

## Platforms (shipping)

| Platform | Role in product story |
| --- | --- |
| Claude | Full list + messages + rich export assets |
| ChatGPT | Full list + messages + files/images on export |
| Gemini | List via scrape; messages when chat is open |

## Core promise (repeat everywhere)

1. **Cross-platform** — one place for three chat apps  
2. **Local-first** — no account, no backend  
3. **Useful organization** — folders, tags, pins, resume, search  
4. **Portable** — export / import when you need to leave or back up  

## Related docs

- [problem-and-audience.md](./problem-and-audience.md)
- [features.md](./features.md)
- [copy-and-messaging.md](./copy-and-messaging.md)
