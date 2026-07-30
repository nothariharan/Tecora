# Features

Inventory of what Tecora ships in v0.1, written for landing-page feature sections and hackathon demos. Group features into narrative buckets; don’t dump every checkbox on the hero.

---

## Feature buckets (for the site)

1. Capture across platforms  
2. Organize & resume  
3. Search everywhere  
4. Export & backup  
5. Privacy & control  
6. Usage awareness (local)  
7. Surfaces (side panel, palette, τ dock)

---

## 1. Capture across platforms

| Feature | Detail | Landing note |
| --- | --- | --- |
| Claude capture | Chat list + messages via intercept / authed API / DOM fallback | “Reads while you browse” |
| ChatGPT capture | Same pattern; project chats still incomplete | Don’t claim Projects yet |
| Gemini capture | DOM scrape; messages when chat is open | Honest about scope |
| Shared model | Normalizes to `Chat` / `Message` | One library, three sources |
| No manual import for lists | Opens a logged-in tab and captures | “No CSV upload to start” |

**Illustration idea:** three platform glyphs flowing into one τ library.

---

## 2. Organize & resume

| Feature | Detail |
| --- | --- |
| Folders | Create, assign, filter (All / Unassigned / custom) |
| Tags | `#tag` style labels on chats |
| Pins | Keep important chats at the top |
| Derived titles | Local titles when the site says “New chat” |
| One-line previews | `user → assistant` recall line when messages captured |
| Continue where you left off | Latest chats across Tecora |
| Scope switch | Current account vs **All platforms** |

**Landing headline angle:** “Continue where you left off — across every model.”

---

## 3. Search everywhere

| Feature | Detail |
| --- | --- |
| Side panel search | Filters by title / preview |
| Command palette | `Ctrl/Cmd+K` on supported pages |
| Full-text | MiniSearch over titles + captured message text |
| Cross-platform | When “All platforms” is selected |
| Command hints | `>` mode in the palette |

**Landing headline angle:** “One shortcut. Your whole AI history.”

---

## 4. Export & backup

| Feature | Detail |
| --- | --- |
| Markdown export | Single chat, selected, or all |
| Portable JSON archive | Chats, messages, folders, tags — importable |
| ZIP export | Markdown + harvested assets + `MISSING.md` |
| Asset harvest | Claude artifacts, ChatGPT images/files/code, Gemini images when open |
| Select mode | Multi-select for export or delete |

**Landing headline angle:** “Leave with your work. Not trapped in a sidebar.”

---

## 5. Privacy & control

| Feature | Detail |
| --- | --- |
| Local-only storage | Dexie / IndexedDB on device |
| No Tecora account | No login for Tecora itself |
| No Tecora backend | Explicit product rule |
| Per-platform message capture toggles | Titles/metadata only when off |
| Activity log | Recent local actions |
| Wipe all data | Full local reset |

**Landing headline angle:** “Everything stays on your device — no account, no backend.”

---

## 6. Usage awareness (local)

| Feature | Detail | Caution |
| --- | --- | --- |
| Rolling 5h activity | Captured-message counts | Local only |
| Long-chat estimates | ~`chars/4` token heuristic | Not platform quota |
| UI disclaimer | “local estimate, not platform quota” | Always show honesty |

**Landing note:** useful, but secondary. Don’t lead with “track your limits” until real platform usage APIs ship.

---

## 7. Product surfaces

| Surface | What it does |
| --- | --- |
| Side panel | Main library UI (browse, organize, export, privacy) |
| Floating τ dock | Hover for search + open side panel |
| Shadow DOM palette | In-page `Ctrl/Cmd+K` that doesn’t fight host CSS |
| Toolbar action | Opens side panel |
| Help card | In-panel “How Tecora works” |

---

## 8. Cleanup & safety

| Feature | Detail |
| --- | --- |
| Bulk delete queue | Safety-gated; drives platform delete modals |
| Tab must stay open | Queue pauses if platform tab unavailable |
| Confirm copy | Explicit “cannot be undone” messaging |

Good for power-user / hackathon demo; keep soft on marketing (deletion is serious).

---

## Explicit non-features (do not market as done)

- Platform-native archive / rename  
- ChatGPT Projects visibility  
- ChatGPT Canvas harvest  
- Real Claude / ChatGPT usage % from site APIs  
- Cloud sync, teams, SSO  
- AI summarization of chats inside Tecora  
- Firefox store polish (build path exists; landing should focus Chrome for hackathon unless decided otherwise)

---

## Feature → landing section mapping

| Landing section | Features to show |
| --- | --- |
| Hero | Cross-platform + local-first + Download |
| Section 01 | Capture from Claude / ChatGPT / Gemini |
| Section 02 | Folders, tags, resume |
| Section 03 | Search + palette |
| Section 04 | Export / archive / ZIP |
| Feature grid | Privacy, wipe, usage honesty, bulk cleanup |
| FAQ | Non-features + privacy questions |

## Related docs

- [how-it-works.md](./how-it-works.md)
- [illustrations.md](./illustrations.md)
- [landing-page-structure.md](./landing-page-structure.md)
