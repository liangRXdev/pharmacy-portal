import * as THREE from './vendor/three-lite.js';
import { FLOOR_PLAN, resolveLayout } from './scene-layout.js';

// One framing definition for live views and visual/occlusion checks.
// Static views and the actor-relative travel view share the same fit calculation.
export function cameraFrame({ mode, categoryId, marker, actor, aspect, fov, small }) {
  let center, size, direction;
  if (mode === 'overview') {
    center = [0, 1.1, FLOOR_PLAN.centerZ]; size = [FLOOR_PLAN.width, 2.8, FLOOR_PLAN.depth];
    direction = [.55, 1.05, 1.25];
  } else if (mode === 'hub') {
    center = actor ? [actor.x, 1, actor.z] : [0, 1, 1.6]; size = [4.2, 2.3, 4.1]; direction = [.48, .55, 1];
  } else if (mode === 'travel') {
    center = [actor.x, 1.05, actor.z]; size = [4.8, 2.7, 4.2]; direction = [.12, .95, 1.2];
  } else if (mode === 'tool' && marker) {
    center = [marker.x, marker.y, marker.z]; size = [3.2, 2.5, 2.8]; direction = [.8, 1.8, 1.2];
  } else {
    const layout = resolveLayout(categoryId);
    center = [layout.position[0], 1.2, layout.position[2]];
    size = [layout.size[0], 2.8, layout.size[1]]; direction = [.42, .9, 1.2];
  }
  const target = new THREE.Vector3(...center), dir = new THREE.Vector3(...direction).normalize();
  const right = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
  const up = dir.clone().cross(right).normalize();
  const tanV = Math.tan(fov * Math.PI / 360), tanH = tanV * aspect;
  const padding = mode === 'overview' ? .94 : mode === 'tool' && small ? .7 : .88;
  let distance = 5;
  for (const x of [-.5, .5]) for (const y of [-.5, .5]) for (const z of [-.5, .5]) {
    const offset = new THREE.Vector3(x * size[0], y * size[1], z * size[2]);
    distance = Math.max(distance, offset.dot(dir) + Math.abs(offset.dot(right)) / (tanH * padding), offset.dot(dir) + Math.abs(offset.dot(up)) / (tanV * padding));
  }
  // Keep the selected device away from the desktop side panel / mobile sheet.
  if (mode === 'overview') target.addScaledVector(up, -.8);
  if (mode === 'tool') {
    if (small) target.addScaledVector(up, -distance * tanV * .42);
    else target.addScaledVector(right, distance * tanH * .32);
  }
  return { target, position: target.clone().addScaledVector(dir, distance) };
}
