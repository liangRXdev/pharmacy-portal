# Phase 2.5 — connected clinical pharmacy refinement

This pass builds on the existing Phase 2 Tier A scene. The checkout's Phase 2 files
were still uncommitted and remote main contained only the Phase 1 merge, so they
were preserved in place; no commit, branch-history rewrite, push or deployment occurred.
The pre-refinement pharmacy files and screenshots are in `/workspace/phase25-review/`.

## Changes

- Replaced five raised platforms and individual booth walls with flush work areas on
  one warm pharmacy floor. A light circulation spine, shared low perimeter walls and
  two medicine shelves tie the areas to the Rx Hub.
- Clinical retains the TDM workstation, with a larger bag/pole/pump silhouette and a
  dark pump display; no patient or bed scene.
- Open Data has a larger radar/Taiwan surveillance screen with a broad static sweep
  wedge and data-node points, retaining the two server racks. No animated sweep or
  continuous texture updates were added.
- Internal gains a six-bin medication cart and keeps its scanner visible on mobile;
  existing shelf, badge panel, dispensing counter and restricted semantics remain.
- Hub radius increases from 1.4 to 1.65 world units, with a wider counter, larger Rx
  sign and the same single non-interactive pharmacist. His vertical offset seats his
  feet on the slightly raised hub surface.
- EBM's forest-plot board/discussion table and Safety's warning console remain.
- Zone labels use smaller floor-plaque styling and gain contrast on focus. Essential
  navigation stays in the existing DOM category controls.

## Camera and cost

Mobile overview offset: `[19, 24, 28]` → `[17, 21.4, 25]` relative to the same target.
This reduces distance by approximately 10.7%, making the scene about 12.0% larger.
FOV, DPR caps, touch handling, bottom navigation and bottom sheet are unchanged.
Desktop camera and category/tool focus behavior are unchanged.

Same desktop/mobile viewports and software Chromium/ANGLE/SwiftShader as Phase 2:

| Overview | Calls before | Calls after | Triangles before | Triangles after |
|---|---:|---:|---:|---:|
| Desktop 1280 × 900 | 70 | 62 | 3,624 | 5,060 |
| Mobile 390 × 844, DPR capped at 1.5 | 68 | 60 | 3,168 | 4,328 |

Removing per-booth walls offsets the new shared props' draw cost. The existing
InstancedMesh kit batches all added art by primitive/material. Screen textures remain
six generated canvases; no texture files, dependencies or vendor changes were needed.
These are frame draw/triangle counts, not physical-device FPS measurements.

## Validation

All 11 existing Phase 1/2 smoke groups pass, including actual WebGL pixels, mobile
pinch/navigation/sheet, camera focus, routing/history, safe links, fallback, context
loss, resource cleanup, portal search/offline behavior, SW scope and zero CSP errors.
Existing portal checks, reproducible vendor build, SW ownership and SEO checks pass.
Root portal, tools.json, main.js, CSP, SW, CI, dependency files and world public API
remain unchanged. No test expectations were changed for this refinement.

Artifacts outside the checkout (`/workspace/phase25-review/`):

- `after-desktop.png`: desktop overview
- `after-desktop-no-labels.png`: desktop overview with text labels hidden
- `after-mobile.png`: mobile overview
- `after-clinical.png`: focused Clinical
- `after-gov.png`: focused Open Data

The same directory contains `before-*` screenshots and additional focused zones.

## Deferred/manual

Real Android Chrome hardware and physical-device performance remain manual checks.
A human should confirm the label-free image communicates the intended five environments
and overall pharmacy cohesion. Production headers remain a separate authorized
post-deployment check. Phase 3 adaptive quality, frame pacing, backend/routing work,
Tier C decoration and extra characters have not been started.
