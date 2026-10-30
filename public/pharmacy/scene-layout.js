// Spatial metadata only. Names, URLs and descriptions belong in /tools.json.
export const FLOOR_PLAN = { width: 19.6, depth: 20, centerZ: 2 };
// Circulation surfaces; the R3 navigation graph below limits actual destinations.
export const CIRCULATION_PREVIEW = [
  { position: [0, 7.65], size: [2.6, 8.1] },
  { position: [-2.5, 1.5], size: [1.6, 7.8] },
  { position: [2.5, 1.5], size: [1.6, 7.8] },
  { position: [0, -2.4], size: [17, 1.6] },
  { position: [0, 5.4], size: [17, 1.6] },
  { position: [0, -5], size: [2.6, 5.8] },
  { position: [-5.6, 4.9], size: [1.6, 1.6] },
  { position: [5.6, 4.2], size: [1.6, 1.6] },
];
// Spatial data only. Static planning in R3; character movement is added in R5.
export const NAVIGATION_PLAN = {
  start: 'entrance', clearance: .1,
  nodes: [
    { id: 'entrance', position: [0, 11.15] },
    { id: 'internal', position: [0, 10.5] },
    { id: 'south', position: [0, 5.4] },
    { id: 'hub', position: [0, 4.4] },
    { id: 'sw', position: [-2.5, 5.4] },
    { id: 'se', position: [2.5, 5.4] },
    { id: 'west-hub', position: [-2.5, 4.4] },
    { id: 'east-hub', position: [2.5, 4.4] },
    { id: 'nw', position: [-2.5, -2.4] },
    { id: 'ne', position: [2.5, -2.4] },
    { id: 'north', position: [0, -2.4] },
    { id: 'clinical', position: [5.6, -2.4] },
    { id: 'ebm', position: [-5.6, -2.4] },
    { id: 'gov-lane', position: [-5.6, 5.4] },
    { id: 'gov', position: [-5.6, 4.9] },
    { id: 'adr-lane', position: [5.6, 5.4] },
    { id: 'adr', position: [5.6, 4.2] },
  ],
  edges: [
    ['entrance', 'internal'], ['internal', 'south'], ['south', 'hub'],
    ['south', 'sw'], ['south', 'se'], ['sw', 'west-hub'], ['se', 'east-hub'],
    ['hub', 'west-hub'], ['hub', 'east-hub'], ['west-hub', 'nw'], ['east-hub', 'ne'],
    ['nw', 'north'], ['north', 'ne'], ['nw', 'ebm'], ['ne', 'clinical'],
    ['sw', 'gov-lane'], ['gov-lane', 'gov'], ['se', 'adr-lane'], ['adr-lane', 'adr'],
  ],
  stops: { clinical: 'clinical', ebm: 'ebm', adr: 'adr', gov: 'gov', internal: 'internal' },
};
export const DISPENSING = { counterX: 4.9, counterZ: 9.2 };
export const SCENE_LAYOUT = {
  clinical: { position: [5.6, 0, -4.7], size: [6.4, 5.2], color: '#8eabb9', surface: '#e0e8e7', labelDock: 'right-top' },
  ebm: { position: [-5.6, 0, -4.7], size: [6.4, 5.2], color: '#9eae91', surface: '#e5e8d9', labelDock: 'left-top' },
  adr: { position: [5.6, 0, 2], size: [6.4, 4.8], color: '#c59b79', surface: '#eee3d6', labelDock: 'right-middle' },
  gov: { position: [-5.6, 0, 2], size: [6.4, 4.8], color: '#73a6a4', surface: '#dce7e1', labelDock: 'left-middle' },
  internal: { position: [0, 0, 9.1], size: [17.6, 4.8], color: '#97a6b0', surface: '#e2e5e1', labelDock: 'bottom' },
  __overflow: { position: [0, 0, 13.5], size: [3.8, 3.6], color: '#b5adba' },
};
export function resolveLayout(id) {
  return Object.hasOwn(SCENE_LAYOUT, id) ? SCENE_LAYOUT[id] : SCENE_LAYOUT.__overflow;
}
// Every tool has a deterministic generic slot; no per-tool metadata is copied here.
export function resolveToolPosition(categoryId, index) {
  const { position } = resolveLayout(categoryId);
  // Dispensing terminals sit on the two shared counters, outside the entrance aisle.
  if (categoryId === 'internal') {
    const side = index % 4 < 2 ? -1 : 1;
    return [side * DISPENSING.counterX + (index % 2 ? .6 : -.6), 1.5, DISPENSING.counterZ + .2 + Math.floor(index / 4) * .65];
  }
  const columns = categoryId === 'adr' ? 2 : 3;
  const front = categoryId === 'ebm' ? 1.2 : categoryId === 'adr' ? .65 : .1;
  return [position[0] + (index % columns - (columns - 1) / 2) * 1.45, .95,
    position[2] + front + Math.floor(index / columns) * 1.05];
}
