import { hole, roundRect } from '../lib.mjs';

// Le Funambule (hard, par 4): a tightrope of turf 1.8 wide, no rail on its straights, zigzagging over
// the void; only the outer side of each bend has a wall to lean on. A crosswind blows across two of
// the straights. Every shot is a choice between going far and staying on.
export default () => {
  const t = hole('Le Funambule', { theme: 'canyon', par: 4, maxStrokes: 12 });
  t.plate(roundRect(-4, -3, 4, 3, 1.5), 3, { open: [[0, -3, 2.2]] });
  t.path([0, 3, -3], [0, -1], { width: 1.8, walls: 'none' })
    .straight(7).turn(90, 3, { walls: 'right' })
    .straight(6).turn(-90, 3, { walls: 'left' })
    .straight(6).turn(-90, 3, { walls: 'left' })
    .straight(5).turn(90, 3, { walls: 'right' })
    .straight(5.3).done();
  t.zone('wind', { shape: 0, c: [-6, 4, -13], h: [2.6, 1, 0.9], params: { accel: [0, 0, 2] } }); // across the second straight
  t.zone('wind', { shape: 0, c: [-12, 4, -19], h: [0.9, 1, 2.6], params: { accel: [-2, 0, 0] } }); // across the third
  t.disc('powerup', -6.5, -25, 0.45, 3, null, { once: true });
  return t.green(roundRect(-5, -41, 3, -33, 2), 3, -1, -38, { open: [[-1, -33, 2.2]] }).tee(0, 3, 1);
};
