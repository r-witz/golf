import { hole, roundRect } from '../lib.mjs';

// La Tour (hard, par 4): three floors. From the ground floor a geyser throws a ball that comes at it
// fast up onto the first floor (too slow, it hits the edge and drops back). The first floor has no wall
// on its near side: overshoot and you drop back to the ground floor, a setback, not a penalty. From
// there a ramp of two units wide, steep, no rail, a booster at its foot, climbs to the top floor: too
// soft, it rolls back; off line, the void. On top, a guard paces in front of the cup and two vents blow
// a ball aside.
export default () => {
  const t = hole('La Tour', { theme: 'nuit', par: 4, maxStrokes: 12 });
  t.plate(roundRect(-8, -26, 8, 8, 3), 0); // the ground floor, under the first one too
  t.geyser(0, -8, 0, { r: 0.6, speed: 11 });
  t.plate(roundRect(-8, -26, 8, -12, 3), 2.5, { open: [[0, -12, 10], [0, -26, 2.2]] }); // the first floor
  t.path([0, 2.5, -26], [0, -1], { width: 2, walls: 'none' }).straight(8.3, { rise: 2.5 }).done(); // the ramp
  t.pad('speedpad', -1, -25.6, 1, -24.4, 2.5, { dir: [0, 0, -1], speed: 12 });
  t.disc('magnet', -3.5, -41, 1.6, 5, { at: [-3.5, 5, -41], accel: -6 }).disc('magnet', 3.5, -41, 1.6, 5, { at: [3.5, 5, -41], accel: -6 }); // vents
  t.slider(-2.6, -38.4, -1.8, -37.6, 5, 0.5, [4.4, 0], { period: 3 }); // the guard
  t.disc('powerup', 6, -15, 0.45, 2.5, null, { once: true });
  return t.green(roundRect(-8, -46, 8, -34.3, 3), 5, 0, -42, { open: [[0, -34.3, 2.2]] }).tee(0, 0, 5);
};
