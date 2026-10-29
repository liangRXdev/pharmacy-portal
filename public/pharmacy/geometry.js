import * as THREE from './vendor/three-lite.js';

export const PALETTE = {
  floor: '#eee6d8', wall: '#f8f4eb', wood: '#cbb18e', frame: '#657d7e',
  clinical: '#8eabb9', ebm: '#9eae91', adr: '#c59b79', gov: '#73a6a4', internal: '#97a6b0',
  paper: '#fffcf4', screen: '#273e48', teal: '#527f7b', skin: '#d4ab8d', hair: '#333c3e',
};

// One batch per shape/material, including all medicine boxes. No per-box draw calls.
export function createGeometryKit(scene, resources) {
  const geometries = new Map(), materials = new Map(), batches = new Map();
  const transform = new THREE.Object3D();
  function material(color, texture) {
    const key = texture || color;
    if (!materials.has(key)) {
      const mat = new THREE.MeshStandardMaterial({ color, map: texture || null, roughness: .88, metalness: .02 });
      if (texture) { mat.emissive.set('#ffffff'); mat.emissiveMap = texture; mat.emissiveIntensity = .12; }
      materials.set(key, mat);
      resources.push(mat);
    }
    return materials.get(key);
  }
  function shape(kind, size, position, color, rotation = [0, 0, 0], texture) {
    if (!geometries.has(kind)) {
      const geometry = kind === 'box' ? new THREE.BoxGeometry(1, 1, 1)
        : kind === 'sphere' ? new THREE.SphereGeometry(1, 8, 6) : new THREE.CylinderGeometry(1, 1, 1, 12);
      geometries.set(kind, geometry);
      resources.push(geometry);
    }
    const mat = material(color, texture);
    const key = `${kind}:${mat.id}`;
    if (!batches.has(key)) batches.set(key, { geometry: geometries.get(kind), material: mat, instances: [] });
    batches.get(key).instances.push({ size, position, rotation });
  }
  const box = (size, position, color, rotation, texture) => shape('box', size, position, color, rotation, texture);
  const cylinder = (size, position, color, rotation) => shape('cylinder', size, position, color, rotation);
  const sphere = (size, position, color) => shape('sphere', size, position, color);
  function flush() {
    for (const batch of batches.values()) {
      const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.instances.length);
      resources.push(mesh); // InstancedMesh owns GPU instance attributes as well.
      batch.instances.forEach((item, i) => {
        transform.position.set(...item.position);
        transform.scale.set(...item.size);
        transform.rotation.set(...item.rotation);
        transform.updateMatrix();
        mesh.setMatrixAt(i, transform.matrix);
      });
      mesh.computeBoundingSphere();
      scene.add(mesh);
    }
    batches.clear();
  }
  return { box, cylinder, sphere, flush };
}

// Screens are symbolic diagrams, with no patient data or invented statistics.
export function createScreenTexture(kind, resources) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 320;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = kind === 'ebm' ? PALETTE.paper : PALETTE.screen; ctx.fillRect(0, 0, 512, 320);
  ctx.strokeStyle = kind === 'ebm' ? PALETTE.teal : '#92c6bd'; ctx.fillStyle = kind === 'ebm' ? PALETTE.teal : '#b9dcd0'; ctx.lineWidth = 5;
  const line = (points) => { ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); };
  const title = text => { ctx.font = 'bold 36px sans-serif'; ctx.fillText(text, 28, 52); };
  if (kind === 'clinical') {
    title('AUC / TDM');
    line([[30, 245], [85, 242], [125, 210], [155, 112], [195, 135], [250, 185], [330, 224], [470, 245]]);
    ctx.globalAlpha = .4; line([[30, 270], [470, 270]]); ctx.globalAlpha = 1;
  } else if (kind === 'ebm') {
    title('EVIDENCE');
    line([[280, 80], [280, 290]]);
    for (const [y, x, width] of [[115, 290, 130], [168, 210, 170], [221, 250, 100]]) {
      line([[x - width / 2, y], [x + width / 2, y]]); ctx.fillRect(x - 9, y - 9, 18, 18);
    }
  } else if (kind === 'adr') {
    title('MEDICATION REVIEW'); ctx.strokeStyle = '#dfb477';
    line([[255, 90], [180, 230], [330, 230], [255, 90]]);
    line([[255, 130], [255, 180]]); ctx.fillStyle = '#dfb477'; ctx.fillRect(251, 198, 8, 8);
    for (let i = 0; i < 3; i++) ctx.fillRect(55 + i * 42, 265 - i * 17, 24, 20 + i * 17);
  } else if (kind === 'gov') {
    title('PUBLIC DATA');
    // Concentric surveillance rings, a broad sweep, Taiwan and public-data nodes.
    ctx.fillStyle = '#36575b';
    ctx.beginPath(); ctx.moveTo(178, 184); ctx.arc(178, 184, 104, -1.2, -.45); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#92c6bd'; ctx.fillStyle = '#b9dcd0';
    for (const r of [38, 72, 104]) { ctx.beginPath(); ctx.arc(178, 184, r, 0, Math.PI * 2); ctx.stroke(); }
    line([[178, 184], [215, 87]]);
    ctx.beginPath(); [[384, 72], [418, 93], [410, 149], [389, 207], [357, 268], [337, 285], [340, 229], [357, 161], [375, 109]].forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.closePath(); ctx.fill();
    for (const [x,y] of [[157,151], [213,205], [377,131], [365,188], [350,245]]) {
      ctx.fillStyle = '#dfb477'; ctx.beginPath(); ctx.arc(x,y,7,0,Math.PI*2); ctx.fill();
    }
  } else if (kind === 'internal') {
    title('HOSPITAL NETWORK'); ctx.strokeStyle = '#b9dcd0';
    ctx.strokeRect(220, 160, 78, 70); ctx.beginPath(); ctx.arc(259, 157, 26, Math.PI, 0); ctx.stroke();
    for (let i = 0; i < 15; i++) ctx.fillRect(35 + i * 8, 260, i % 3 + 2, 25);
  } else {
    ctx.font = 'bold 160px sans-serif'; ctx.fillText('Rx', 145, 185);
    ctx.font = '26px sans-serif'; ctx.fillText('Clinical Pharmacy Toolkit', 100, 235);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = 'srgb';
  resources.push(texture);
  return texture;
}

export function createDesk(kit, x, z, width = 2.6) {
  kit.box([width, .14, .85], [x, .68, z], PALETTE.wood);
  for (const dx of [-width / 2 + .12, width / 2 - .12]) kit.box([.12, .65, .65], [x + dx, .3, z], PALETTE.frame);
}
export function createMonitor(kit, x, z, texture, width = .85, y = 1.05) {
  kit.box([width, width * .63, .12], [x, y, z], PALETTE.frame);
  kit.box([width - .07, width * .63 - .07, .025], [x, y, z + .075], '#ffffff', undefined, texture);
  kit.box([.07, .25, .08], [x, y - .35, z], PALETTE.frame);
}
export function createShelf(kit, x, z, small) {
  kit.box([1.4, 1.65, .12], [x, .85, z - .18], PALETTE.wall);
  for (const dx of [-.72, .72]) kit.box([.1, 1.75, .48], [x + dx, .85, z], PALETTE.wood);
  const colors = [PALETTE.paper, '#c4d6dd', '#cad6bf', '#dfc8c3'];
  for (let row = 0; row < 4; row++) {
    const y = .22 + row * .4;
    kit.box([1.5, .07, .48], [x, y, z], PALETTE.wood);
    for (let col = 0; col < (small ? 5 : 8); col++) {
      const dx = -.58 + col * (small ? .29 : .165);
      kit.box([small ? .2 : .12, .25, .22], [x + dx, y + .16, z], colors[(row + col) % colors.length]);
    }
  }
}
export function createChair(kit, x, z) {
  kit.box([.42, .1, .42], [x, .38, z], PALETTE.teal);
  kit.box([.42, .42, .09], [x, .62, z - .2], PALETTE.teal);
  kit.box([.12, .38, .12], [x, .16, z], PALETTE.frame);
}
export function createPharmacist(source, x, z, baseY = 0) {
  const kit = {
    box: (size, [px, py, pz], ...rest) => source.box(size, [px, py + baseY, pz], ...rest),
    sphere: (size, [px, py, pz], ...rest) => source.sphere(size, [px, py + baseY, pz], ...rest),
  };
  for (const dx of [-.13, .13]) {
    kit.box([.16, .55, .2], [x + dx, .33, z], PALETTE.hair);
    kit.box([.2, .12, .32], [x + dx, .08, z + .05], PALETTE.hair);
  }
  kit.box([.52, .65, .32], [x, .91, z], PALETTE.paper);
  kit.box([.06, .44, .335], [x, .94, z], PALETTE.teal);
  kit.box([.12, .16, .02], [x + .15, 1.03, z + .17], PALETTE.clinical);
  kit.sphere([.23, .25, .22], [x, 1.47, z], PALETTE.skin);
  kit.box([.44, .13, .38], [x, 1.67, z - .025], PALETTE.hair);
  for (const dx of [-.34, .34]) {
    kit.box([.16, .45, .22], [x + dx, 1.02, z + .06], PALETTE.paper, [.35, 0, dx > 0 ? .16 : -.16]);
    kit.sphere([.095, .09, .09], [x + dx, .83, z + .17], PALETTE.skin);
  }
}


export function createInfusionStation(kit, x, z) {
  kit.cylinder([.04, 2.15, .04], [x, 1.2, z], PALETTE.frame);
  kit.box([.65, .05, .05], [x, 2.27, z], PALETTE.frame);
  kit.box([.37, .52, .16], [x - .25, 1.96, z], PALETTE.paper);
  kit.box([.27, .26, .025], [x - .25, 1.91, z + .09], PALETTE.clinical);
  kit.box([.04, .55, .035], [x - .25, 1.43, z], PALETTE.clinical);
  kit.box([.4, .5, .25], [x, 1.1, z + .05], PALETTE.paper);
  kit.box([.28, .24, .025], [x, 1.16, z + .19], PALETTE.screen);
  kit.box([.18, .035, .03], [x, 1.19, z + .21], PALETTE.clinical);
  kit.box([.65, .07, .5], [x, .19, z], PALETTE.frame);
}

export function createMedicationCart(kit, x, z) {
  kit.box([.65, .75, .48], [x, .65, z], PALETTE.internal);
  kit.box([.75, .07, .58], [x, 1.07, z], PALETTE.wood);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 2; col++) {
    kit.box([.25, .17, .035], [x - .15 + col * .3, .41 + row * .22, z + .26], PALETTE.paper);
    kit.box([.1, .025, .04], [x - .15 + col * .3, .43 + row * .22, z + .29], PALETTE.frame);
  }
  for (const dx of [-.23, .23]) for (const dz of [-.15, .15]) {
    kit.sphere([.08, .08, .08], [x + dx, .22, z + dz], PALETTE.frame);
  }
  kit.box([.1, .3, .08], [x + .36, 1.07, z], PALETTE.frame);
}
