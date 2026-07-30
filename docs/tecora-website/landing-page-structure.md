# Landing page structure

Section-by-section map for the Tecora marketing site. Inspired by Prime UI’s narrative rhythm; filled with Tecora product truth.

**Page job:** explain the extension + get a download.

---

## Global chrome

### Nav

| Element | Spec |
| --- | --- |
| Left | τ mark + “Tecora” |
| Center (optional) | Features · How it works · FAQ |
| Right | Secondary: Demo · Primary: **Download** |
| Behavior | Thin, dark, minimal; may become translucent on scroll |

### Footer

| Element | Spec |
| --- | --- |
| Brand | τ + Tecora |
| Links | Privacy notes · GitHub · Download |
| Meta | “Local-first · No backend · v0.1” |

---

## Section 0 — Hero

**Goal:** Brand + promise + Download in one viewport.

### Contents (hero budget)

1. Brand signal (large τ and/or product frame)  
2. One headline (split line OK)  
3. One short supporting sentence  
4. CTA group: **Download** + optional “See how it works”  
5. One dominant visual  

### Do not put in the hero

Stats strips, platform badge clouds, feature grids, schedules, testimonials walls, floating stickers on the art.

### Suggested copy slot

See [copy-and-messaging.md](./copy-and-messaging.md).

### Visual

Product composition: side panel + τ dock on a dark Claude/ChatGPT-like atmosphere (abstracted, not a raw copyrighted screenshot collage). Or a single heroic τ with a subtle library metaphor.

---

## Section 1 — `01` Capture

**Headline direction:** Start on the sites you already use.  
**Sub:** Tecora reads Claude, ChatGPT, and Gemini while you browse — no manual import to begin.

**Visual:** Three platform streams → one local library.

**CTA:** none required (keep scrolling).

---

## Section 2 — `02` Organize & resume

**Headline direction:** Folders, tags, and “continue where you left off.”  
**Sub:** Pin what matters. Resume across models.

**Visual:** Side panel mock with folders/tags + resume block.

**Interaction (Prime-like, optional):** tabs for Folders / Tags / Resume.

---

## Section 3 — `03` Search

**Headline direction:** One shortcut. Your whole history.  
**Sub:** `Ctrl/Cmd+K` full-text search over titles and captured messages.

**Visual:** Command palette illustration with keyboard hint.

---

## Section 4 — Export & leave freely

**Headline direction:** Export that actually packs your work.  
**Sub:** Markdown, portable JSON archives, ZIP with files. Missing assets listed honestly.

**Visual:** Archive / ZIP stack + `MISSING.md` as a trust detail.

**CTA:** Download (repeat).

---

## Section 5 — Privacy band

**Headline direction:** No account. No backend. Nothing leaves the device.  
**Sub:** Per-platform capture toggles. Wipe all data anytime.

**Visual:** Privacy panel mock or simple lock/device diagram (keep mono, not cartoon).

---

## Section 6 — Surfaces / “complete product” tabs

Prime UI’s “Complete site” tabs → Tecora surfaces:

| Tab | Content |
| --- | --- |
| Side panel | Library, organize, export |
| Palette | In-page search |
| τ dock | Floating entry point |
| Privacy | Controls + activity |

Each tab: short paragraph + 3 bullets + visual.

---

## Section 7 — Feature highlights (carousel or horizontal strip)

Short cards / slides (not a dashboard):

1. Local-first IndexedDB library  
2. Cross-platform “All platforms” scope  
3. Derived titles & previews  
4. Safety-gated bulk delete  
5. Usage awareness (honest local estimates)  
6. Shadow DOM UI that doesn’t break host pages  

Keep each slide to **one sentence + one visual detail**.

---

## Section 8 — How to install (compact)

Numbered 1–2–3:

1. Download / load the extension  
2. Open Claude, ChatGPT, or Gemini logged in  
3. Click τ / toolbar icon → side panel  

Link to deeper [how-it-works.md](./how-it-works.md) content if needed.

---

## Section 9 — FAQ

Accordion. Questions in [copy-and-messaging.md](./copy-and-messaging.md).

---

## Section 10 — Closing CTA

**Headline:** Install Tecora. Keep your AI history coherent.  
**CTA:** Download  
**Microcopy:** Free to try · Runs locally · No Tecora account  

Optional quiet line for hackathon: “Built for [hackathon name] — v0.1”.

---

## Information architecture (single page)

```text
/#                 Hero
/#capture          01
/#organize         02
/#search           03
/#export           Export
/#privacy          Privacy
/#surfaces         Tabs
/#features         Highlights
/#install          Install steps
/#faq              FAQ
/#download         Closing CTA (or reuse hero id)
```

---

## Responsive rules

| Breakpoint | Behavior |
| --- | --- |
| Desktop | Illustration beside or under copy; large display type |
| Tablet | Stack illustration below headline |
| Mobile | Single column; sticky bottom Download optional; reduce motion complexity |

---

## Wireframe (ascii)

```text
┌──────────────────────────────────────────────┐
│ τ Tecora                    Demo   [Download]│
├──────────────────────────────────────────────┤
│                                              │
│              τ / product visual              │
│           Your AI chats.                     │
│           One local library.                 │
│              [Download]  See how             │
│  ─────────────────────────────────────────   │
│  Short supporting sentence…                  │
│                                              │
├──────────────────────────────────────────────┤
│ 01  Capture…          [illustration]         │
├──────────────────────────────────────────────┤
│ 02  Organize…         [illustration]         │
├──────────────────────────────────────────────┤
│ 03  Search…           [illustration]         │
├──────────────────────────────────────────────┤
│ Export…               [illustration] [DL]    │
├──────────────────────────────────────────────┤
│ Privacy band                                 │
├──────────────────────────────────────────────┤
│ Tabs: Side panel | Palette | Dock | Privacy  │
├──────────────────────────────────────────────┤
│ Feature carousel                             │
├──────────────────────────────────────────────┤
│ Install 1-2-3                                │
├──────────────────────────────────────────────┤
│ FAQ                                          │
├──────────────────────────────────────────────┤
│ Closing Download                             │
├──────────────────────────────────────────────┤
│ footer                                       │
└──────────────────────────────────────────────┘
```

## Related docs

- [prime-ui-reference.md](./prime-ui-reference.md)
- [illustrations.md](./illustrations.md)
- [download-and-cta.md](./download-and-cta.md)
