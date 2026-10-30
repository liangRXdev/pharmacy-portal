import * as THREE from './vendor/three-lite.js';
import { createGeometryKit, createPharmacist } from './geometry.js';
import { createPharmacyArt } from './art.js';
import { createToolMarkers } from './tool-art.js';
import { FLOOR_PLAN, NAVIGATION_PLAN, resolveLayout } from './scene-layout.js';
import { validateNavigation } from './navigation.js';
import { measureWalkingProfile } from './pharmacist.js';

// Read actual mesh/instance matrices. AABBs conservatively enclose rotated props.
// No WebGL renderer, collision engine or second furniture catalogue is created.
export function readSceneBounds(scene) {
  scene.updateMatrixWorld(true);
  const bounds = [], transform = new THREE.Object3D(), vertex = new THREE.Vector3();
  scene.traverse(mesh => {
    if (!mesh.isMesh || !mesh.visible) return;
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    for (let i = 0; i < (mesh.isInstancedMesh ? mesh.count : 1); i++) {
      if (mesh.isInstancedMesh) mesh.getMatrixAt(i, transform.matrix);
      const item = { id: `${mesh.id}:${i}`, minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        vertex.set(x, y, z);
        if (mesh.isInstancedMesh) vertex.applyMatrix4(transform.matrix);
        vertex.applyMatrix4(mesh.matrixWorld);
        item.minX = Math.min(item.minX, vertex.x); item.maxX = Math.max(item.maxX, vertex.x);
        item.minY = Math.min(item.minY, vertex.y); item.maxY = Math.max(item.maxY, vertex.y);
        item.minZ = Math.min(item.minZ, vertex.z); item.maxZ = Math.max(item.maxZ, vertex.z);
      }
      bounds.push(item);
    }
  });
  return bounds;
}

export function measurePharmacist() {
  const scene = new THREE.Scene(), resources = [];
  try {
    const kit = createGeometryKit(scene, resources);
    createPharmacist(kit, 0, 0, .17); kit.flush();
    const bounds = readSceneBounds(scene);
    const x = Math.max(...bounds.flatMap(box => [Math.abs(box.minX), Math.abs(box.maxX)]));
    const z = Math.max(...bounds.flatMap(box => [Math.abs(box.minZ), Math.abs(box.maxZ)]));
    return { radius: Math.hypot(x, z), height: Math.max(...bounds.map(box => box.maxY)) - .17, floorY: .17, width: x * 2, depth: z * 2 };
  } finally { resources.forEach(resource => resource.dispose()); }
}

export function auditPharmacySpace(catalog, small = false) {
  const scene = new THREE.Scene(), resources = [];
  try {
    const markers = createToolMarkers(scene, resources, catalog.categories, catalog.tools);
    createPharmacyArt(scene, resources, { small, ...catalog, markers });
    const profile = measureWalkingProfile();
    // Ignore floor-level trim and objects entirely above the standing character.
    const obstacles = readSceneBounds(scene).filter(box => box.maxY > profile.floorY + .05 && box.minY < profile.floorY + profile.height);
    const areas = catalog.categories.map(({ id }) => {
      const { position: [x, , z], size } = resolveLayout(id);
      return { id, center: [x, z], size };
    });
    const report = validateNavigation(NAVIGATION_PLAN, obstacles, profile, FLOOR_PLAN, areas);
    return { profile, obstacles, areas, plan: NAVIGATION_PLAN, report, small };
  } finally { resources.forEach(resource => resource.dispose()); }
}
