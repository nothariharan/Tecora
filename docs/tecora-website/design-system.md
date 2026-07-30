# Design system (website + product alignment)

Tecora already ships a mono theme in the extension. The landing page should feel like the same product — with Prime UI–level section craft and motion — not like a different brand.

---

## Principles

1. **Mono first** — black, white, gray. Color is rare and intentional.
2. **Brand before chrome** — τ and Tecora lead; UI chrome stays quiet.
3. **One composition per viewport** — especially the hero (see landing structure).
4. **Illustrations earn their space** — product truth, not decorative blobs.
5. **Honest density** — lots of air; no dashboard clutter on marketing surfaces.
6. **Cards are not the default** — use them only when they hold a real interaction (FAQ accordion, download panel).

---

## Color tokens (from product)

Source: `src/ui/theme.ts`

| Token | Hex | Use |
| --- | --- | --- |
| `bg` | `#111111` | Extension panel background |
| `pageBg` (site) | `#000000` or `#0a0a0a` | Full-bleed site background (Prime UI–like void) |
| `fg` | `#ffffff` | Primary text |
| `muted` | `#a3a3a3` | Secondary text |
| `faint` | `#737373` | Tertiary / meta |
| `icon` | `#8a8a8a` | Icons |
| `border` | `#262626` | Hairlines |
| `borderStrong` | `#404040` | Stronger dividers, dock ring |
| `hover` | `#1a1a1a` | Hover surfaces |
| `selectedBg` | `#262626` | Selected rows |
| `pillBg` | `#1a1a1a` | Quiet chips |
| `danger` | `#ffffff` on `#000000` | Destructive stays mono (no red) |

### Accent policy for the website

Prime UI uses bright blue CTAs (`rgb(37, 99, 235)`). **Do not copy that as Tecora’s brand accent.**

Recommended CTA treatments for Tecora:

| Priority | Treatment |
| --- | --- |
| Primary | Solid white button, black label |
| Secondary | Ghost / outline white on black |
| Tertiary | Text link in muted gray |

Optional tiny accent (only if needed for hackathon flair): a single cool neutral like `#e5e5e5` highlights — still mono. Avoid purple glows, terracotta/cream editorial tropes, and default “AI purple”.

---

## Typography

### Product today

- System UI stack (`-apple-system`, `Segoe UI`, etc.)
- ~13px body in the side panel
- Uppercase micro-labels with letter-spacing for section headers

### Website recommendation

Prime UI uses Inter at large display sizes. For Tecora’s marketing site, prefer a more distinctive pairing that still feels technical:

| Role | Direction |
| --- | --- |
| Display / hero | A sharp grotesque or modern neo-grotesk with tight tracking (not Inter-by-default if you can choose) |
| Body | Clean sans, 16–18px, comfortable line-height ~1.5–1.6 |
| Meta / labels | Small caps or uppercase 11–12px, wider tracking, muted color |
| Code / shortcuts | Monospace for `Ctrl/Cmd+K`, file names like `MISSING.md` |

### Type scale (suggested)

| Step | Size | Weight | Use |
| --- | --- | --- | --- |
| Display | 48–72px | 600 | Hero (split line like Prime UI) |
| H2 | 32–48px | 600 | Section titles |
| H3 | 20–28px | 500–600 | Feature cards / illustration captions |
| Body | 16–18px | 400 | Supporting paragraphs |
| Small | 13–14px | 400–500 | Captions, FAQ |

**Prime UI pattern to keep:** split headlines — primary line bright, secondary line muted.

Example:

```text
Your AI chats.
One local library.
```

---

## Shape & layout

| Token | Product | Website |
| --- | --- | --- |
| Radius | `4px` | Prefer 4–8px; avoid pill-everything |
| Max content width | — | ~1120–1200px |
| Section padding | — | Large vertical rhythm (96–160px) |
| Hairlines | `#262626` | Use separators like Prime UI’s post-hero rule |
| Shadows | Soft dock shadow in-product | Subtle only; no multi-layer neon |

---

## Components (marketing)

### Nav

- Left: τ + Tecora  
- Right: sparse links (Features, How it works) + **Download**  
- Sticky optional; keep thin and quiet  

### Buttons

- Primary Download: high contrast, not blue-by-default  
- Hover: slight brightness shift or invert — 150–200ms  
- Focus: visible white/gray ring for a11y  

### Feature blocks (Prime-style)

- Numbered `01` / `02` / `03`  
- Short headline + muted subline  
- Large illustration or product mock beside/under copy  

### FAQ

- Accordion, one open at a time  
- Quiet borders, no heavy cards  

### Footer

- Minimal: mark, Privacy, GitHub/Download, maybe X/GitHub  

---

## Imagery rules

- Prefer **product UI frames** (side panel, palette, τ dock) over abstract 3D clutter  
- If using glass/glow (Prime UI does), keep it **desaturated** and secondary to τ  
- Full-bleed dark atmosphere OK; don’t rely on flat gray rectangles alone  
- No emoji as design elements  
- No floating badge stickers on hero media  

---

## Accessibility

- Contrast: white/gray on black should meet AA for body  
- Don’t use muted gray for primary CTAs  
- Keyboard focus states on Download and FAQ  
- Motion: respect `prefers-reduced-motion`  

## Related docs

- [prime-ui-reference.md](./prime-ui-reference.md)
- [motion-and-animation.md](./motion-and-animation.md)
- [illustrations.md](./illustrations.md)
