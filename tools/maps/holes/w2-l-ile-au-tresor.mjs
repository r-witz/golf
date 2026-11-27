import { hole, roundRect, stages, stage } from '../lib.mjs';

// L'Île au Trésor (a world of three holes, 2026-11-26), a pirates' island in a turquoise sea.
// 1. La Plage (par 3): a beach crossed by a lagoon full of sharks. Safe: round it on the east side,
//    through the sand. Risky: the plank pontoon straight across. Palms in the way, a treasure chest
//    (a power box) by the tee.
// 2. La Jungle (par 4): a booster, a bend, a climb, another bend, up to a clearing where a log turns
//    and two crabs pop out of the sand.
// 3. Le Trésor (par 3): a plank bridge, no rail, out to the treasure rock, barrels for bumpers round
//    the cup and a crab at the way in; or the ship's cannon on the tee, which lobs the ball onto the
//    rock, far from the cup.
export default () => {
  const t = hole("L'Île au Trésor", { theme: 'pirate', maxStrokes: 10 });
  stage(t, 1); // 1. La Plage
  t.plate(roundRect(-5, -3, 5, 3, 1.5), 0, { open: [[0, -3, 8]] });
  t.floor(3, -19.5, 8, -14.5, 0, 'sand').floor(-2, -27, 2, -23.5, 0, 'sand'); // the sand, first: it wins
  const pontoon = [-5, -20, -3.8, -14];
  t.floor(-8, -14, 8, -3).floor(2, -20, 8, -14).floor(-8, -30, 8, -20).floor(...pontoon);
  t.lake(-8, -20, 2, -14, [pontoon]);
  t.rail(0.45, [-4, 0, -3], [-8, 0, -3], [-8, 0, -30], [8, 0, -30], [8, 0, -3], [4, 0, -3]);
  t.post(5.5, -8, 0, 0.35).post(-6, -10, 0, 0.35).post(6, -25.5, 0, 0.35); // palm trunks
  t.disc('powerup', -6.3, -5.6, 0.45, 0, null, { once: true });
  stage(t, 2); // 2. La Jungle
  t.plate(roundRect(11, -30, 17, -24, 1), 0, { open: [[14, -30, 5]] });
  t.path([14, 0, -30], [0, -1], { width: 5 }).straight(4).turn(90, 4).straight(8, { rise: 2 }).turn(-90, 4).straight(3.3).done();
  t.pad('speedpad', 11.5, -33.6, 16.5, -32.4, 0, { dir: [0, 0, -1], speed: 10 });
  t.plate(roundRect(-8, -56, 4, -45, 2), 2, { open: [[-2, -45, 5]] });
  t.spinner(-2.5, -49.6, 2, 2.1, { period: 5 }); // a log turning
  t.mole(1.6, -50.5, 2, { r: 0.45, period: 2.6 }).mole(-6, -53.5, 2, { r: 0.45, period: 2.6, phase: 0.5 }); // crabs
  t.disc('strokes', 2.4, -46.6, 0.45, 2, { add: -1 }, { once: true });
  stage(t, 3); // 3. Le Trésor
  t.plate(roundRect(-17, -56, -11, -50, 1), 2, { open: [[-14, -56, 3]] });
  t.path([-14, 2, -56], [0, -1], { width: 2.5, walls: 'none' }).straight(10.3).done(); // the plank bridge
  t.plate(roundRect(-21, -80, -7, -66, 3), 2, { open: [[-14, -66, 4]] });
  for (const [x, z] of [[-17.2, -72.5], [-10.8, -72.5], [-14, -71]]) t.post(x, z, 2, 0.42, 0.45, 'bumper'); // barrels
  t.slider(-16.6, -68.4, -15.8, -67.6, 2, 0.5, [4.4, 0], { period: 2.8 }); // a crab at the way in
  t.cannon(-16, -51.2, 2, [-19.2, 2, -78.6], { T: 1.4 }); // the ship's cannon: into the far corner, behind the barrels
  t.disc('powerup', -9, -69.5, 0.45, 2, null, { once: true });
  return stages(t, "L'Île au Trésor", [
    { name: 'L’Île au Trésor · 1. La Plage', tee: [0, 0, 1.5], cup: [-4, 0, -26], par: 3, maxStrokes: 10 },
    { name: 'L’Île au Trésor · 2. La Jungle', tee: [14, 0, -26.5], cup: [-2, 2, -53], par: 4, maxStrokes: 10 },
    { name: 'L’Île au Trésor · 3. Le Trésor', tee: [-13, 2, -52.5], cup: [-14, 2, -75.5], par: 3, maxStrokes: 10 },
  ]);
};
