import { findRoute } from './navigation.js';

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const finitePoint = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);

// Start from the current point on a legal edge, considering both endpoints.
// Never snap to a nearest node or draw a shortcut across the pharmacy.
export function routeFromPosition(plan, position, destination) {
  if (!finitePoint(position)) throw new Error('Invalid journey position');
  const nodes = new Map(plan.nodes.map(node => [node.id, node.position]));
  if (!nodes.has(destination)) throw new Error('Unknown journey destination');
  let best = null;
  for (const [from, to] of plan.edges) {
    const a = nodes.get(from), b = nodes.get(to);
    const dx = b[0] - a[0], dz = b[1] - a[1], square = dx * dx + dz * dz;
    const t = ((position[0] - a[0]) * dx + (position[1] - a[1]) * dz) / square;
    if (t < -1e-8 || t > 1 + 1e-8 || distance(position, [a[0] + t * dx, a[1] + t * dz]) > 1e-6) continue;
    for (const endpoint of [from, to]) {
      const ids = findRoute(plan, endpoint, destination);
      if (!ids) continue;
      const points = [position.slice(), ...ids.map(id => nodes.get(id).slice())]
        .filter((p, index, all) => !index || distance(p, all[index - 1]) > 1e-8);
      const cost = points.slice(1).reduce((sum, p, index) => sum + distance(points[index], p), 0);
      if (!best || cost < best.distance - 1e-8) best = { points, distance: cost };
    }
  }
  if (!best) throw new Error('Journey is off the fixed routes or destination is unreachable');
  return best;
}

export function createJourney(plan, speed = 2.6) {
  if (!Number.isFinite(speed) || speed <= 0) throw new Error('Invalid journey speed');
  const start = plan.nodes.find(node => node.id === plan.start)?.position;
  if (!finitePoint(start)) throw new Error('Missing journey entrance');
  let position = start.slice(), destination = null, pending = [], revision = 0, travelled = 0, yaw = 0;
  const snapshot = () => ({ position: position.slice(), destination, moving: pending.length > 0, arrived: destination && !pending.length ? destination : null, revision, travelled, yaw });
  function request(next, instant = false) {
    const route = routeFromPosition(plan, position, next); // validate before changing state
    if (next !== destination || !pending.length) {
      destination = next; pending = route.points.slice(1); revision++;
    }
    if (instant) {
      position = plan.nodes.find(node => node.id === next).position.slice();
      pending = [];
    }
    return snapshot();
  }
  function advance(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Invalid journey time');
    let remaining = seconds * speed;
    while (pending.length && remaining > 0) {
      const next = pending[0], length = distance(position, next);
      const step = Math.min(length, remaining);
      if (length > 1e-10) {
        yaw = Math.atan2(next[0] - position[0], next[1] - position[1]);
        position = [position[0] + (next[0] - position[0]) * step / length, position[1] + (next[1] - position[1]) * step / length];
      }
      travelled += step; remaining -= step;
      if (length <= step + 1e-10) { position = next.slice(); pending.shift(); }
    }
    return snapshot();
  }
  return { request, advance, snapshot,
    cancel() { pending = []; destination = null; revision++; return snapshot(); },
  };
}
