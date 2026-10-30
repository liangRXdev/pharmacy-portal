import * as THREE from './vendor/three-lite.js';
import { createGeometryKit, createPharmacist } from './geometry.js';

export const GAIT = { leg: .24, arm: .08, bob: .022 };

export function createWalkingPharmacist(scene, resources) {
  const root = new THREE.Object3D(), bones = new Map(), kits = [];
  root.name = 'walking-pharmacist'; scene.add(root);
  const body = createGeometryKit(root, resources); kits.push(body);
  body.part = (name, pivot) => {
    const bone = new THREE.Object3D(); bone.name = name; bone.position.set(...pivot); root.add(bone);
    const kit = createGeometryKit(bone, resources); kits.push(kit); bones.set(name, bone);
    const local = position => position.map((value, i) => value - pivot[i]);
    return { box: (size, position, ...rest) => kit.box(size, local(position), ...rest),
      sphere: (size, position, ...rest) => kit.sphere(size, local(position), ...rest) };
  };
  createPharmacist(body, 0, 0);
  kits.forEach(kit => kit.flush());
  root.position.y = .17;
  return { root, bones,
    pose({ position, yaw = 0, moving = false, travelled = 0 }) {
      const wave = moving ? Math.sin(travelled * 4.2) : 0;
      root.position.set(position[0], .17 + (moving ? .01 + .012 * Math.abs(wave) : 0), position[1]);
      root.rotation.y = yaw;
      bones.get('leg-left').rotation.x = wave * GAIT.leg;
      bones.get('leg-right').rotation.x = -wave * GAIT.leg;
      bones.get('arm-left').rotation.x = -wave * GAIT.arm;
      bones.get('arm-right').rotation.x = wave * GAIT.arm;
    },
  };
}

// Exact extrema for every geometry-bound corner over the continuous limb angle
// interval; yaw preserves horizontal radius. No sparse gait sampling is used.
export function measureWalkingProfile() {
  const scene = new THREE.Scene(), resources = [];
  try {
    const avatar = createWalkingPharmacist(scene, resources);
    scene.updateMatrixWorld(true);
    const transform = new THREE.Object3D(), vertex = new THREE.Vector3();
    let maxX = 0, maxZ = 0, top = 0;
    avatar.root.traverse(mesh => {
      if (!mesh.isMesh) return;
      const bone = mesh.parent, amplitude = bone.name.startsWith('leg-') ? GAIT.leg : bone.name.startsWith('arm-') ? GAIT.arm : 0;
      const pivot = bone === avatar.root ? new THREE.Vector3(0, .17, 0) : bone.getWorldPosition(new THREE.Vector3());
      mesh.geometry.computeBoundingBox(); const box = mesh.geometry.boundingBox;
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, transform.matrix);
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
          vertex.set(x, y, z).applyMatrix4(transform.matrix).applyMatrix4(mesh.matrixWorld);
          const dy = vertex.y - pivot.y, dz = vertex.z - pivot.z;
          const angles = [-amplitude, amplitude, 0];
          for (const base of [Math.atan2(dy, dz), Math.atan2(-dz, dy)]) for (let k = -2; k <= 2; k++) {
            const angle = base + k * Math.PI;
            if (angle >= -amplitude && angle <= amplitude) angles.push(angle);
          }
          maxX = Math.max(maxX, Math.abs(vertex.x));
          for (const angle of angles) {
            maxZ = Math.max(maxZ, Math.abs(pivot.z + dy * Math.sin(angle) + dz * Math.cos(angle)));
            top = Math.max(top, pivot.y + dy * Math.cos(angle) - dz * Math.sin(angle));
          }
        }
      }
    });
    return { radius: Math.hypot(maxX, maxZ), width: maxX * 2, depth: maxZ * 2, height: top - .17 + GAIT.bob, floorY: .17 };
  } finally { resources.forEach(resource => resource.dispose()); }
}
