// Fixed route graph only: no physics, free walking or animation in this module.
const point = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
const length = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function graphOf(plan) {
  if (!plan || !Array.isArray(plan.nodes) || !plan.nodes.length || !Array.isArray(plan.edges) || !plan.edges.length) throw new Error('Missing navigation graph');
  const nodes = new Map(), adjacent = new Map(), seen = new Set();
  for (const node of plan.nodes) {
    if (typeof node.id !== 'string' || !node.id || nodes.has(node.id) || !point(node.position)) throw new Error('Invalid or duplicate navigation node');
    nodes.set(node.id, node.position); adjacent.set(node.id, []);
  }
  for (const edge of plan.edges) {
    if (!Array.isArray(edge) || edge.length !== 2) throw new Error('Invalid navigation edge');
    const [from, to] = edge;
    const key = [from, to].sort().join('\0');
    if (!nodes.has(from) || !nodes.has(to) || from === to || seen.has(key) || !length(nodes.get(from), nodes.get(to))) throw new Error('Unknown, duplicate or zero-length navigation edge');
    seen.add(key);
    adjacent.get(from).push(to); adjacent.get(to).push(from);
  }
  return { nodes, adjacent };
}

export function findRoute(plan, from, to) {
  const { nodes, adjacent } = graphOf(plan);
  if (!nodes.has(from) || !nodes.has(to)) throw new Error('Unknown route endpoint');
  const remaining = new Set(nodes.keys()), distances = new Map([[from, 0]]), previous = new Map();
  while (remaining.size) {
    let current, best = Infinity;
    for (const id of remaining) if ((distances.get(id) ?? Infinity) < best) { current = id; best = distances.get(id); }
    if (current === undefined) return null;
    if (current === to) {
      const route = [to];
      while (route[0] !== from) route.unshift(previous.get(route[0]));
      return route;
    }
    remaining.delete(current);
    for (const next of adjacent.get(current)) {
      if (!remaining.has(next)) continue;
      const cost = best + length(nodes.get(current), nodes.get(next));
      if (cost < (distances.get(next) ?? Infinity)) { distances.set(next, cost); previous.set(next, current); }
    }
  }
  return null;
}

function intersectsBox(a, b, box) {
  let start = 0, end = 1;
  for (const [axis, low, high] of [[0, box.minX, box.maxX], [1, box.minZ, box.maxZ]]) {
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-12) { if (a[axis] < low || a[axis] > high) return false; continue; }
    const lo = (low - a[axis]) / delta, hi = (high - a[axis]) / delta;
    start = Math.max(start, Math.min(lo, hi)); end = Math.min(end, Math.max(lo, hi));
    if (start > end) return false;
  }
  return true;
}
const pointBoxDistance = (p, box) => Math.hypot(Math.max(box.minX - p[0], 0, p[0] - box.maxX), Math.max(box.minZ - p[1], 0, p[1] - box.maxZ));
function pointSegmentDistance(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}

export function segmentBoxDistance(a, b, box) {
  if (!point(a) || !point(b) || !box || !['minX', 'maxX', 'minZ', 'maxZ'].every(key => Number.isFinite(box[key])) || box.minX > box.maxX || box.minZ > box.maxZ) throw new Error('Invalid segment or obstacle bounds');
  if (intersectsBox(a, b, box)) return 0;
  const corners = [[box.minX, box.minZ], [box.minX, box.maxZ], [box.maxX, box.minZ], [box.maxX, box.maxZ]];
  return Math.min(pointBoxDistance(a, box), pointBoxDistance(b, box), ...corners.map(p => pointSegmentDistance(p, a, b)));
}

export function validateNavigation(plan, obstacles, profile, floor, areas) {
  const issues = [];
  let graph;
  try { graph = graphOf(plan); } catch (error) { return { ok: false, issues: [error.message] }; }
  if (!profile || !Number.isFinite(profile.radius) || profile.radius <= 0 || !Number.isFinite(profile.height) || profile.height <= 0 || !Number.isFinite(plan.clearance) || plan.clearance < 0) issues.push('Invalid character profile or clearance');
  if (!floor || !Number.isFinite(floor.width) || floor.width <= 0 || !Number.isFinite(floor.depth) || floor.depth <= 0 || !Number.isFinite(floor.centerZ)) issues.push('Invalid floor');
  if (!Array.isArray(obstacles) || !obstacles.length || !obstacles.every(box => box && ['minX', 'maxX', 'minZ', 'maxZ'].every(key => Number.isFinite(box[key])) && box.minX <= box.maxX && box.minZ <= box.maxZ)) issues.push('Missing or invalid scene obstacles');
  if (!Array.isArray(areas) || !areas.length || !areas.every(area => typeof area.id === 'string' && point(area.center) && point(area.size) && area.size.every(size => size > 0))) issues.push('Invalid category areas');
  else if (!plan.stops || Array.isArray(plan.stops) || areas.some(({ id }) => !Object.hasOwn(plan.stops, id) || !graph.nodes.has(plan.stops[id]))) issues.push('Missing category stop');
  else if (new Set(areas.map(({ id }) => plan.stops[id])).size !== areas.length) issues.push('Category stops must be distinct');
  if (!graph.nodes.has(plan.start)) issues.push('Missing entrance node');
  if (issues.length) return { ok: false, issues };
  for (const { id, center, size } of areas) {
    const stop = graph.nodes.get(plan.stops[id]);
    const approachDistance = Math.hypot(Math.max(Math.abs(stop[0] - center[0]) - size[0] / 2, 0), Math.max(Math.abs(stop[1] - center[1]) - size[1] / 2, 0));
    if (approachDistance > profile.radius + plan.clearance) issues.push(`${id}: stop outside work area approach`);
  }
  const checkedEdges = [];
  for (const [from, to] of plan.edges) {
    const a = graph.nodes.get(from), b = graph.nodes.get(to);
    let clearance = Math.min(...[a, b].flatMap(([x, z]) => [floor.width / 2 - Math.abs(x), z - floor.centerZ + floor.depth / 2, floor.centerZ + floor.depth / 2 - z])) - profile.radius;
    if (clearance + 1e-8 < plan.clearance) issues.push(`${from} -> ${to}: floor boundary`);
    for (const box of obstacles) {
      const gap = segmentBoxDistance(a, b, box) - profile.radius;
      clearance = Math.min(clearance, gap);
      if (gap + 1e-8 < plan.clearance) issues.push(`${from} -> ${to}: obstacle ${box.id}`);
    }
    checkedEdges.push({ from, to, length: length(a, b), clearance });
  }
  for (const id of graph.nodes.keys()) if (!findRoute(plan, plan.start, id)) issues.push(`Unreachable node: ${id}`);
  return { ok: !issues.length, issues, checkedEdges, minimumClearance: Math.min(...checkedEdges.map(edge => edge.clearance)) };
}
