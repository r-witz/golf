import { hole, roundRect } from '../lib.mjs';

// Le Parcours du Combattant (hard, par 4): one long lane and everything at once. A turning bar; two
// jaws that close in turn; a stretch of ice; a row of moles; a strip of sand that eats the pace; a
// gate with a gap of one ball's width and a half, a guard crossing it; and bumpers round the cup.
// You read each obstacle and wait for it, or lose a stroke to it.
export default () => {
  const t = hole('Le Parcours du Combattant', { theme: 'chateau', par: 4, maxStrokes: 12 });
  t.plate(roundRect(-5, -3, 5, 3, 1.5), 0, { open: [[0, -3, 5]] });
  t.floor(-2.5, -24, 2.5, -18, 0, 'ice').floor(-2.5, -33, 2.5, -31.5, 0, 'sand'); // first: they win over the lane
  t.path([0, 0, -3], [0, -1], { width: 5 }).straight(38.3).done();
  t.spinner(0, -8, 0, 2.3, { period: 3.5 });
  t.slider(-2.4, -13.4, -0.8, -12.6, 0, 0.5, [1.6, 0], { period: 2.4 }).slider(0.8, -13.4, 2.4, -12.6, 0, 0.5, [-1.6, 0], { period: 2.4, phase: 0.5 }); // the jaws, in turn
  for (const [x, ph] of [[-1.6, 0], [0, 0.33], [1.6, 0.66]]) t.mole(x, -27, 0, { r: 0.45, period: 2.2, phase: ph });
  t.block(-2.5, -36.2, -0.55, -35.8, -0.15, 0.45).block(0.55, -36.2, 2.5, -35.8, -0.15, 0.45); // the gate
  t.slider(-1.6, -37.6, -0.9, -37, 0, 0.5, [2.5, 0], { period: 2.6 }); // its guard
  t.post(-1.7, -43.5, 0, 0.4, 0.45, 'bumper').post(1.7, -43.5, 0, 0.4, 0.45, 'bumper');
  t.disc('strokes', -4.6, -47.6, 0.45, 0, { add: -1 }, { once: true });
  return t.green(roundRect(-6, -49, 6, -41, 2), 0, 0, -46, { open: [[0, -41, 5]] }).tee(0, 0, 1);
};
