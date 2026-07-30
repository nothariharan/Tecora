# Lovable / AI builder prompt — Tecora landing page

Copy everything below the line into Lovable (or any AI site builder). Attach the Tecora docs (`features.md`, `how-it-works.md`, `hackathon-brief.md`, and any other `docs/tecora-website/*` files) alongside this prompt. Use [https://primeui.com/](https://primeui.com/) as the **structural and craft** reference — not as a brand to clone.

---

## THE PROMPT (copy from here)

---

You are an expert product designer and frontend engineer. Build a **complete, production-quality single-page marketing website** for **Tecora**, a Manifest V3 browser extension.

This is for a **hackathon submission**. The page must explain what Tecora does, feel as premium and clean as **https://primeui.com/**, and drive one primary action: **Download / Install the extension**.

I am attaching product documentation. Treat those files as source of truth for features, flows, and messaging. If anything conflicts, prefer the attached docs + the hard rules in this prompt.

---

# 0. Mission

Build one landing page that:

1. Makes a stranger understand Tecora in the first viewport + two scroll sections
2. Feels like a high-end product film (Prime UI level craft)
3. Looks like the same brand as the Tecora extension (black / white / gray + τ)
4. Converts with a clear **Download** CTA in nav, hero, mid-page, and footer closer
5. Never lies about the product (no fake cloud, no “AI wrapper”, no fake quota)

**Do not** build a web app, dashboard, pricing SaaS, blog, or auth flow.  
**Do** build a stunning marketing page with polished section illustrations / UI mocks, clean motion, and excellent responsive behavior.

---

# 1. What Tecora is (product truth — never violate)

## One line
Local-first browser extension that organizes AI chats across **Claude**, **ChatGPT**, and **Gemini** — folders, search, cleanup, and export. Nothing leaves the device.

## Fuller truth
Tecora is **not** a chatbot and **not** an AI wrapper. It does not call models. It sits on top of the AI chat sites you already use, captures chat metadata (and optionally message content), stores everything **on-device** in the browser (IndexedDB), and gives you organization tools those sites don’t share with each other.

## Brand
- Name: **Tecora**
- Mark: lowercase Greek **τ** (tau)
- Tone: direct, calm, privacy-forward, technically honest
- Version: **v0.1**

## Core promises to repeat
1. Cross-platform organization
2. Local-first privacy (no Tecora account, no Tecora backend)
3. Search + resume across models
4. Portable export (markdown / JSON archive / ZIP)

## Hard “is not” list (never claim)
- Not an AI chat app / Copilot alternative
- Not a cloud sync product
- Not a team SaaS with SSO
- Does **not** show exact “messages remaining” / platform quota today
- Does **not** fully support ChatGPT Projects yet
- Does **not** summarize chats with AI inside Tecora

## Platforms (shipping)
- `claude.ai`
- `chatgpt.com`
- `gemini.google.com`

---

# 2. Design inspiration: Prime UI — what to steal vs what to refuse

Study **https://primeui.com/** carefully. Match its **quality bar and page storytelling**. Do **not** copy its brand system.

## Steal these patterns from Prime UI
- Pure black void atmosphere, huge breathing room
- Centered hero with **one** dominant illustration
- Split headlines: bright primary line + muted secondary line
- One primary CTA, repeated strategically
- Numbered narrative chapters: `01`, `02`, `03`
- Each chapter = short copy + large custom visual / interactive demo
- Tabbed “complete product” area
- Horizontal feature highlights / carousel with punchy one-liners
- FAQ accordion
- Sparse nav + sparse footer
- Hairline separator under hero CTA before supporting paragraph
- Motion that feels expensive: soft fades, rises, staggered lines — not particle spam
- One job per section

## Do NOT copy from Prime UI
- Blue pill CTAs (`#2563EB` / similar)
- Neon magenta/cyan hero glow as brand identity
- Inter-as-the-whole-personality (ok as fallback, not identity)
- Pricing tables (Personal $99 / Business $299)
- “AI website builder / export Next.js” metaphor
- Dense “200+ components” marketing
- Fake logo farms / testimonial walls unless real

## Translation map
| Prime UI | Tecora |
| --- | --- |
| Get Started | **Download** / Install Tecora |
| Live Demo | See how it works (anchor) or Watch demo |
| 01 Sitemap | 01 Capture from Claude / ChatGPT / Gemini |
| 02 Experiment | 02 Organize with folders, tags, resume |
| 03 Export to code | 03 Search + export locally |
| Complete site tabs | Surfaces: Side panel / Palette / τ dock / Privacy |
| Pricing | Skip — replace with free local install story |
| Ship it closer | Final Download band |

---

# 3. Visual identity (Tecora design system)

## Atmosphere
- Page background: `#000000` or `#0a0a0a`
- Full-bleed dark. Not cream. Not purple gradient SaaS. Not newspaper editorial.

## Color tokens (use CSS variables)
```css
:root {
  --bg: #000000;
  --panel: #111111;
  --fg: #ffffff;
  --muted: #a3a3a3;
  --faint: #737373;
  --icon: #8a8a8a;
  --border: #262626;
  --border-strong: #404040;
  --hover: #1a1a1a;
  --selected: #262626;
  --pill: #1a1a1a;
}
```

## CTA colors (critical)
- **Primary button:** solid white background, black text
- **Secondary button:** ghost / outline white border, white text
- **Tertiary:** muted text link
- **Never** default to blue pills, purple gradients, or glowing neon buttons

## Typography
- Distinctive modern grotesque / neo-grotesk for display (avoid generic “AI Inter purple” look if you can choose better)
- Body 16–18px, line-height ~1.55
- Display hero ~48–72px, weight ~600, tight letter-spacing
- Section titles 32–48px
- Micro labels: 11–12px uppercase, wider tracking, muted
- Monospace for shortcuts like `Ctrl/Cmd+K` and filenames like `MISSING.md`
- Split headline pattern everywhere important:

```text
Your AI chats.
One local library.
```

First line: `#fff`  
Second line: muted gray (~50–70% opacity or `--muted`)

## Shape
- Radius: 4–8px (product uses 4px). Avoid pill-everything.
- Max content width ~1120–1200px
- Section vertical padding large: 96–160px desktop
- Hairlines `#262626`
- Shadows subtle only — no multi-layer neon

## Layout philosophy (non-negotiable)
- First viewport = **one composition**, not a dashboard
- Brand (τ + Tecora) must be hero-level, not a tiny nav-only mark
- Brand test: if you remove the nav, the first viewport still feels like Tecora
- Cards are NOT the default. No card grids in the hero. Cards only when they hold real interaction (FAQ, maybe install panel)
- No floating badge stickers on hero art
- No emoji as design decoration
- No stats strips / logo clouds / “trusted by” fake rows in v1
- One purpose per section: one headline, one short supporting sentence, one dominant visual

## Anti-patterns (hard ban)
- Purple-on-white or purple-to-indigo AI templates
- Warm cream background + terracotta + serif editorial cliché
- Broadsheet dense newspaper columns
- Glassmorphism overload
- Dashboard hero with 8 widgets
- Rounded-full pills everywhere
- Glow spam

---

# 4. Brand mark and voice

## Mark
- Use a clean lowercase Greek **τ** as the logo mark
- Nav: τ + wordmark “Tecora”
- Hero: large τ and/or product UI frame featuring τ dock
- Toolbar/product metaphor: circular dark chip with white τ, subtle `#404040` ring

## Voice rules
- Direct short sentences
- Calm — no “revolutionary / game-changing / unleash”
- Honest about limits
- Prefer: local-first, on your device, organize, library, extension, capture, portable archive, local estimate
- Avoid: secure cloud brain, sync, remaining messages, “the only ChatGPT alternative”

---

# 5. Exact page structure to build

Build **one scrollable page** with these sections in order. Use anchor IDs.

```text
Nav
Hero                         #/
01 Capture                   #capture
02 Organize & resume         #organize
03 Search                    #search
Export                       #export
Privacy                      #privacy
Surfaces tabs                #surfaces
Feature highlights           #features
Install steps                #install
FAQ                          #faq
Closing Download             #download
Footer
```

---

## 5.1 Nav
- Left: τ + Tecora
- Center optional links: Features · How it works · FAQ
- Right: secondary “See how it works” + primary **Download**
- Thin, dark, minimal; sticky with slight translucency on scroll OK
- Download always visually strongest

## 5.2 Hero (first viewport only)
Contents allowed:
1. Brand signal (large τ / product composition)
2. Split headline
3. One short supporting sentence
4. CTA group: **Download** + secondary “See how it works”
5. One dominant visual

**Use this copy:**

Headline:
```text
Your AI chats.
One local library.
```

Supporting:
> Folders, search, cleanup, and export for the AI apps you already use — everything stays on your device.

Trust microcopy under CTAs:
`No Tecora account · No backend · Chrome MV3`

After CTAs: a hairline rule, then optionally a slightly longer clarifying line:
> Not an AI wrapper. A local layer that makes living across Claude, ChatGPT, and Gemini less chaotic.

**Hero visual direction:**
Stylized product composition on black: Tecora side panel + floating τ dock, slight perspective, soft desaturated depth. Optional very subtle cool highlight — never rainbow. Abstract the host sites; do not paste raw copyrighted chat UIs.

**Hero must NOT include:**
stats, platform badge clouds, feature grids, testimonials, pricing, floating “New” stickers on the art.

## 5.3 Section 01 — Capture
Eyebrow: `01`  
Title: `Start on the sites you already use.`  
Sub: `Tecora reads your chat lists from Claude, ChatGPT, and Gemini while you browse. No CSV ritual to get started.`

Visual: three streams / cards labeled Claude, ChatGPT, Gemini flowing into one τ local library.

Optional micro-interaction: staggered stream animation on scroll enter.

## 5.4 Section 02 — Organize & resume
Eyebrow: `02`  
Title: `Folders, tags, and resume — across models.`  
Sub: `Pin what matters. Continue where you left off. Switch from one account to All platforms when you need the whole picture.`

Visual: side-panel mock showing folders, tags, pins, and a “Continue where you left off” block.

Optional tabs inside the visual: Folders / Tags / Resume.

## 5.5 Section 03 — Search
Eyebrow: `03`  
Title: `One shortcut. Your whole history.`  
Sub: `Press Ctrl/Cmd+K to search titles and captured message text without digging through three sidebars.`

Visual: command palette floating over a darkened page, keyboard chip `⌘K` / `Ctrl K`, cross-platform results.

Optional idle motion: typing loop searching something like `auth middleware`, then pause and replay. Disable when `prefers-reduced-motion`.

## 5.6 Export
Title: `Export that packs the work.`  
Sub: `Markdown for reading. Portable JSON archives for restore. ZIP when you need files and artifacts — with an honest MISSING.md when something can’t be fetched.`

Visual: stack of `.md` / archive `.json` / `.zip` plus a small `MISSING.md` honesty detail.

Include a mid-page **Download** CTA here.

## 5.7 Privacy band
Title: `No account. No backend. Nothing leaves the device.`  
Sub: `Keep message capture on for full-text search, or limit a platform to titles only. Wipe all Tecora data anytime.`

Visual: privacy controls mock or device-local diagram (mono, not cartoon lock art).

This section should feel like a trust climax — spacious, confident, minimal.

## 5.8 Surfaces tabs (“complete product”)
Tablist:
1. Side panel
2. Palette
3. τ dock
4. Privacy

For each tab: short paragraph + 3 bullets + matching visual.

Suggested bullets:

**Side panel**
- Browse chats across supported platforms
- Folders, tags, pins, select/export
- Resume recent work

**Palette**
- `Ctrl/Cmd+K` on supported pages
- Full-text over titles + captured messages
- Shadow DOM so host page CSS doesn’t break it

**τ dock**
- Floating τ entry point
- Hover to search or open side panel
- Stays out of the way until needed

**Privacy**
- Per-platform message capture toggles
- Recent local activity
- Wipe all Tecora data

## 5.9 Feature highlights
Horizontal carousel or snap strip. One idea per slide. Not a dashboard card wall.

Slides + lines:
1. **Local-first** — Your library lives in the browser — not on our servers. We don’t run chat servers.
2. **Cross-platform** — One resume list across Claude, ChatGPT, and Gemini.
3. **Derived titles** — “New chat” becomes something you can actually recognize.
4. **Previews** — One-line recall so you know the thread before you open it.
5. **Bulk delete** — A safety-gated queue beats rage-clicking native modals.
6. **Usage awareness** — Local activity estimates — clearly labeled, never fake quota.
7. **Shadow DOM UI** — Palette and dock sit cleanly on top of host pages.

## 5.10 Install
Title: `Up in a minute.`

Steps:
1. Install the Tecora extension
2. Open Claude, ChatGPT, or Gemini while logged in
3. Open the side panel — your library starts filling in

Download button again. Keep this compact and practical.

Wire the Download button to `#install` for now if no real store URL exists, and include a short “Load unpacked / Chrome MV3” note suitable for hackathon judges. Use a placeholder like `DOWNLOAD_URL` that is easy to replace.

## 5.11 FAQ (accordion, one open at a time)
Include at least:

1. **Is Tecora an AI chatbot?**  
   No. Tecora doesn’t answer prompts or wrap models. It organizes chats from Claude, ChatGPT, and Gemini.

2. **Does my data leave my computer?**  
   Chat data Tecora stores stays in your browser’s local storage (IndexedDB). There is no Tecora backend for syncing your chats.

3. **Do I need a Tecora account?**  
   No.

4. **Which browsers are supported?**  
   v0.1 targets Chromium via a Manifest V3 extension (Chrome-class browsers).

5. **Which sites does it work on?**  
   claude.ai, chatgpt.com, and gemini.google.com.

6. **Can I turn off message storage?**  
   Yes. Per-platform toggles can keep capture to titles/metadata and remove stored message text.

7. **Will this show my exact ChatGPT / Claude quota?**  
   Not today. Usage awareness is a local estimate from captured activity, labeled clearly.

8. **Can I back up folders and tags?**  
   Yes. Portable JSON archive export/import restores chats, messages, folders, and tags.

9. **Is bulk delete safe?**  
   It’s powerful and irreversible on the platform. Tecora uses a safety-gated queue and asks you to keep the site tab open.

10. **Is this free?**  
    Yes for the current hackathon / v0.1 distribution. No SaaS billing.

## 5.12 Closing CTA
Headline: `Keep your AI history coherent.`  
Sub: `Install Tecora and give every model the same local memory layer.`  
CTA: **Download**  
Micro: `Free to try · Runs locally · No Tecora account`  
Optional quiet line: `v0.1 · Hackathon build`

## 5.13 Footer
- τ + Tecora
- Links: FAQ · Privacy note · GitHub (placeholder) · Download
- Meta: `Local-first · No backend · v0.1`
- Minimal. No sitemap junk.

---

# 6. Illustrations / UI mocks (make them feel expensive)

Create custom section visuals (SVG / composed HTML mocks / tasteful generated art). They should feel like Prime UI’s demo craft, but mono.

Required visuals:
1. Hero product composition (τ + side panel / dock)
2. Capture streams → library
3. Organize side-panel mock
4. Command palette mock
5. Export stack + MISSING.md
6. Privacy panel / local device visual
7. Four small surfaces visuals for tabs

Style recipe:
- Product-real, not random 3D toys
- Charcoal glass, white ink, soft gray depth
- 1–2 depth layers max
- If any glow: desaturated, secondary to τ
- Platform labels as quiet word chips if logos are risky
- No emoji, no sticker badges on hero media

---

# 7. Motion requirements

Ship at least these intentional motions:

1. **Hero entrance** — visual fade/rise, headline lines stagger, CTA last (600–800ms total, no bounce)
2. **Scroll reveals** for 01/02/03 — fade + slight rise / scale 0.98→1 when entering viewport
3. **Button hover** — 150–200ms brightness/invert on Download
4. **Recommended:** palette typing loop in Search section
5. **Recommended:** τ dock hover-expand recreation in Surfaces
6. **FAQ height animation** ~200ms

Easing suggestion: `cubic-bezier(0.22, 1, 0.36, 1)`  
Prefer transform + opacity.  
Respect `prefers-reduced-motion: reduce` (show final states, kill loops/parallax).

Avoid: rainbow pulses, scroll-jacking, confetti, marquee spam, autoplaying loud video.

---

# 8. How Tecora works (for accurate UI copy / optional deeper panel)

User story to reflect in install + visuals:

1. Install extension (no Tecora signup)
2. Open Claude / ChatGPT / Gemini logged in
3. Tecora captures chat lists while browsing
4. Organize in side panel (folders, tags, pins, All platforms)
5. Search with panel or `Ctrl/Cmd+K`
6. Export markdown / JSON archive / ZIP
7. Control privacy toggles / wipe data

Technical truth (do not over-explain on page; FAQ/deep copy only):
- Main-world fetch/XHR intercept (Claude/ChatGPT)
- Content script adapters + Shadow DOM UI
- Service worker + Dexie IndexedDB + MiniSearch
- Gemini via DOM scrape; messages when chat open

---

# 9. Feature inventory (use for accuracy; don’t dump all in hero)

Market these as shipped:
- Capture across Claude, ChatGPT, Gemini (with known Gemini limits)
- Folders, tags, pins
- Derived titles + one-line previews
- Continue where you left off
- All platforms scope
- Side panel + command palette + τ dock
- Markdown / portable JSON archive / ZIP export with asset harvest
- Per-platform message capture toggles
- Activity log + wipe all
- Local usage awareness (estimates only)
- Safety-gated bulk delete

Do not market as done:
- ChatGPT Projects
- Real platform usage meters
- Cloud sync
- Native archive/rename everywhere
- AI summarization

Optional quiet “Coming next” strip (not hero):
- Real usage meters where APIs allow
- ChatGPT & Claude projects in library
- Richer artifact / Canvas export

---

# 10. SEO / meta / accessibility

- Title: `Tecora — Organize Claude, ChatGPT, and Gemini locally`
- Meta description: `Folders, search, bulk cleanup, and portable export for your AI chats. Local-first browser extension. No account. No backend.`
- Semantic HTML: header/main/section/footer, real buttons/links
- Alt text on illustrations describing function
- Keyboard focus rings on CTAs and FAQ
- Contrast AA for body text
- Smooth anchor scrolling
- Mobile: single column, readable type, tap-friendly Download; optional sticky mobile Download bar

---

# 11. Technical implementation preferences

Build with a modern React + Tailwind (or equivalent) setup that Lovable supports.

Requirements:
- Single landing route `/`
- Componentized sections
- CSS variables for tokens
- No fake backend
- Download buttons use a single shared `DOWNLOAD_URL` constant (placeholder OK)
- Clean file structure
- Performance-conscious images / SVG
- No heavy unnecessary libraries

Responsive breakpoints:
- Desktop: illustration beside or under copy with luxury spacing
- Tablet/mobile: stack, reduce motion complexity, keep hierarchy

---

# 12. Content placeholders you may use

```ts
export const DOWNLOAD_URL = "#install"; // replace with Chrome Web Store or GitHub release later
export const GITHUB_URL = "#"; // replace
export const DEMO_URL = "#capture"; // or Loom later
```

---

# 13. Acceptance criteria (definition of done)

The page is done only when ALL are true:

- [ ] Looks in the same quality league as primeui.com in spacing, hierarchy, and section storytelling
- [ ] Clearly Tecora-branded (τ + mono), not a blue Prime UI clone
- [ ] First viewport is one composition with brand, headline, one sentence, CTAs, one visual
- [ ] Numbered 01/02/03 story sections exist with custom visuals
- [ ] Privacy “no account / no backend” is unmistakable
- [ ] Download appears in nav, hero, mid-page, and closing
- [ ] FAQ answers “is this an AI?” and data-leaving questions
- [ ] No pricing table
- [ ] No purple AI-template look
- [ ] No false claims (quota, projects, cloud sync, AI wrapper)
- [ ] Desktop and mobile both work
- [ ] At least 3 intentional motions, with reduced-motion support
- [ ] Page explains extension + drives install, nothing else

---

# 14. Build order (follow this)

1. Global shell: tokens, fonts, nav, footer
2. Hero (pixel-careful)
3. 01 / 02 / 03 story sections with visuals
4. Export + Privacy
5. Surfaces tabs
6. Feature highlights
7. Install + FAQ + Closing CTA
8. Motion polish + mobile pass
9. Final copy audit against “never claim” list

---

# 15. Final creative brief in one paragraph

Make Tecora’s landing page feel like a black, quiet, high-end product film: the local OS for your AI chat history. Borrow Prime UI’s cinematic section rhythm, split headlines, numbered chapters, and illustration-led storytelling — but express it through Tecora’s τ mark, monochrome system, white Download buttons, and radical honesty about privacy. The site should make a hackathon judge think: “this is a real product,” then click Download.

---

Now build the full page. Be ambitious with visual craft. Prefer fewer sections done beautifully over many sections done generically. Use the attached Tecora documentation for any extra product detail you need.

---

## END OF PROMPT

---

## How to use this in Lovable

1. Open Lovable
2. Attach key docs from `docs/tecora-website/` (at least `features.md`, `how-it-works.md`, `hackathon-brief.md`; ideally also `design-system.md`, `copy-and-messaging.md`, `landing-page-structure.md`)
3. Paste everything under **THE PROMPT (copy from here)**
4. Optionally paste `https://primeui.com/` in the composer as visual reference (as in your screenshot)
5. After generation, replace `DOWNLOAD_URL` / `GITHUB_URL` with real links
6. Do a claims pass: no cloud, no wrapper, no fake quota, no Projects support

## Shorter follow-up prompts (if Lovable needs iteration)

### Tighten hero
```text
Refine the hero only. One composition. Larger τ brand presence. Split headline “Your AI chats.” / “One local library.” White Download button + ghost secondary. Remove any badges, stats, or blue pills. Match primeui.com spacing quality but keep Tecora mono.
```

### More Prime-like sections
```text
Restyle sections 01–03 to feel closer to primeui.com: bigger type, more vertical air, numbered eyebrows, one illustration each, no card grids. Keep Tecora black/white tokens.
```

### Fix off-brand colors
```text
Remove all blue/purple accent buttons and neon glows. Primary CTA must be white on black. Borders #262626. Muted text #a3a3a3. Mono only.
```
