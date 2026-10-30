import * as THREE from './vendor/three-lite.js';
import { PALETTE as P, createGeometryKit, createScreenTexture } from './geometry.js';
import { createArchitecture } from './architecture.js';
import { createToolArt } from './tool-art.js';
import { createZoneArt } from './zone-art.js';

// Scene art only. Tool metadata and routing stay in the Phase 1 modules.
export function createPharmacyArt(scene, resources, { small, categories, markers, tools }) {
  const kit = createGeometryKit(scene, resources);
  const screens = new Map();
  const screen = id => {
    if (!screens.has(id)) screens.set(id, createScreenTexture(id, resources));
    return screens.get(id);
  };
  createArchitecture(kit, screen, small);

  createZoneArt(kit, screen, small, categories);
  createToolArt(kit, resources, markers, tools);
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
      if (marker) ring.position.set(marker.position.x, marker.userData.categoryId === 'internal' ? 1.08 : .2, marker.position.z);
    },
  };
}
