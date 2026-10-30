import { readFile } from 'node:fs/promises';

// The browser's .js ES module also loads under Node with this CommonJS package.
// Read the exact source explicitly as ESM, without changing package-wide module rules.
const source = await readFile(new URL('../public/pharmacy/scene-layout.js', import.meta.url));
const { FLOOR_PLAN, CIRCULATION_PREVIEW, SCENE_LAYOUT, resolveToolPosition } =
  await import(`data:text/javascript;base64,${source.toString('base64')}`);

// Review artifact only. Spatial coordinates match the scene; names come from tools.json.
export function createLayoutPreview(catalog, audit) {
  const scale = 32, left = 66, top = 112;
  const px = x => left + (x + FLOOR_PLAN.width / 2) * scale;
  const py = z => top + (z - FLOOR_PLAN.centerZ + FLOOR_PLAN.depth / 2) * scale;
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
  const rect = (x, z, w, d, fill, extra = '') => `<rect x="${px(x - w / 2)}" y="${py(z - d / 2)}" width="${w * scale}" height="${d * scale}" fill="${fill}" ${extra}/>`;
  const parts = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="760" height="880" viewBox="0 0 760 880">',
    '<rect width="760" height="880" fill="#f5f0e8"/>',
    '<g font-family="Noto Sans TC, sans-serif" fill="#2e4f4f">',
    `<text x="66" y="42" font-size="24" font-weight="700">${audit ? 'R3 路線、停靠點與轉向淨空' : 'R2 藥局配置與候選通道'}</text>`,
    '<text x="66" y="73" font-size="14">前側入口 → Rx Hub 環路 → 五個工作區</text>',
    rect(0, FLOOR_PLAN.centerZ, FLOOR_PLAN.width, FLOOR_PLAN.depth, '#eee6d8', 'stroke="#657d7e" stroke-width="3"'),
  ];
  for (const category of catalog.categories) {
    const layout = SCENE_LAYOUT[category.id];
    if (!layout?.surface) continue;
    const [x, , z] = layout.position, [w, d] = layout.size;
    parts.push(rect(x, z, w, d, layout.surface, `stroke="${layout.color}" stroke-width="2"`));
  }
  for (const { position: [x, z], size: [w, d] } of CIRCULATION_PREVIEW) {
    parts.push(rect(x, z, w, d, '#fffcf4'));
    const [x1, z1, x2, z2] = w > d ? [x - w / 2, z, x + w / 2, z] : [x, z - d / 2, x, z + d / 2];
    if (!audit) parts.push(`<path d="M ${px(x1)} ${py(z1)} L ${px(x2)} ${py(z2)}" stroke="#527f7b" stroke-width="2" stroke-dasharray="7 5"/>`);
  }
  parts.push(rect(0, 1.8, 3.5, 3.4, '#cbb18e', 'stroke="#657d7e" stroke-width="2"'));
  parts.push(`<text x="${px(0)}" y="${py(1.8)}" text-anchor="middle" font-size="17" font-weight="700">Rx Hub</text>`);
  if (audit) {
    for (const box of audit.obstacles) parts.push(rect((box.minX + box.maxX) / 2, (box.minZ + box.maxZ) / 2, box.maxX - box.minX, box.maxZ - box.minZ, '#657d7e', 'opacity=".24"'));
    const nodes = new Map(audit.plan.nodes.map(node => [node.id, node.position]));
    for (const [a, b] of audit.plan.edges) {
      const p = nodes.get(a), q = nodes.get(b);
      parts.push(`<path d="M ${px(p[0])} ${py(p[1])} L ${px(q[0])} ${py(q[1])}" stroke="#2e4f4f" stroke-width="3"/>`);
    }
    for (const { id, position: [x, z] } of audit.plan.nodes) {
      parts.push(`<circle cx="${px(x)}" cy="${py(z)}" r="3" fill="#2e4f4f"/>`);
      const categoryIndex = catalog.categories.findIndex(category => audit.plan.stops[category.id] === id);
      if (categoryIndex >= 0 || id === 'hub' || id === 'entrance') {
        parts.push(`<circle cx="${px(x)}" cy="${py(z)}" r="${(audit.profile.radius + audit.plan.clearance) * scale}" fill="#fffcf4" fill-opacity=".8" stroke="#2e4f4f" stroke-width="2"/>`);
        parts.push(`<text x="${px(x)}" y="${py(z) + 5}" text-anchor="middle" font-size="14" font-weight="700">${categoryIndex >= 0 ? categoryIndex + 1 : id === 'hub' ? 'Rx' : '入'}</text>`);
      }
    }
  }
  for (const category of catalog.categories) {
    const layout = SCENE_LAYOUT[category.id];
    if (!layout?.surface) continue;
    const [x, , z] = layout.position;
    const tools = catalog.tools.filter(tool => tool.category === category.id);
    const labelZ = category.id === 'internal' ? 10.9 : z - 1.55;
    const labelX = audit && category.id === 'internal' ? -5.6 : x;
    parts.push(`<text x="${px(labelX)}" y="${py(labelZ)}" text-anchor="middle" font-size="16" font-weight="700">${audit ? catalog.categories.indexOf(category) + 1 + '. ' : ''}${escape(category.label)} · ${tools.length}</text>`);
    tools.forEach((tool, i) => {
      const [tx, , tz] = resolveToolPosition(category.id, i);
      parts.push(rect(tx, tz, .65, .55, '#527f7b'));
    });
  }
  parts.push(`<text x="${px(0)}" y="${py(audit ? 12.55 : 11.6)}" text-anchor="middle" font-size="16">入口</text>`);
  parts.push(`<text x="66" y="803" font-size="14">${audit ? '實線：固定路線　灰色：實際模型保守障礙邊界' : '虛線：預留動線　小方塊：22 項工具設備'}</text>`);
  parts.push(`<text x="66" y="831" font-size="14">${audit ? `外圈：單人轉向＋${audit.plan.clearance} 淨空；全路網最小障礙淨空 ${audit.report.minimumClearance.toFixed(3)}` : '此圖是 R2 空間配置草圖；R3 才定案路線與停靠點。'}</text>`);
  parts.push('</g></svg>');
  return parts.join('\n');
}
