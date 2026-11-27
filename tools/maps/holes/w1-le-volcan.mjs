import { hole, roundRect, stages, stage, entry } from '../lib.mjs';

// Le Volcan (a world of three holes, 2026-11-26), up the slopes of a volcano, its lava for water.
// 1. La Coulée (par 3): a river of lava across the way. Safe: the narrow bridge, a basalt block
//    sliding across it (it pushes a ball into the lava). Risky: the geyser beside the bridge throws a
//    ball that comes at it fast over the river. Past it, a flow of lava pushes everything sideways,
//    basalt columns before the cup; a power box by the river, the coin in the far corner.
// 2. L'Obsidienne (par 4): a ramp of volcanic glass up to a terrace: as slippery as ice, too soft
//    and the ball slides back down, too hard and it bangs round the hairpin at the top. On the terrace
//    two lava bubbles burst up and sink; a basalt block slides across the top of the ramp.
// 3. Le Cratère (par 3): from the edge of the terrace a bridge of ash, no wall, a booster on it, over
//    the void to the crater: the cup at its bottom in a vent that blows a slow ball back, basalt
//    bumpers on its slopes.
export default () => {
  const t = hole('Le Volcan', { theme: 'volcan', maxStrokes: 10 });
  stage(t, 1); // 1. La Coulée
  t.plate(roundRect(-5, -3, 5, 3, 1.5), 0, { open: [[0, -3, 6]] });
  t.path([0, 0, -3], [0, -1], { width: 6 }).straight(6).done();
  t.geyser(2, -7.6, 0, { r: 0.5, speed: 9 });
  const bridge = [-1, -15, 1, -9];
  t.floor(...bridge);
  t.lake(-3, -15, 3, -9, [bridge]);
  t.rail(0.45, [-3, 0, -9], [-3, 0, -15]).rail(0.45, [3, 0, -9], [3, 0, -15]);
  t.slider(-2.4, -12.4, -1.6, -11.6, 0, 0.5, [4, 0], { period: 3 }); // a basalt block across the bridge
  t.plate(roundRect(-6, -32, 6, -15, 1), 0, { open: [[0, -15, 6]] });
  t.pad('wind', -6, -22.5, 6, -20.5, 0, { accel: [3, 0, 0] }); // a flow of lava: it carries
  t.post(-3, -24.5, 0, 0.6, 0.6).post(2.5, -25.5, 0, 0.6, 0.6).post(-0.5, -26, 0, 0.45, 0.6); // basalt columns
  t.disc('powerup', 4.6, -17, 0.45, 0, null, { once: true });
  t.disc('strokes', -5, -31, 0.45, 0, { add: -1 }, { once: true });
  stage(t, 2); // 2. L'Obsidienne
  t.plate(roundRect(9, -30, 15, -24, 1), 0, { open: [[12, -30, 5]] });
  t.path([12, 0, -30], [0, -1], { width: 5, material: 'ice' }).straight(3).straight(10, { rise: 2 }).straight(2).turn(90, 4).straight(3).done();
  t.plate(roundRect(-4, -55, 5.5, -43, 2), 2, { open: [[5.5, -49, 5]] });
  t.slider(9.6, -44.4, 10.4, -43.6, 2, 0.5, [4, 0], { period: 2.6 }); // a basalt block across the top of the ramp
  t.mole(1.2, -46.5, 2, { r: 0.5, period: 2.4 }).mole(1.2, -53, 2, { r: 0.5, period: 2.4, phase: 0.5 });
  t.disc('powerup', 3.8, -53.4, 0.45, 2, null, { once: true });
  t.disc('strokes', -2.8, -44.6, 0.45, 2, { add: -1 }, { once: true });
  stage(t, 3); // 3. Le Cratère
  const [cx, cz] = [-9.5, -68];
  t.plate(roundRect(-12, -52, -7, -46, 1), 2, { open: [[-9.5, -52, 3]] });
  t.path([-9.5, 2, -52], [0, -1], { width: 3, walls: 'none' }).straight(3).straight(4, { rise: 0.5 }).reach(cx, cz, 7, { stop: 6.05 }).done();
  t.pad('speedpad', -11, -54.8, -8, -53.6, 2, { dir: [0, 0, -1], speed: 9 });
  t.bowl(cx, cz, 1, 2, 6, 1.5, { collar: 1, cup: true, open: [entry(cx, cz, 7, cx, -50, 3)] });
  for (const a of [30, 150, 250, 330]) { const r = 4.2, x = cx + r * Math.cos(a * Math.PI / 180), z = cz + r * Math.sin(a * Math.PI / 180); t.post(x, z, 1 + 1.5 * (r - 2) / 4, 0.42, 0.45, 'bumper'); }
  t.disc('magnet', cx, cz, 1.8, 1, { at: [cx, 1, cz], accel: -5 }); // a vent round the cup blows the ball back: come in with some pace
  for (const a of [90, 210, 330]) t.mole(cx + 1.3 * Math.cos(a * Math.PI / 180), cz + 1.3 * Math.sin(a * Math.PI / 180), 1, { r: 0.42, period: 2.7, phase: a / 360 }); // lava bubbles round the cup, one after the other
  t.disc('strokes', cx, cz - 6.5, 0.45, 2.5, { add: -1 }, { once: true });
  return stages(t, 'Le Volcan', [
    { name: 'Le Volcan · 1. La Coulée', tee: [0, 0, 1.5], cup: [0, 0, -28.5], par: 3, maxStrokes: 10 },
    { name: 'Le Volcan · 2. L’Obsidienne', tee: [12, 0, -26], cup: [-1, 2, -50], par: 4, maxStrokes: 10 },
    { name: 'Le Volcan · 3. Le Cratère', tee: [-9.5, 2, -48], cup: [cx, 1, cz], par: 3, maxStrokes: 10 },
  ]);
};
