// Spatial metadata only. Names, URLs and descriptions belong in /tools.json.
export const SCENE_LAYOUT = {
  clinical: { position: [-5, 0, 0], color: '#8eabb9' },
  ebm: { position: [0, 0, -5], color: '#9eae91' },
  adr: { position: [5, 0, 0], color: '#c59b79' },
  gov: { position: [-5, 0, 5], color: '#73a6a4' },
  internal: { position: [5, 0, 5], color: '#97a6b0' },
  __overflow: { position: [0, 0, 9], color: '#b5adba' },
};
export function resolveLayout(id) {
  return Object.hasOwn(SCENE_LAYOUT, id) ? SCENE_LAYOUT[id] : SCENE_LAYOUT.__overflow;
}
// Every tool has a deterministic generic slot; no per-tool metadata is copied here.
export function resolveToolPosition(categoryId, index) {
  const { position } = resolveLayout(categoryId);
  return [position[0] - 1.2 + (index % 4) * .8, .75, position[2] + (categoryId === 'ebm' ? 1.2 : .55) + Math.floor(index / 4) * .65];
}
