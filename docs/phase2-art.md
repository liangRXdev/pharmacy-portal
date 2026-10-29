# Phase 2 art pass — Tier A

Based on merged Phase 1 (`0c8c31a`). No Phase 3 runtime quality system, dependencies,
external models, image files, routing changes, or deployment changes are included.

## Visuals

- Shared warm floor, lowered cutaway walls, muted accent strips and five zone labels.
- Central 12-sided Rx platform, workstation/sign and one static low-poly pharmacist in a white coat.
- Clinical monitoring desk with AUC diagrams, IV pole/pump and a small desktop medication tray.
- EBM discussion table/four chairs, paper-colored forest-plot board and desktop journal stack.
- Safety review/warning console, indicator posts and a medication-pair grid.
- Public-data radar/Taiwan diagram and two small server racks.
- Internal dispensing counter, four-layer medicine shelf, badge panel and hospital-network screen.
- Thinner tool terminals, hover scale/emissive feedback and one reusable selection ring.
- 750 ms ease-in-out camera transition; reduced-motion behavior and world public API are retained.
- No ambient animation was added; the pharmacist remains in an idle pose.

## Helpers and ownership

`geometry.js` provides `createGeometryKit`, `createDesk`, `createChair`, `createMonitor`,
`createShelf`, `createPharmacist` and `createScreenTexture`. `art.js` composes these
without copying tool names, descriptions or links. Spatial slot/palette changes live in
`scene-layout.js`. All tool metadata still comes from `/tools.json`.

The kit batches repeated art by primitive/material into InstancedMesh. Medicine boxes
are instances, not individual draw calls. Six generated CanvasTextures provide symbolic
screens; no patient records, real brands or fabricated clinical statistics are displayed.
Geometry, materials, textures and instance buffers join the existing world resource
registry and are disposed by its existing lifecycle, including partial-init failures.

## Measured cost

Same software Chromium/ANGLE/SwiftShader, ordinary overview, no selected tool:

| Viewport | Phase 1 calls | Phase 2 calls | Phase 1 triangles | Phase 2 triangles |
|---|---:|---:|---:|---:|
| Desktop 1280 × 900, DPR 1 | 39 | 70 | 468 | 3,624 |
| Mobile 390 × 844, device DPR 3 capped at 1.5 | 39 | 68 | 468 | 3,168 |

These are WebGL draw/triangle counters, not hardware FPS measurements. Selecting a tool
adds the shared selection-ring draw. Vendor gzip is 130,205 bytes (Phase 1: 128,106).

Narrow-screen scene creation omits tray/vials, journals, scanner and unit-dose details,
reduces shelf boxes from 32 to 20 and rack accents from five to three per rack. The five
hero props, pharmacist, hub, tool markers and DOM navigation remain. DPR caps are unchanged.
This is a simple art variant; dynamic/adaptive quality remains Phase 3 work.

## Validation and screenshots

Run `node tools/check-portal.js`, `npm run check:three`,
`node tools/check-sw-cache-scope.js` and `npm run test:pharmacy`.
The 11 Phase 1 smoke groups remain, with test-only art counters and expanded lifecycle
coverage for shared primitives, materials, textures and instance buffers.
Smoke screenshots are regenerated in `test-results/pharmacy-desktop.png` and
`test-results/pharmacy-mobile.png`. The implementation session also captured before/after
overviews and each focused zone in `/workspace/phase2-review/` (outside the checkout).

Local verification used system Chromium because the cloud environment restricts the
Playwright download host. No hosted CI was triggered and nothing was pushed or deployed.

Still manual: Android Chrome hardware usability, physical-device performance and a visual
review of zone recognition with labels hidden. Production Cloudflare verification remains
separate from this local art task.

## Deferred

Optional medication cart, evidence pyramid and Tier C decoration remain optional art work.
Phase 3 adaptive quality, idle frame pacing, debug/FPS UI, broader static merging and
hardware profiling have not been started. Keep those changes separate from this art pass.
