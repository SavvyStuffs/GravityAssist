/* Gravity Assist: level set. Global LEVELS in the browser, module.exports in Node. */
(function (root, f) { var L = f(); if (typeof module === 'object' && module.exports) module.exports = L; else root.LEVELS = L; })(typeof self !== 'undefined' ? self : this, function () {
  var TAU = Math.PI * 2;
  // A ring of asteroids on one rail. slots = positions round the ring, skip = slot indices left empty (the gaps).
  // mass = the mass at the ring's centre; the ring then turns at true orbital speed. dir -1 runs it backwards.
  function ring(cx, cy, r, mass, dir, slots, skip, radius, phase) {
    var out = [];
    for (var i = 0; i < slots; i++) {
      if (skip.indexOf(i) >= 0) continue;
      out.push({ orbit: { cx: cx, cy: cy, r: r, mass: mass, dir: dir, phase: (phase || 0) + TAU * i / slots }, radius: radius });
    }
    return out;
  }
  // Beacon on a circular rail around a body (or a point) at the body's circular orbit speed.
  function rail(around, r, phase, dir) { return { orbit: { around: around, r: r, phase: phase, dir: dir || 1 } }; }
  var K = 1.3; // gravity of stars, planets and moons was raised 30% after the first playtest
  var BIN = TAU * Math.sqrt(160 * 160 * 160 / (3.5e6 * K / 4)); // the twin suns' period

  // Pars were reset from the owner's first real runs: silver = 1.35 x that time, gold = the recorded solution time plus 50% (the owner's call).
  return [
    // 1
    {
      name: 'First Light',
      hint: 'Turn, thrust and let the star bend your path as you sweep around it.',
      bounds: 800, fuel: 100,
      start: { x: -450, y: 0, vx: 0, vy: 0, angle: -Math.PI / 2 },
      bodies: [{ id: 'sun', kind: 'star', mass: 3e6 * K, radius: 40, x: 0, y: 0 }],
      beacons: [{ x: 0, y: -230 }, { x: 320, y: 0 }, { x: 0, y: 240 }],
      cells: [],
      asteroids: [],
      gate: { x: -330, y: 260 },
      par: { gold: 13.7, silver: 25.0 }  // optimizer best 9.36 s, fuel used 51.7 of 85; proxy 21/24 (88%) median 12.3 s best 10.6 s
    },
    // 2
    {
      name: 'Slingshot',
      hint: 'Fall toward the star, skim past it and let the swing fling you to the far side.',
      bounds: 850, fuel: 100,
      start: { x: -600, y: -380, vx: 0, vy: 0, angle: 0 },
      bodies: [{ id: 'sun', kind: 'star', mass: 6e6 * K, radius: 45, x: 0, y: 0 }],
      beacons: [{ x: 0, y: -165 }, { x: 560, y: 260 }, { x: 150, y: 600 }],
      cells: [],
      asteroids: [],
      gate: { x: -450, y: 450 },
      par: { gold: 17.0, silver: 24.5 }  // optimizer best 11.61 s, fuel used 65.3 of 82; proxy 16/24 (67%) median 15.5 s best 14.2 s
    },
    // 3
    {
      name: 'Rail Riders',
      hint: 'The beacons orbit the star, so match their speed instead of chasing them.',
      bounds: 800, fuel: 105,
      start: { x: -560, y: 320, vx: 0, vy: 0, angle: 0 },
      bodies: [{ id: 'sun', kind: 'star', mass: 3.6e6 * K, radius: 36, x: 0, y: 0 }],
      beacons: [rail('sun', 210, 0.5, 1), rail('sun', 210, 2.6, 1), rail('sun', 210, 4.7, 1), rail('sun', 340, 3.5, -1)],
      cells: [],
      asteroids: [],
      gate: { x: 460, y: -420 },
      par: { gold: 24.7, silver: 74.1 }  // optimizer best 14.34 s, fuel used 66.7 of 105; proxy 12/24 (50%) median 17.6 s best 12.2 s; gold from proxy best
    },
    // 4
    {
      name: 'Moon Dance',
      hint: 'Beacons circle the planet and its moon, so ride the moon to pick them off.',
      bounds: 750, fuel: 130,
      start: { x: -460, y: -320, vx: 0, vy: 0, angle: 0 },
      bodies: [
        { id: 'world', kind: 'planet', mass: 1e6 * K, radius: 26, x: 0, y: 0 },
        { id: 'moon', kind: 'moon', mass: 1.5e5 * K, radius: 10, orbit: { around: 'world', r: 190, phase: 0 } }
      ],
      beacons: [rail('world', 110, 1.0, 1), rail('world', 110, 4.1, 1), rail('moon', 58, 0, 1), rail('world', 300, 2.0, -1)],
      cells: [],
      asteroids: [],
      gate: { x: 460, y: 360 },
      par: { gold: 13.6, silver: 76.1 }  // optimizer best 15.10 s, fuel used 79.7 of 110; proxy 11/24 (46%) median 14.5 s best 12.7 s; gold from proxy best
    },
    // 5
    {
      name: 'Dry Tanks',
      hint: 'You cannot finish on the fuel you start with, so detour for the cells.',
      bounds: 780, fuel: 35,
      start: { x: 0, y: 470, vx: 0, vy: 0, angle: -Math.PI / 2 },
      bodies: [
        { id: 'sun', kind: 'star', mass: 3e6 * K, radius: 40, x: 0, y: 0 },
        { id: 'rock', kind: 'planet', mass: 6e5 * K, radius: 20, x: -420, y: -380 }
      ],
      beacons: [{ x: -480, y: -120 }, { x: 470, y: -160 }, { x: 0, y: -460 }],
      cells: [{ x: -300, y: 300, amount: 42 }, { x: 330, y: 320, amount: 42 }, { x: -460, y: -280, amount: 42 }, { x: 420, y: -310, amount: 42 }, { x: 0, y: -330, amount: 42 }, { x: -260, y: -470, amount: 42 }, { x: 260, y: -470, amount: 42 }, { x: 560, y: 60, amount: 42 }, { x: -560, y: 60, amount: 42 }],
      asteroids: [],
      gate: { x: 0, y: 560 },
      par: { gold: 21.4, silver: 50.4 }  // optimizer best 14.37 s, fuel used 141.9 of 175 (tank 35 + cells 140); proxy 12/24 (50%) median 30.5 s best 25.7 s
    },
    // 6
    {
      name: 'Twin Suns',
      hint: 'Two stars waltz around each other, so dart into the calm between them.',
      bounds: 800, fuel: 140,
      start: { x: -600, y: 0, vx: 0, vy: 0, angle: 0 },
      bodies: [
        { id: 'a', kind: 'star', mass: 3.5e6 * K, radius: 35, orbit: { cx: 0, cy: 0, r: 160, mass: 3.5e6 * K / 4, phase: 0 } },
        { id: 'b', kind: 'star', mass: 3.5e6 * K, radius: 35, orbit: { cx: 0, cy: 0, r: 160, mass: 3.5e6 * K / 4, phase: Math.PI } }
      ],
      beacons: [{ x: -380, y: 420 }, { orbit: { cx: 0, cy: 0, r: 80, period: BIN, phase: Math.PI / 2 } }, { orbit: { cx: 0, cy: 0, r: 80, period: BIN, phase: -Math.PI / 2 } }, { x: 420, y: 350 }], // these turn with the pair
      cells: [],
      asteroids: [],
      gate: { x: 0, y: -520 },
      par: { gold: 19.9, silver: 47.6 }  // optimizer best 14.71 s, fuel used 79.2 of 140; proxy 12/24 (50%) median 22.3 s best 18.9 s
    },
    // 7
    {
      name: 'Pushback',
      hint: 'Repulsors shove you away, so aim past them and let the push bend you in.',
      bounds: 800, fuel: 185,
      start: { x: -560, y: 0, vx: 0, vy: 0, angle: 0 },
      bodies: [
        { id: 'sun', kind: 'star', mass: 3e6 * K, radius: 40, x: 0, y: 0 },
        { id: 'p1', kind: 'repulsor', mass: -2e6, radius: 14, orbit: { cx: 0, cy: 0, r: 280, period: 14, phase: -Math.PI / 2 } },
        { id: 'p2', kind: 'repulsor', mass: -3e6, radius: 14, x: 300, y: 330 }
      ],
      beacons: [{ x: -420, y: -380 }, { x: 0, y: -150 }, { x: 470, y: -100 }, { x: 420, y: 470 }],
      cells: [],
      asteroids: [],
      gate: { x: -350, y: 450 },
      par: { gold: 25.5, silver: 65.5 }  // optimizer best 17.29 s, fuel used 116.8 of 155; proxy 18/24 (75%) median 24.7 s best 21.3 s
    },
    // 8
    {
      name: 'Event Horizon',
      hint: 'Warm up round the ice world, then fall into orbit round the black hole and never hover.',
      bounds: 1100, fuel: 205,
      start: { x: -880, y: -260, vx: 0, vy: 0, angle: 0 },
      bodies: [
        { id: 'ice', kind: 'planet', mass: 1.2e6 * K, radius: 24, x: -560, y: 260 },
        { id: 'hole', kind: 'hole', mass: 6e6, radius: 12, x: 280, y: -60 }
      ],
      beacons: [{ x: -560, y: 120 }, { x: -400, y: 360 }, { x: 280, y: 180 }, { x: 72, y: -180 }, { x: 488, y: -180 }, rail('hole', 380, 2.4, 1)],
      cells: [],
      asteroids: [],
      gate: { x: 780, y: 520 },
      par: { gold: 27.7, silver: 110.3 }  // optimizer best 19.12 s, fuel used 120.3 of 170; proxy 8/24 (33%) median 27.1 s best 24.4 s
    },
    // 9
    {
      name: 'Shatter Belt',
      hint: 'Weave through the outer rocks, time the wall gaps, then cross to the outer moonlet.',
      bounds: 1050, fuel: 215,
      start: { x: -700, y: 0, vx: 0, vy: 0, angle: 0 },
      bodies: [
        { id: 'sun', kind: 'star', mass: 1.2e6 * K, radius: 30, x: 0, y: 0 },
        { id: 'moonlet', kind: 'moon', mass: 6e5 * K, radius: 16, x: 720, y: -330 }
      ],
      beacons: [{ x: -150, y: 0 }, { orbit: { cx: 0, cy: 0, r: 335, mass: 1.2e6 * K, dir: -1, phase: 0.8 } }, { orbit: { cx: 0, cy: 0, r: 335, mass: 1.2e6 * K, dir: -1, phase: 3.9 } }, { x: 600, y: -420 }, { x: 820, y: -200 }],
      cells: [],
      asteroids: ring(0, 0, 240, 1.2e6 * K, 1, 24, [0, 1, 6, 7, 12, 13, 18], 26, 0).concat(ring(0, 0, 430, 1.2e6 * K, -1, 18, [], 18, 0.3)),
      gate: { orbit: { cx: 0, cy: 0, r: 600, period: 30, phase: Math.PI } },
      par: { gold: 31.1, silver: 106.2 }  // optimizer best 25.09 s, fuel used 140.0 of 215; proxy 10/24 (42%) median 33.9 s best 27.3 s
    },
    // 10
    {
      name: 'Perihelion',
      hint: 'Hole, rock wall, repulsor and a running gate, and the fuel cells are your lifeline.',
      bounds: 1150, fuel: 160,
      start: { x: -820, y: 300, vx: 0, vy: 0, angle: 0 },
      bodies: [
        { id: 'hole', kind: 'hole', mass: 4e6, radius: 12, x: 0, y: 0 },
        { id: 'push', kind: 'repulsor', mass: -2.5e6, radius: 14, orbit: { cx: 0, cy: 0, r: 470, period: -20, phase: 0 } },
        { id: 'far', kind: 'planet', mass: 7e5 * K, radius: 22, x: -620, y: -620 }
      ],
      beacons: [{ x: -640, y: -440 }, { x: -440, y: -720 }, { x: 0, y: 200 }, { x: 600, y: 0 }, { x: 330, y: 600 }],
      cells: [{ x: -700, y: -200, amount: 40 }, { x: 0, y: -420, amount: 40 }, { x: 560, y: 330, amount: 40 }],
      asteroids: ring(0, 0, 300, 4e6, 1, 30, [0, 1, 10, 11, 20, 21], 26, 0),
      gate: { orbit: { cx: 0, cy: 0, r: 680, period: 34, phase: Math.PI / 2 } },
      par: { gold: 37.8, silver: 75.6 }  // optimizer best 26.02 s, fuel used 173.8 of 240 (tank 160 + cells 80); proxy 6/24 (25%) median 39.5 s best 38.0 s
    }
  ];
});
