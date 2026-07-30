# Motion and animation

Tecora’s site should feel as considered as Prime UI: smooth, purposeful, few tricks — not a particle playground.

Ship **at least 2–3 intentional motions** on the first meaningful scroll path.

---

## Motion principles

1. **Presence, not noise** — motion introduces hierarchy  
2. **Short and soft** — 200–500ms for UI; 600–900ms for section reveals  
3. **Easing** — `cubic-bezier(0.22, 1, 0.36, 1)` or similar ease-out  
4. **Transform + opacity only** where possible (keep it cheap)  
5. **Respect `prefers-reduced-motion: reduce`** — hard cut / no parallax  

---

## Required motion set (minimum)

### 1. Hero entrance

On load:

- τ / hero visual fades + slight rise (`translateY(12px)` → `0`)  
- Headline lines stagger 80–120ms apart  
- CTA fades last  

Duration ~600–800ms total. No bounce.

### 2. Scroll section reveals

For `01` / `02` / `03`:

- Number + headline fade/rise  
- Illustration fades with slight scale `0.98 → 1`  
- Trigger once when ~20–30% visible  

### 3. CTA / dock micro-interaction

- Download button: background invert or brightness on hover (150–200ms)  
- Optional: nav Download subtle scale `1 → 1.02`  

---

## Strongly recommended extras

### 4. Palette typing loop (Search section)

Idle animation: caret blink + query text types a sample like `auth middleware`, results list cross-fades. Pause 2s, loop. Disable when reduced-motion.

### 5. Capture streams (Section 01)

Three dots/lines travel into the τ library, staggered. Loop slowly or play once on enter.

### 6. τ dock hover (Surfaces)

Recreate product behavior: actions expand left on hover — great “this is the real product” moment.

### 7. FAQ accordion

Height animate open/close ~200ms; chevron rotates.

### 8. Tab switches (Surfaces)

Cross-fade panel content 200ms; don’t slide the whole page.

---

## Motions to avoid

| Avoid | Why |
| --- | --- |
| Continuous rainbow glow pulse on hero | Off-brand, tiring |
| Scroll-hijack / hard snap sections | Frustrating |
| Parallax on every layer | Cheap and noisy |
| Marquee text spam | Only if it earns a closer; Prime’s “ship it” is optional |
| Confetti / emoji bursts | Wrong tone |
| Autoplaying loud video with sound | Start muted if any video |

---

## Performance budget

- Prefer CSS or a light motion lib (Motion One / GSAP sparingly)  
- Lazy-mount heavy Lottie/Rive  
- No layout thrash animations (`top`/`height` on big nodes)  
- Keep illustration assets compressed; animate wrappers, not giant bitmaps pixel-by-pixel  

---

## Reduced motion fallback

```text
if prefers-reduced-motion:
  show final states immediately
  keep hover color changes only
  disable typing loops, stream loops, parallax
```

---

## Mapping to Prime UI quality

Prime UI feels expensive because:

- Sections arrive cleanly  
- Interactive demos respond instantly  
- Nothing fights the reader  

Match that bar even if our animations are fewer.

## Related docs

- [illustrations.md](./illustrations.md)
- [landing-page-structure.md](./landing-page-structure.md)
