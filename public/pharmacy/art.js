import * as THREE from './vendor/three-lite.js';
import { PALETTE as P, createGeometryKit, createScreenTexture, createDesk, createMonitor, createShelf, createChair, createPharmacist, createMedicationCart, createInfusionStation } from './geometry.js';
import { resolveLayout } from './scene-layout.js';

// Scene art only. Tool metadata and routing stay in the Phase 1 modules.
export function createPharmacyArt(scene, resources, { small, categories, markers }) {
  const kit = createGeometryKit(scene, resources);
  const screens = new Map();
  const screen = id => {
    if (!screens.has(id)) screens.set(id, createScreenTexture(id, resources));
    return screens.get(id);
  };
  // A single connected floor and calm circulation spine link the work environments.
  kit.box([1.3, .012, 10.7], [0, .154, .8], P.paper);
  kit.box([12, .012, 1.15], [0, .154, 2.65], P.paper);
  for (const side of [-1, 1]) kit.box([2.8, .012, 1], [side * 2.1, .154, .75], P.paper);
  kit.box([14.8, .65, .14], [0, .45, -6.8], P.wall);
  kit.box([.14, .45, 9], [7.25, .35, .8], P.wall);
  // Two shared shelving units reinforce pharmacy identity across the floor.
  createShelf(kit, -3.1, -3.7, small);
  createShelf(kit, 3.1, -3.7, small);
  kit.cylinder([1.65, .16, 1.65], [0, .13, 1], P.wood);
  kit.cylinder([1.52, .05, 1.52], [0, .235, 1], P.paper);
  kit.box([1.8, .14, .8], [-.15, .82, .15], P.wood);
  kit.box([1.6, .5, .65], [-.15, .5, .15], P.wall);
  createMonitor(kit, -.25, -.03, screen('hub'), 1.4, 1.35);
  createPharmacist(kit, .55, 1.25, .24);

  for (const { id } of categories) {
    if (!Object.hasOwn(P, id)) continue;
    const [x, , z] = resolveLayout(id).position;
    if (id === 'clinical') {
      createDesk(kit, x, z - 1.1);
      createMonitor(kit, x - .63, z - 1.15, screen(id), 1.05, 1.17);
      createMonitor(kit, x + .63, z - 1.15, screen(id), .9, 1.12);
      // The hanging bag/pump silhouette stays visible even on mobile.
      createInfusionStation(kit, x + 1.35, z - .65);
      if (!small) {
        kit.box([.5, .05, .35], [x + .4, .8, z - .6], P.paper);
        for (let i = 0; i < 3; i++) kit.cylinder([.05, .2, .05], [x + .25 + i * .15, .92, z - .6], P.teal);
      }
    } else if (id === 'ebm') {
      // Teaching board and a round discussion table, rather than another desk.
      createMonitor(kit, x, z - 1.4, screen(id), 2.3, 1.35);
      kit.cylinder([.68, .12, .68], [x, .7, z - .15], P.wood);
      kit.cylinder([.09, .65, .09], [x, .32, z - .15], P.frame);
      for (const [dx, dz] of [[-.95, -.25], [.95, -.25], [-.65, .55], [.65, .55]]) createChair(kit, x + dx, z + dz);
      if (!small) for (let i = 0; i < 3; i++) kit.box([.3, .04, .25], [x + .15, .8 + i * .045, z - .1], i === 1 ? P.ebm : P.paper);
    } else if (id === 'adr') {
      createDesk(kit, x, z - 1.15);
      createMonitor(kit, x, z - 1.2, screen(id), 2.35, 1.35);
      for (const [dx, color] of [[-1.4, '#cba55b'], [1.4, '#b77864']]) {
        kit.cylinder([.1, .12, .1], [x + dx, 1.1, z - 1], color);
        kit.box([.16, .75, .16], [x + dx, .65, z - 1], P.frame);
      }
      // Medication-pair review grid, a quiet reference to the safety tool.
      for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
        kit.box([.15, .15, .05], [x - 1.25 + col * .19, .9 + row * .19, z - .6], row === col ? P.adr : P.paper);
      }
    } else if (id === 'gov') {
      createDesk(kit, x, z - 1.1);
      createMonitor(kit, x - .1, z - 1.25, screen(id), 2.6, 1.55);
      // Two compact public-data racks; no real data or logos.
      for (const dx of [-1.5, 1.5]) {
        kit.box([.42, 1.35, .55], [x + dx, .65, z - 1.15], P.frame);
        for (let row = 0; row < (small ? 3 : 5); row++) kit.box([.28, .07, .025], [x + dx, .25 + row * .22, z - .86], P.gov);
      }
    } else if (id === 'internal') {
      // Neutral dispensing counter with a wood worktop and understated badge panel.
      kit.box([3.25, .6, .7], [x, .32, z + .2], P.wall);
      kit.box([3.4, .12, .85], [x, .67, z + .2], P.wood);
      createShelf(kit, x + .6, z - 1.4, small);
      createMonitor(kit, x - 1, z - 1.1, screen(id), .9, 1.2);
      kit.box([.18, .3, .08], [x + 1.5, .86, z + .5], P.internal);
      createMedicationCart(kit, x + 1.35, z + 1.15);
      kit.box([.18, .15, .24], [x - 1.4, .82, z + .2], P.frame, [.3, 0, 0]);
      if (!small) {
        for (let col = 0; col < 5; col++) kit.box([.45, .25, .3], [x - 1.1 + col * .55, .25, z + .57], P.internal);
      }
    }
  }
  for (const marker of markers.values()) {
    const { x, y, z } = marker.position;
    kit.box([.13, .45, .13], [x, y - .4, z], P.frame);
    kit.box([.46, .06, .42], [x, .22, z], P.wood);
    const id = Object.hasOwn(P, marker.userData.categoryId) ? marker.userData.categoryId : 'hub';
    kit.box([.44, .33, .025], [x, y + .05, z + .075], '#ffffff', undefined, screen(id));
  }
  kit.flush();
  // A single reusable selection frame; no extra mesh for every tool.
  const ringGeometry = new THREE.CylinderGeometry(.42, .42, .025, 16, 1, true);
  const ringMaterial = new THREE.MeshStandardMaterial({ color: P.teal, roughness: .9 });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  resources.push(ringGeometry, ringMaterial);
  ring.visible = false;
  scene.add(ring);
  return {
    selectMarker(marker) {
      ring.visible = Boolean(marker);
      if (marker) ring.position.set(marker.position.x, .28, marker.position.z);
    },
  };
}
