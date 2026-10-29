// Spatial metadata only. Names, URLs and descriptions belong in /tools.json.
export const SCENE_LAYOUT = {
  clinical: { position: [-5, 0, 0], color: '#7eaaa1' },
  ebm: { position: [0, 0, -5], color: '#c1af88' },
  adr: { position: [5, 0, 0], color: '#bd9283' },
  gov: { position: [-5, 0, 5], color: '#83a9bb' },
  internal: { position: [5, 0, 5], color: '#a4ab8a' },
  __overflow: { position: [0, 0, 9], color: '#b5adba' },
};
export function resolveLayout(id) {
  return Object.hasOwn(SCENE_LAYOUT, id) ? SCENE_LAYOUT[id] : SCENE_LAYOUT.__overflow;
}
// Every tool has a deterministic generic slot; no per-tool metadata is copied here.
export function resolveToolPosition(categoryId, index) {
  const { position } = resolveLayout(categoryId);
  return [position[0] - 1.2 + (index % 4) * .8, .75, position[2] - .7 + Math.floor(index / 4) * .8];
}
