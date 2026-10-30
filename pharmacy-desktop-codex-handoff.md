# Pharmacy Portal — Desktop Codex Handoff
## Full 3D Pharmacy Redesign

**Project:** `liangRXdev/pharmacy-portal`  
**Primary site:** `https://pharmacy-portal.liangrxdev.workers.dev/`  
**3D route:** `https://pharmacy-portal.liangrxdev.workers.dev/pharmacy/`  
**Target:** Desktop Codex takes over for a major visual redesign of the 3D pharmacy scene.

---

# 0. Executive summary

The project has already completed:

- Phase 1 — architecture / routing / WebGL fallback / CSP / SW / CI
- Phase 2 — initial pharmacy art pass
- Phase 2.5 — visual refinement and pharmacy cohesion

The current architecture is stable and should be preserved.

The next task is **not Phase 3 performance optimization yet**.

Instead, Desktop Codex should perform a major visual redesign:

> **Full 3D Pharmacy Redesign**

Recommended order:

```text
Stable Phase 1 architecture
        ↓
Current Phase 2.5 scene
        ↓
FULL 3D PHARMACY REDESIGN
        ↓
Phase 3 — performance verification & polish
        ↓
Phase 4 — production hardening & final QA
```

Do not optimize the old scene before the redesign is complete.

---

# 1. Current product concept

The site is a personal clinical pharmacy toolkit.

The 3D route is an exploratory portfolio layer for five pharmacy work domains:

| Category | 3D meaning |
|---|---|
| `clinical` | Clinical Pharmacist Station |
| `ebm` | EBM & Teaching |
| `adr` | Medication Safety |
| `gov` | Open Data / Public Data |
| `internal` | Internal Hospital Systems |

Central anchor:

```text
Rx Hub
```

The 3D experience should remain:

> **a portfolio / exploration layer, not the actual tool interface**

Tool metadata still comes from `/public/tools.json`.

---

# 2. Current visual state

The current scene already includes:

- one connected floor
- circulation spine / aisle
- five functional zones
- central Rx Hub
- low-poly pharmacist
- shared medicine shelves
- Clinical infusion station
- EBM discussion area + forest-plot screen
- Safety warning console
- Open Data radar / Taiwan-style public data visual
- Internal dispensing counter / cart
- zone labels
- category focus
- tool markers
- DOM tool navigation

The current visual direction is:

```text
low-poly
warm
MUJI-like
teal / off-white
professional
slightly playful
```

The current scene is acceptable but still feels like:

> a refined miniature portfolio diorama

The redesign should make it feel more like:

> **a complete 3D hospital pharmacy with real spatial logic**

---

# 3. Current architecture — preserve this

The existing architecture is already validated and should not be rewritten.

Current main structure:

```text
public/
├─ index.html
├─ tools.json
├─ sw.js
├─ _headers
├─ manifest.webmanifest
└─ pharmacy/
   ├─ index.html
   ├─ pharmacy.css
   ├─ main.js
   ├─ world.js
   ├─ scene-layout.js
   ├─ art.js
   ├─ geometry.js
   └─ vendor/
      └─ three-lite.js
```

Tooling:

```text
tools/
├─ build-three.mjs
├─ check-portal.js
├─ check-sw-cache-scope.js
└─ gen-seo.js

tests/
└─ pharmacy-smoke.mjs
```

Technology:

```text
Vanilla JavaScript
Native ES Modules
Three.js
Cloudflare Workers Static Assets
Playwright
```

No React.

No React Three Fiber.

No Vite SPA.

No Blender dependency requirement.

---

# 4. Architecture invariants — DO NOT BREAK

The redesign may change scene art aggressively, but must preserve these invariants.

## 4.1 Data

`public/tools.json` remains the **Single Source of Truth**.

Do not create:

```text
pharmacy-tools.json
tools-3d.json
projects.json
scene-projects.js
```

Scene-only spatial metadata is allowed.

---

## 4.2 Routing

Keep current hash routing.

Examples:

```text
/pharmacy/
/pharmacy/#/clinical
/pharmacy/#/gov
/pharmacy/#/clinical/vanco-auc-calc
```

Browser back / forward must continue working.

---

## 4.3 DOM vs WebGL

Preserve:

> WebGL = space / scene / visual interaction  
> DOM = readable information / navigation / cards / accessibility

Do not move essential tool descriptions into canvas-only content.

---

## 4.4 Fallback

WebGL failure must still fall back to the DOM tool browser.

Keep support for:

```text
?no3d=1
```

No blank screen.

---

## 4.5 Root zero-3D rule

Opening:

```text
/
```

must not download:

- Three.js
- world.js
- art.js
- pharmacy scene assets

The homepage remains fast and practical.

---

## 4.6 CSP

Do not loosen root CSP.

`/pharmacy/*` keeps its route-specific CSP.

Do not add:

```text
unsafe-eval
script-src *
connect-src *
script-src 'unsafe-inline'
```

No runtime external JS CDN.

---

## 4.7 Service Worker

Do not turn the 3D scene into precached portal shell.

The SW should continue protecting the main portal without owning the pharmacy scene as offline shell content.

---

## 4.8 CI

Existing checks must continue passing.

Do not remove or weaken:

- portal invariant checks
- CSP checks
- SEO checks
- SW ownership checks
- Three.js reproducible build
- WebGL smoke tests
- mobile smoke tests
- root zero-3D checks

---

# 5. Current implementation notes

`world.js` currently:

- creates renderer
- scene
- camera
- OrbitControls
- room/category hit areas
- tool markers
- labels
- raycasting
- category / tool focus
- lifecycle cleanup
- resize
- WebGL context loss fallback
- mobile camera presets

`art.js` currently:

- creates connected pharmacy floor
- shared walls / aisle
- Rx Hub
- pharmacist
- five zone art sets
- tool visual stands
- selection ring

`geometry.js` contains reusable primitives / helpers.

The redesign should prefer extending or replacing scene-art helpers rather than rewriting application logic.

---

# 6. Redesign goal

The main objective is:

> **Make the scene feel like a complete hospital pharmacy, not five decorated workstation zones.**

The user should see:

- pharmacy architecture
- believable workflow areas
- storage and dispensing
- clinical work
- medication safety
- education
- data systems
- central coordination

All five categories should still be distinguishable.

---

# 7. Target visual concept

Preferred concept:

> **Open-top modern hospital pharmacy / cutaway architectural model**

Think:

- complete pharmacy floor
- open walls
- clear functional rooms
- coherent architecture
- miniature / stylized 3D
- still readable from a 35–45° bird’s-eye camera

Avoid:

- isolated floating booths
- game-map islands
- cyberpunk
- futuristic control room
- photorealistic simulation
- hospital maze
- FPS / RPG visual language

---

# 8. Recommended pharmacy spatial layout

The redesign may change the exact current layout.

Recommended structure:

```text
┌───────────────────────────────────────┐
│                                       │
│   EBM / Teaching     Clinical Review  │
│   ┌─────────────┐   ┌──────────────┐ │
│   │ meeting room│   │ TDM / ICU    │ │
│   └─────────────┘   └──────────────┘ │
│                                       │
│      shared pharmacy work core        │
│            ┌──────────┐               │
│            │  Rx Hub  │               │
│            └──────────┘               │
│                                       │
│ Open Data       Medication Safety     │
│ ┌───────────┐   ┌────────────────┐   │
│ │ data lab  │   │ PV / DRP desk  │   │
│ └───────────┘   └────────────────┘   │
│                                       │
│        Dispensing / Internal Systems  │
│        shelves / counter / carts      │
└───────────────────────────────────────┘
```

This is conceptual, not mandatory.

The final scene should feel architecturally connected.

---

# 9. Pharmacy-wide shared elements

Add enough shared pharmacy infrastructure so the scene reads as one facility.

Recommended:

- dispensing counter
- medicine shelving
- modular storage bins
- unit-dose carts
- central workbench
- aisle / circulation
- partial walls
- pharmacy workstation clusters
- barcode / medication prep areas
- shared documentation / computer stations

Do not make every area visually independent.

---

# 10. Zone art direction

## 10.1 Clinical

Should read as:

> clinical pharmacy / ICU / therapeutic drug monitoring

Recommended:

- 2–3 clinical monitors
- infusion pump
- IV pole
- medication tray
- PK / AUC screen
- renal / lab visual
- dose review workstation
- chart / tablet

Avoid making it look like generic office IT.

---

## 10.2 EBM & Teaching

Should read as:

> journal club / evidence / clinical teaching

Recommended:

- meeting table
- chairs
- whiteboard
- forest plot
- evidence pyramid
- bookshelves
- laptop / presentation display
- journals

---

## 10.3 Medication Safety

Should read as:

> medication safety / pharmacovigilance

Recommended:

- ADR signal screen
- medication-pair review board
- warning / review console
- safety dashboard
- subtle signal indicators

Avoid military command-center aesthetics.

---

## 10.4 Open Data

Should read as:

> public health / government / pharmaceutical data lab

Recommended:

- Taiwan-style data map
- radar / surveillance display
- server racks
- database console
- graph screens
- data node indicators

Keep it clearly different from Clinical.

---

## 10.5 Internal Hospital Systems

Should read as:

> real hospital pharmacy operations

Recommended:

- dispensing counter
- medication shelves
- unit-dose bins
- barcode reader
- badge reader
- medication carts
- restricted workstation
- internal system terminal

This should be the strongest “real pharmacy” area.

---

# 11. Central Rx Hub

The Rx Hub should become the visual anchor of the pharmacy.

Recommended:

- larger central counter
- prominent Rx symbol
- pharmacist workstation
- one low-poly male pharmacist
- clear sightlines to all zones

The pharmacist remains:

- ambient
- non-interactive
- not player-controlled

No avatar system.

---

# 12. Character direction

Keep the existing visual philosophy:

- low-poly
- stylized
- Asian pharmacist
- white coat
- professional
- slightly cute
- not childish

Possible ambient characters:

- clinical pharmacist
- dispensing pharmacist
- teaching pharmacist

Do not exceed a small number.

No crowd simulation.

No walking NPC system unless explicitly approved later.

---

# 13. Materials

Preferred:

- matte plastic
- painted metal
- light wood
- paper
- soft screen emissive

Avoid:

- mirror
- chrome
- glossy floor
- heavy PBR
- complex transparency
- photorealistic reflections

The scene should remain light and fast.

---

# 14. Lighting

Keep lighting simple.

Preferred:

```text
HemisphereLight
DirectionalLight
soft shadows
screen emissive
```

Avoid:

- many PointLights
- bloom
- SSR
- SSAO
- reflection probes
- heavy postprocessing

---

# 15. Camera

Preserve existing app-level camera API.

The redesign may tune presets.

Requirements:

- overview shows the pharmacy clearly
- mobile remains readable
- category focus is clear
- no camera below floor
- no FPS movement
- no WASD

Preferred category tween:

```text
~600–900 ms
```

Reduced-motion mode remains near instant.

---

# 16. Mobile

Mobile remains a first-class requirement.

The redesign must not depend on tiny props.

On mobile:

Keep:

- pharmacy identity
- major work areas
- Rx Hub
- main pharmacist
- tool markers
- category labels

Reduce:

- small decorative props
- secondary chairs
- tiny medicine boxes
- unnecessary signage
- small cables / micro-details

Do not simply shrink the desktop scene.

---

# 17. Tool interaction

Tool markers should remain integrated into the pharmacy.

Preferred representations:

- monitor
- tablet
- workstation terminal
- counter terminal
- radar console
- review board

Avoid floating generic icons where possible.

Detailed tool content remains DOM-based.

---

# 18. Visual hierarchy

Priority order:

## Tier A — architecture

- complete pharmacy floor
- room boundaries
- circulation
- shared storage
- Rx Hub

## Tier B — functional identity

- Clinical equipment
- EBM room
- Safety console
- Data lab
- Dispensing / Internal zone

## Tier C — polish

- books
- medication bins
- small devices
- minor props
- decorative accents

Do not start with Tier C.

---

# 19. Performance philosophy

Do not over-optimize before the redesign stabilizes.

However, avoid obvious architectural performance mistakes.

Continue using:

- reusable geometry
- InstancedMesh
- geometry merge
- small material set
- procedural / CanvasTexture screens

Avoid:

- one mesh per pill box
- large PNG texture sets
- external model-heavy pipelines
- many unique materials

Current scene before redesign was lightweight:

```text
~60 draw calls
~4–5k triangles
```

The redesign may increase complexity substantially if justified.

Do not artificially constrain the scene to the old numbers.

Instead, report the new numbers honestly.

Phase 3 will optimize after visual approval.

---

# 20. External models

Current project does not depend on GLB.

For this redesign:

- procedural geometry remains preferred
- external GLB is not forbidden if genuinely useful
- but do not make the project dependent on Blender workflows

If adding a model:

- keep file size small
- document license
- keep local
- no runtime CDN

---

# 21. Desktop Codex workflow

This task is intentionally assigned to Desktop Codex because visual iteration is expected.

Recommended loop:

```text
edit scene
↓
run local server
↓
open desktop browser
↓
inspect
↓
adjust camera / scale / props
↓
test mobile viewport
↓
repeat
```

Frequent screenshot comparison is encouraged.

Do not wait until the end for visual review.

---

# 22. Suggested implementation stages

## Stage R1 — Pharmacy architecture

Build:

- full floor
- partial walls
- central aisle
- shared dispensing/storage architecture
- Rx Hub integration

Gate:

> Scene reads as one hospital pharmacy before labels.

---

## Stage R2 — Five zone identities

Add the defining visual language of each zone.

Gate:

> Without labels, the five functions are broadly distinguishable.

---

## Stage R3 — Pharmacy workflow detail

Add:

- shelving
- carts
- counters
- equipment
- workstation clusters
- medication storage

Gate:

> Scene feels operational rather than decorative.

---

## Stage R4 — Camera / lighting / visual polish

Tune:

- camera
- zone framing
- lighting
- labels
- selected state
- mobile scene density

Do not perform Phase 3 optimization yet.

---

# 23. Required screenshots during redesign

Produce:

1. desktop overview
2. desktop overview without labels
3. mobile overview
4. Clinical focus
5. EBM focus
6. Safety focus
7. Open Data focus
8. Internal focus

Optional:

9. side-by-side before / after

---

# 24. Testing during redesign

After major changes, run existing tests.

At minimum:

```text
npm ci
npm run check:three
npm run test:pharmacy
```

Also preserve existing portal checks.

Do not accept a visually improved scene that breaks:

- routing
- fallback
- CSP
- SW
- root portal
- mobile navigation

---

# 25. Explicit non-goals

Do not add:

- React
- R3F
- Drei
- Vite SPA
- backend
- database
- auth
- chatbot
- generative AI
- multiplayer
- physics
- collision system
- FPS controls
- RPG avatar
- VR / WebXR

Do not replace the root portal with the 3D view.

---

# 26. Current deployment / CI history

Phase 1 and Phase 2 work have already passed hosted GitHub Actions.

The project has validated:

- WebGL smoke
- mobile smoke
- CSP
- SEO
- SW ownership
- reproducible Three.js vendor build

A recent Cloudflare production deploy initially hit an internal platform error, then succeeded on retry.

Do not interpret that prior Cloudflare internal error as a repository defect.

---

# 27. Current homepage behavior

The root portal includes a secondary CTA:

```text
進入 3D 藥局 ↗
```

It should remain a normal HTML link.

The root homepage remains the practical tool directory.

Do not preload 3D assets from the homepage.

---

# 28. Success criteria for the redesign

The redesign is successful when:

- [ ] it clearly reads as a complete pharmacy
- [ ] five zones still remain understandable
- [ ] the pharmacy is visually coherent
- [ ] Rx Hub is a central anchor
- [ ] Internal looks like real hospital pharmacy operations
- [ ] Clinical looks like clinical pharmacy
- [ ] EBM reads as teaching / evidence
- [ ] Safety reads as medication safety
- [ ] Open Data reads as data surveillance / public data
- [ ] mobile remains usable
- [ ] tool navigation remains DOM-accessible
- [ ] Phase 1 tests continue to pass
- [ ] root portal remains unaffected
- [ ] no major architectural regression is introduced

---

# 29. Definition of Done for Desktop Codex handoff task

Do not consider the redesign done merely because:

> “the scene has more objects”

It is done when:

> **The current miniature portfolio scene has become a coherent, convincing, stylized hospital pharmacy environment while preserving the proven application architecture.**

---

# 30. Desktop Codex starting instruction

Use this as the initial task:

```text
Read this handoff document and the current repository before making changes.

Your task is a major visual redesign of `/pharmacy/` into a complete 3D hospital pharmacy.

Preserve the existing Phase 1 application architecture, routing, tools.json SSOT, CSP, SW, fallback behavior, CI, DOM navigation and world API.

You may substantially redesign scene art, layout, walls, pharmacy furniture, workflow areas, lighting, props and camera presets.

Start with Stage R1: pharmacy architecture only.

Do not start Phase 3 performance optimization or Phase 4 production hardening yet.

Run the existing tests after each major stage and show visual screenshots for review before moving to the next stage.
```
