import { hole, roundRect } from '../lib.mjs';

// Le Glacier (hard, par 4): a frozen arena with three holes in the ice and three bumpers that throw a
// ball back at full pace; a vent in front of the way out blows away whatever comes slowly; the way out
// is a gap of 1.4. Only narrow banks of snow along the walls slow a ball down. On ice everything goes
// far: two gentle shots beat one strong one.
export default () => {
  const t = hole('Le Glacier', { theme: 'banquise', par: 4, maxStrokes: 12 });
  const y = 0, holes = [[-7, -12, -3, -8], [2, -18, 6, -14], [-5, -22, -1, -19]];
  // the ice: the arena x -10..10, z -3..-26, but its three holes
  const ice = [[-10, -8, 10, -3], [-10, -12, -7, -8], [-3, -12, 10, -8], [-10, -14, 10, -12], [-10, -18, 2, -14], [6, -18, 10, -14],
    [-10, -19, 10, -18], [-10, -22, -5, -19], [-1, -22, 10, -19], [-10, -26, 10, -22]];
  t.plate(roundRect(-5, 0, 5, 6, 1.5), y, { open: [[0, 0, 4]] });
  t.floor(-10, -26, -9, -3, y, 'sand').floor(9, -26, 10, -3, y, 'sand'); // the snow banks, first: they win
  for (const r of ice) t.floor(...r, y, 'ice');
  for (const r of holes) t.lake(...r, [], y - 0.3);
  t.floor(-2, -3, 2, 0, y); // from the tee onto the ice
  t.rail(0.45, [-2, y, -3], [-10, y, -3], [-10, y, -26], [-0.7, y, -26]).rail(0.45, [2, y, -3], [10, y, -3], [10, y, -26], [0.7, y, -26]);
  t.rail(0.45, [-2, y, 0], [-2, y, -3]).rail(0.45, [2, y, 0], [2, y, -3]);
  for (const [x, z] of [[0, -10], [-6, -16.5], [7, -21]]) t.post(x, z, y, 0.45, 0.45, 'bumper');
  t.disc('magnet', 0, -24.6, 1.3, y, { at: [0, y, -24.6], accel: -5 }); // the vent before the way out
  t.disc('strokes', 8, -5, 0.45, y, { add: -1 }, { once: true });
  return t.green(roundRect(-4, -34, 4, -26, 1.5), y, 0, -31, { open: [[0, -26, 1.4]] }).tee(0, y, 3);
};
