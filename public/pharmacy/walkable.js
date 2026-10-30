import { segmentBoxDistance } from './navigation.js';

const valid = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// A clearance-aware floor graph. Exact endpoints and every straight segment are
// checked against the character's swept volume; the grid never snaps a click.
export function createWalkable({ floor, obstacles, profile, plan, step = .3 }) {
  if (!floor || ![floor.width, floor.depth, floor.centerZ, profile?.radius, plan?.clearance, step].every(Number.isFinite)
    || floor.width <= 0 || floor.depth <= 0 || profile.radius <= 0 || plan.clearance < 0 || step <= 0
    || !Array.isArray(obstacles) || !obstacles.length || !obstacles.every(b => b && ['minX','maxX','minZ','maxZ'].every(k => Number.isFinite(b[k])) && b.minX <= b.maxX && b.minZ <= b.maxZ)) throw new Error('Missing or invalid walkable space');
  const radius = profile.radius + plan.clearance;
  const limits = [-floor.width / 2 + radius, floor.width / 2 - radius, floor.centerZ - floor.depth / 2 + radius, floor.centerZ + floor.depth / 2 - radius];
  const inside = p => valid(p) && p[0] >= limits[0] && p[0] <= limits[1] && p[1] >= limits[2] && p[1] <= limits[3];
  function clear(a, b) {
    if (!inside(a) || !inside(b)) return false;
    const minX = Math.min(a[0], b[0]) - radius, maxX = Math.max(a[0], b[0]) + radius;
    const minZ = Math.min(a[1], b[1]) - radius, maxZ = Math.max(a[1], b[1]) + radius;
    return obstacles.every(box => box.minX > maxX || box.maxX < minX || box.minZ > maxZ || box.maxZ < minZ || segmentBoxDistance(a, b, box) >= radius - 1e-8);
  }
  const points = [], links = [], grid = new Map(), edgeCache = new Map();
  const add = p => { points.push(p); links.push(new Set()); return points.length - 1; };
  const join = (a,b) => { if (clear(points[a], points[b])) { links[a].add(b); links[b].add(a); } };
  for (let x = 0; limits[0] + x * step <= limits[1]; x++) for (let z = 0; limits[2] + z * step <= limits[3]; z++) {
    const p = [limits[0] + x * step, limits[2] + z * step];
    if (clear(p,p)) grid.set(`${x},${z}`, add(p));
  }
  for (const [key, id] of grid) {
    const [x,z] = key.split(',').map(Number);
    for (const [dx,dz] of [[0,1],[1,0],[1,1],[1,-1]]) {
      const other = grid.get(`${x+dx},${z+dz}`); if (other !== undefined) {
        // Lazy edge validation avoids checking unused parts of the pharmacy.
        links[id].add(other); links[other].add(id);
      }
    }
  }
  const named = new Map();
  for (const node of plan.nodes) {
    if (!clear(node.position,node.position)) throw new Error('Blocked navigation stop');
    const id = add(node.position.slice()); named.set(node.id,id);
    for (let other = 0; other < id; other++) if (distance(points[id],points[other]) <= step * 3) join(id,other);
  }
  for (const [a,b] of plan.edges) {
    if (!named.has(a) || !named.has(b) || !clear(points[named.get(a)],points[named.get(b)])) throw new Error('Invalid fallback corridor');
    join(named.get(a),named.get(b));
  }
  const edgeClear = (a,b) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (!edgeCache.has(key)) edgeCache.set(key,clear(points[a],points[b]));
    return edgeCache.get(key);
  };
  function route(start, end) {
    if (!clear(start,start) || !clear(end,end)) return null;
    if (clear(start,end)) return { points: [start.slice(),end.slice()], distance: distance(start,end) };
    const starts = [], ends = new Set();
    for (let i = 0; i < points.length; i++) {
      if (distance(start,points[i]) <= step * 3 && clear(start,points[i])) starts.push(i);
      if (distance(end,points[i]) <= step * 3 && clear(end,points[i])) ends.add(i);
    }
    const open = new Set(starts), costs = new Map(starts.map(i => [i,distance(start,points[i])])), previous = new Map();
    let finish;
    while (open.size) {
      let current, best = Infinity;
      for (const id of open) {
        const score = costs.get(id) + distance(points[id],end);
        if (score < best) { current = id; best = score; }
      }
      if (ends.has(current)) { finish = current; break; }
      open.delete(current);
      for (const next of links[current]) {
        if (!edgeClear(current,next)) continue;
        const cost = costs.get(current) + distance(points[current],points[next]);
        if (cost < (costs.get(next) ?? Infinity) - 1e-8) { costs.set(next,cost); previous.set(next,current); open.add(next); }
      }
    }
    if (finish === undefined) return null;
    const ids = [finish]; while (previous.has(ids[0])) ids.unshift(previous.get(ids[0]));
    const raw = [start,...ids.map(id => points[id]),end], smooth = [start.slice()];
    for (let i = 0; i < raw.length - 1;) {
      let next = raw.length - 1; while (next > i + 1 && !clear(raw[i],raw[next])) next--;
      smooth.push(raw[next].slice()); i = next;
    }
    return { points: smooth, distance: smooth.slice(1).reduce((sum,p,i) => sum + distance(smooth[i],p),0) };
  }
  return { route, clear, contains: p => clear(p,p), point: id => named.has(id) ? points[named.get(id)].slice() : undefined, nodeCount: points.length };
}
