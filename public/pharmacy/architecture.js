import { PALETTE as P, createShelf, createMonitor } from './geometry.js';
import { FLOOR_PLAN, CIRCULATION_PREVIEW, DISPENSING } from './scene-layout.js';

// One cutaway building; R2 reserves a loop around the central coordination island.
export function createArchitecture(kit, screen, small) {
  const wall = (size, position) => {
    kit.box(size, position, P.wall);
    // Timber cap makes the open-top section legible from the overview.
    kit.box([size[0] + .04, .07, size[2] + .04],
      [position[0], position[1] + size[1] / 2, position[2]], P.wood);
  };
  const counter = (x, z, width, depth = .85) => {
    kit.box([width, .78, depth], [x, .55, z], P.wall);
    kit.box([width + .12, .12, depth + .12], [x, 1, z], P.wood);
    kit.box([width - .12, .14, .025], [x, .36, z + depth / 2 + .015], P.teal);
  };

  // Continuous plinth, perimeter and a single entrance on the cutaway front.
  const { width, depth, centerZ } = FLOOR_PLAN;
  kit.box([width + .4, .18, depth + .4], [0, -.19, centerZ], P.frame);
  wall([width, 2.3, .22], [0, 1.27, -7.9]);
  wall([.22, 2.3, depth - .2], [-9.7, 1.27, centerZ]);
  wall([.22, .6, depth - .2], [9.7, .42, centerZ]);
  for (const x of [-5.65, 5.65]) wall([8, .42, .22], [x, .33, 11.9]);
  kit.box([3.25, .035, 1.1], [0, .15, 11.35], P.teal);

  // Each strip connects to the next; the island no longer sits across a single spine.
  for (const { position: [x, z], size: [w, d] } of CIRCULATION_PREVIEW) {
    kit.box([w, .012, d], [x, .15, z], P.paper);
  }
  for (const x of [-1.32, 1.32]) kit.box([.045, .013, 6.7], [x, .151, 8.35], P.wood);

  // Rear consult/teaching rooms, with broad openings onto the shared aisle.
  for (const side of [-1, 1]) {
    wall([.16, 1.4, 3.6], [side * 2.5, .82, -6]);
    wall([5.6, 1.05, .16], [side * 6.9, .645, -1.4]);
    wall([.16, .85, 2.5], [side * 8.9, .545, 2]);
    // Built-in rear bench joins the rooms to the same pharmacy shell.
    counter(side * 5.6, -7.25, 5.1, .65);
    // Storage banks flank the central approach; shared infrastructure, not booths.
    for (const z of [7.5, 10.2]) createShelf(kit, side * 8, z, small);
    counter(side * DISPENSING.counterX, DISPENSING.counterZ, 3.8, 1.05);
    counter(side * 3.4, 8.1, .8, 1.3);
    // Rear preparation benches are shared by the two dispensing wings.
    counter(side * 5.7, 6.8, 4.6, .65);
  }

  // A readable architectural fascia rather than another floating room label.
  kit.box([4.3, .85, .08], [0, 1.95, -7.75], P.teal);
  kit.box([3.8, .66, .025], [0, 1.95, -7.69], '#ffffff', undefined, screen('hub'));

  // Central coordination island: open staff side, wood worktop, visible pharmacist.
  kit.box([3.5, .025, 3.4], [0, .16, 1.8], P.wood);
  counter(0, .55, 2.7, .7);
  for (const x of [-1.25, 1.25]) counter(x, 1.45, .55, 1.65);
  createMonitor(kit, -.5, .52, screen('hub'), 1.05, 1.46);
  // Rx emblem is part of the island front and remains visible without DOM labels.
  kit.box([1.15, .6, .1], [0, .8, 3.08], P.teal);
  kit.box([1.03, .5, .025], [0, .8, 3.145], '#ffffff', undefined, screen('hub'));
}
