import { hole, roundRect } from '../lib.mjs';

// Les Chicanes de Lave (hard, par 5): a field cut by four pools of lava, one from each side in turn: a
// slalom through passages 5 wide, a bumper standing in each that kicks a ball back towards the lava.
// Boosters between the pools speed a ball on the way it goes: lined up, they take it to the next
// passage; off line, into the lava. The coin on the far side of the last pool.
export default () => {
  const t = hole('Les Chicanes de Lave', { theme: 'volcan', par: 5, maxStrokes: 12 });
  const keep = [[-8, -7, 8, -3], [3, -10, 8, -7], [-8, -14, 8, -10], [-8, -17, -3, -14], [-8, -21, 8, -17], [3, -24, 8, -21],
    [-8, -28, 8, -24], [-8, -31, -3, -28]];
  t.plate(roundRect(-5, -3, 5, 3, 1.5), 0, { open: [[0, -3, 6]] });
  for (const r of keep) t.floor(...r);
  t.floor(-8, -42, 8, -31); // the last stretch, with the cup
  t.lake(-8, -31, 8, -7, keep);
  t.rail(0.45, [-3, 0, -3], [-8, 0, -3], [-8, 0, -42], [8, 0, -42], [8, 0, -3], [3, 0, -3]);
  for (const [x, z] of [[5.5, -8.5], [-5.5, -15.5], [5.5, -22.5], [-5.5, -29.5]]) t.post(x, z, 0, 0.42, 0.45, 'bumper');
  t.pad('speedpad', -1.2, -12.6, 1.2, -11.4, 0, { dir: [-1, 0, 0], speed: 10 }).pad('speedpad', -1.2, -19.6, 1.2, -18.4, 0, { dir: [1, 0, 0], speed: 10 });
  t.pad('speedpad', -1.2, -26.6, 1.2, -25.4, 0, { dir: [-1, 0, 0], speed: 10 });
  t.disc('strokes', 6.5, -32.5, 0.45, 0, { add: -1 }, { once: true });
  t.disc('powerup', -6.5, -5, 0.45, 0, null, { once: true });
  return t.cup(0, 0, -37.5).tee(0, 0, 1);
};
