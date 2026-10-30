import { PALETTE as P, createDesk, createMonitor, createChair, createMedicationCart, createInfusionStation } from './geometry.js';
import { resolveLayout, DISPENSING } from './scene-layout.js';

function clinical(kit, screen, small, x, z) {
  createDesk(kit, x, z - 1.1, 3.5);
  createMonitor(kit, x - 1, z - 1.15, screen('clinical'), 1.1, 1.22);
  createMonitor(kit, x + .25, z - 1.15, screen('lab'), 1, 1.2);
  createInfusionStation(kit, x + 2.1, z - 1.3);
  // Medication refrigerator and large cross distinguish this from an IT office.
  kit.box([.95, 1.65, .65], [x + 2.1, .98, z - 2.35], P.wall);
  kit.box([.77, 1.35, .035], [x + 2.1, 1.01, z - 2], P.clinical);
  kit.box([.32, .1, .04], [x + 2.1, 1.22, z - 1.97], P.paper);
  kit.box([.1, .32, .04], [x + 2.1, 1.22, z - 1.97], P.paper);
  kit.box([.6, .06, .4], [x - .3, .81, z - .9], P.paper);
  if (!small) for (let i = 0; i < 3; i++) kit.cylinder([.05, .2, .05], [x - .45 + i * .15, .92, z - .9], P.teal);
}

function bookcase(kit, x, z, small) {
  kit.box([1.5, 1.7, .15], [x, 1, z - .15], P.wall);
  for (const dx of [-.8, .8]) kit.box([.1, 1.9, .5], [x + dx, 1, z], P.wood);
  for (let row = 0; row < 3; row++) {
    kit.box([1.65, .08, .5], [x, .35 + row * .55, z], P.wood);
    for (let col = 0; col < (small ? 4 : 7); col++) {
      const h = .25 + col % 3 * .07;
      kit.box([small ? .22 : .13, h, .3], [x - .6 + col * (small ? .39 : .2), .4 + row * .55 + h / 2, z], col % 2 ? P.ebm : P.teal);
    }
  }
}

function ebm(kit, screen, small, x, z) {
  // Seminar table, large forest plot, books and a physical evidence pyramid.
  createMonitor(kit, x + .35, z - 1.95, screen('ebm'), 2.6, 1.65);
  for (const dx of [-.65, .65]) kit.box([.08, 1.2, .12], [x + .35 + dx, .74, z - 1.95], P.frame);
  createDesk(kit, x + .25, z - .55, 2.7);
  const chairs = small ? [[-1.45, -.6], [1.9, -.6], [.25, .15]] : [[-1.45, -.6], [1.9, -.6], [-.45, .15], [.95, .15]];
  for (const [dx, dz] of chairs) createChair(kit, x + dx, z + dz);
  bookcase(kit, x - 2.2, z - 2.15, small);
  for (let level = 0; level < 3; level++) {
    const width = .85 - level * .23;
    kit.box([width, .22, .55], [x + 2.1, 1.12 + level * .22, z - 2.5], level % 2 ? P.paper : P.ebm);
  }
  if (!small) for (let i = 0; i < 3; i++) kit.box([.32, .04, .26], [x + .25, .8 + i * .045, z - .5], i === 1 ? P.ebm : P.paper);
}

function adr(kit, screen, small, x, z) {
  // One review bench pairs signal assessment with medication-pair review.
  createDesk(kit, x, z - 1.05, 3.8);
  createMonitor(kit, x - .95, z - 1.1, screen('signal'), 1.65, 1.4);
  createMonitor(kit, x + .95, z - 1.1, screen('adr'), 1.65, 1.4);
  kit.box([1.1, 1.05, .12], [x + 2.3, 1.2, z - .85], P.frame);
  kit.box([.98, .93, .04], [x + 2.3, 1.2, z - .765], P.paper);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
    kit.box([.2, .2, .025], [x + 2.02 + col * .28, .92 + row * .28, z - .73], row === col ? P.adr : P.teal);
  }
  kit.box([.12, .7, .15], [x + 2.3, .4, z - .85], P.frame);
  for (const dx of [-1.35, 1.35]) {
    kit.box([.4, .14, .36], [x + dx, .85, z - .65], P.paper);
    if (!small) kit.box([.3, .025, .26], [x + dx, .94, z - .65], P.adr);
  }
}

function gov(kit, screen, small, x, z) {
  createDesk(kit, x, z - 1.1, 3.6);
  createMonitor(kit, x, z - 1.25, screen('gov'), 3.1, 1.75);
  // Tall storage/rack silhouettes and a Taiwan radar screen read as a data lab.
  for (const dx of [-2, 2]) {
    kit.box([.65, 1.95, .65], [x + dx, 1.1, z - 1.3], P.frame);
    for (let row = 0; row < (small ? 4 : 6); row++) {
      kit.box([.5, .16, .035], [x + dx, .4 + row * .27, z - .95], P.screen);
      kit.box([.1, .04, .04], [x + dx + .16, .43 + row * .27, z - .925], P.gov);
    }
  }
}

function internal(kit, screen, small) {
  const { counterX, counterZ } = DISPENSING;
  createMonitor(kit, -counterX, counterZ - .35, screen('internal'), .9, 1.45);
  createMedicationCart(kit, 3.3, 10.8);
  if (!small) createMedicationCart(kit, -7, 8.5);
  // Unit-dose bins on preparation benches, separate from the medicine shelving.
  for (const side of [-1, 1]) {
    for (let col = 0; col < (small ? 4 : 6); col++) {
      const x = side * 5.7 - 1.5 + col * (small ? 1 : .6);
      kit.box([.45, .5, .38], [x, 1.33, 6.8], P.internal);
      for (let row = 0; row < 2; row++) kit.box([.37, .17, .035], [x, 1.18 + row * .24, 7.01], P.paper);
    }
    kit.box([.18, .3, .08], [side * (counterX + 1.5), 1.2, counterZ + .5], P.internal);
  }
  kit.box([.18, .15, .24], [-counterX - 1.5, 1.15, counterZ], P.frame, [.3, 0, 0]);
}

const builders = { clinical, ebm, adr, gov, internal };
export function createZoneArt(kit, screen, small, categories) {
  for (const { id } of categories) {
    if (!Object.hasOwn(builders, id)) continue;
    const [x, , z] = resolveLayout(id).position;
    builders[id](kit, screen, small, x, z);
  }
}
