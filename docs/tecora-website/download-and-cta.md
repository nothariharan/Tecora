# Download and CTA

The landing page exists to get people to install Tecora. Treat Download as the only primary action.

---

## Primary CTA label

Pick one and use it consistently:

| Label | When to use |
| --- | --- |
| **Download** | Generic, clear |
| **Install Tecora** | Slightly more explicit |
| **Add to Chrome** | Only if Web Store listing exists |

For hackathon before Store approval, prefer **Download** or **Install Tecora** pointing to a ZIP / GitHub Release / install instructions.

---

## CTA placements (required)

1. Nav (always visible)  
2. Hero  
3. After Export or Privacy section (mid-page)  
4. Closing band  

Secondary links (“See how it works”, “Demo”) never visually outrank Download.

---

## What the button should do

Document the real target before build day:

| Mode | Behavior |
| --- | --- |
| Chrome Web Store | Link to listing |
| GitHub Release | Link to `.zip` of packaged extension |
| Hackathon demo | Link to install doc section + file download |
| Dev judges | “Load unpacked” instructions modal/page |

### Recommended hackathon flow

1. Click **Download** → get packaged build or repo instructions  
2. Land on `/#install` with 3 steps  
3. Optional: GitHub button as secondary  

---

## Install steps copy (on-page)

1. **Get the build** — Download the Tecora package (or clone + `npm run build`).  
2. **Load in Chrome** — `chrome://extensions` → Developer mode → Load unpacked → select the build folder (or drag the package if using a store-style zip flow).  
3. **Open a chat site** — Visit Claude, ChatGPT, or Gemini logged in → click the Tecora toolbar icon.

Exact paths should match whatever the team ships for the hackathon (`.output/chrome-mv3` for local WXT builds).

---

## Microcopy near the button

Always-safe lines:

- `No Tecora account required`  
- `Runs locally on your device`  
- `Works with Claude, ChatGPT, and Gemini`  

Conditional:

- `Chrome Manifest V3`  
- `v0.1 — hackathon build`  

---

## Demo CTA (secondary)

If you have a Loom / YouTube walkthrough:

- Label: **Watch demo**  
- Placement: nav + under hero secondary  
- Keep muted product video vibe (Prime UI has a play control)  

If no video yet: anchor to `#how-it-works` / `#capture` instead of a dead Demo link.

---

## Analytics (optional)

If tracking is added later, keep it light and disclosed. Prefer privacy-friendly page analytics. Never imply Tecora the extension phones home because the *website* has analytics.

---

## Button visual spec (reminder)

From [design-system.md](./design-system.md):

- Primary: white fill, black label (mono)  
- Not Prime-UI blue pills  
- Radius 4–8px (or soft rounded), not mandatory full pills  
- Clear focus ring  

## Related docs

- [landing-page-structure.md](./landing-page-structure.md)
- [how-it-works.md](./how-it-works.md)
