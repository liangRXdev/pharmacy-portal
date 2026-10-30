import * as THREE from './vendor/three-lite.js';
import { PALETTE as P } from './geometry.js';
import { resolveLayout, resolveToolPosition } from './scene-layout.js';

// The live world and spatial audit use the same placements and screen frames.
export function createToolMarkers(scene, resources, categories, tools) {
  const declared = new Set(categories.map(category => category.id));
  const indices = new Map(), markers = new Map();
  let overflowIndex = 0;
  for (const tool of tools) {
    const known = declared.has(tool.category) && resolveLayout(tool.category) !== resolveLayout('__overflow');
    const index = known ? (indices.get(tool.category) || 0) : overflowIndex++;
    indices.set(tool.category, index + 1);
    const geometry = new THREE.BoxGeometry(.65, .55, .12);
    const material = new THREE.MeshStandardMaterial({ color: '#365c64', roughness: .9 });
    resources.push(geometry, material);
    const marker = new THREE.Mesh(geometry, material);
    marker.position.set(...resolveToolPosition(known ? tool.category : '__overflow', index));
    marker.userData = { kind: 'tool', categoryId: tool.category, toolId: tool.id, index };
    markers.set(tool.id, marker);
    scene.add(marker);
  }
  return markers;
}

// Derive visual roles from SSOT tags; no second tool catalogue or copied descriptions.
function equipmentKind(tool) {
  const tags = new Set(tool.tags || []);
  if (tags.has('oxygen')) return 'oxygen';
  if (tags.has('infusion') || tags.has('TDM') || tags.has('IV')) return 'infusion';
  if (tags.has('AKI') || tags.has('acid-base')) return 'lab';
  if (tags.has('clinical-trial') || tags.has('pharmacovigilance')) return 'radar';
  if (tags.has('education') || tags.has('CASP')) return 'book';
  if (tags.has('appearance') || tags.has('drug-identification')) return 'capsule';
  if (tags.has('translation')) return 'language';
  if (tool.category === 'ebm' || tags.has('price-history')) return 'plot';
  if (tags.has('drug-interaction') || tags.has('perioperative')) return 'review';
  if (tool.category === 'gov') return 'database';
  return 'calculator';
}

function toolTexture(tool, index, kind, resources) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 384;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = P.screen; ctx.fillRect(0, 0, 512, 384);
  ctx.fillStyle = '#b9dcd0'; ctx.strokeStyle = '#b9dcd0'; ctx.lineWidth = 8;
  ctx.font = 'bold 50px sans-serif';
  ctx.fillText(String(index + 1).padStart(2, '0'), 24, 62);
  ctx.font = 'bold 28px sans-serif';
  const title = [...tool.nameZh];
  for (let row = 0; row < Math.ceil(title.length / 13); row++) ctx.fillText(title.slice(row * 13, row * 13 + 13).join(''), 24, 320 + row * 36);
  const line = points => {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  };
  // Symbolic equipment displays, never clinical results or fabricated measurements.
  if (kind === 'oxygen' || kind === 'capsule') {
    ctx.beginPath(); ctx.roundRect(220, 85, 80, 175, 38); ctx.stroke();
    line([[220, 172], [300, 172]]);
    if (kind === 'oxygen') { ctx.font = 'bold 32px sans-serif'; ctx.fillText('O₂', 234, 158); }
  } else if (kind === 'infusion') {
    line([[180, 100], [180, 215], [245, 215], [245, 120], [305, 120], [305, 245], [350, 245]]);
    ctx.strokeRect(270, 150, 70, 60);
  } else if (kind === 'book') {
    line([[255, 115], [175, 95], [175, 240], [255, 260], [335, 240], [335, 95], [255, 115], [255, 260]]);
  } else if (kind === 'radar') {
    for (const r of [40, 80]) { ctx.beginPath(); ctx.arc(260, 175, r, 0, Math.PI * 2); ctx.stroke(); }
    line([[260, 175], [315, 115]]);
  } else if (kind === 'plot') {
    line([[175, 100], [175, 255], [355, 255]]);
    line([[195, 225], [235, 185], [280, 203], [335, 120]]);
  } else if (kind === 'database') {
    for (let row = 0; row < 3; row++) {
      ctx.beginPath(); ctx.ellipse(260, 115 + row * 60, 78, 22, 0, 0, Math.PI * 2); ctx.stroke();
    }
    line([[182, 115], [182, 235]]); line([[338, 115], [338, 235]]);
  } else if (kind === 'language') {
    ctx.font = 'bold 60px sans-serif'; ctx.fillText('文 A', 175, 190);
    line([[185, 230], [330, 230], [310, 210]]);
  } else if (kind === 'lab') {
    line([[235, 95], [235, 145], [185, 245], [335, 245], [285, 145], [285, 95]]);
    line([[210, 200], [310, 200]]);
  } else {
    ctx.strokeRect(185, 100, 150, 155);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      ctx.fillRect(205 + col * 43, 125 + row * 43, kind === 'review' && row === col ? 22 : 10, 12);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = 'srgb';
  resources.push(texture);
  return texture;
}

export function createToolArt(kit, resources, markers, tools) {
  const byId = new Map(tools.map(tool => [tool.id, tool]));
  for (const [id, marker] of markers) {
    const tool = byId.get(id);
    const kind = equipmentKind(tool);
    const { x, y, z } = marker.position;
    const texture = toolTexture(tool, marker.userData.index, kind, resources);
    kit.box([.59, .47, .025], [x, y, z + .075], '#ffffff', undefined, texture);
    if (tool.category !== 'internal') {
      kit.box([.82, .12, .6], [x, .57, z], P.wood);
      kit.box([.62, .35, .4], [x, .34, z], P.wall);
    }
    kit.box([.12, .3, .12], [x, y - .4, z], P.frame);
    if (kind === 'infusion') {
      kit.cylinder([.025, 1.45, .025], [x + .42, .95, z], P.frame);
      kit.box([.22, .3, .14], [x + .42, 1.43, z], P.paper);
      kit.box([.16, .2, .025], [x + .42, 1.05, z + .08], P.clinical);
    } else if (kind === 'oxygen') {
      kit.cylinder([.15, .65, .15], [x + .42, .55, z], P.teal);
      kit.box([.15, .08, .1], [x + .42, .92, z], P.frame);
    } else if (kind === 'database' || kind === 'radar') {
      kit.box([.23, .6, .38], [x + .43, .45, z], P.frame);
      for (let row = 0; row < 3; row++) kit.box([.15, .03, .025], [x + .43, .3 + row * .15, z + .2], P.gov);
    } else if (kind === 'book') {
      kit.box([.28, .07, .3], [x + .4, .65, z], P.ebm);
      kit.box([.26, .04, .28], [x + .4, .71, z], P.paper);
    } else if (kind === 'capsule') {
      kit.box([.25, .22, .25], [x + .43, .72, z], P.paper);
      kit.sphere([.08, .04, .04], [x + .43, .86, z + .03], P.wood);
    }
  }
}
