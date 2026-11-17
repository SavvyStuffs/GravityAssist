/* Gravity Assist: levels 11 to 20. In the browser these are appended to LEVELS; in Node this file exports just these ten. */
(function (root, f) { var L = f(); if (typeof module === 'object' && module.exports) module.exports = L; else root.LEVELS = (root.LEVELS || []).concat(L); })(typeof self !== 'undefined' ? self : this, function () {
  var TAU = Math.PI * 2;
  // A ring of asteroids on one rail at true orbital speed round a point mass (see levels.js).
  function ring(cx, cy, r, mass, dir, slots, skip, radius, phase) {
    var out = [];
    for (var i = 0; i < slots; i++) {
      if (skip.indexOf(i) >= 0) continue;
      out.push({ orbit: { cx: cx, cy: cy, r: r, mass: mass, dir: dir, phase: (phase || 0) + TAU * i / slots }, radius: radius });
    }
    return out;
  }
  // Beacon on a circular rail round a body at true orbital speed. hold: seconds to stay inside.
  function rail(around, r, phase, dir, hold, br) {
    var b = { orbit: { around: around, r: r, phase: phase, dir: dir || 1 } };
    if (hold) { b.hold = hold; b.r = br || 34; }
    return b;
  }
  // Beacon on a rail round a point mass (binary centres, discs).
  function prail(mass, r, phase, dir, hold, br) {
    var b = { orbit: { cx: 0, cy: 0, r: r, mass: mass, phase: phase, dir: dir || 1 } };
    if (hold) { b.hold = hold; b.r = br || 34; }
    return b;
  }
  var K = 1.3; // same 30% gravity boost for stars, planets and moons as levels.js (holes unchanged)

  // Pars: gold = the recorded solution time plus 50% (the owner's call); silver = test-pilot median x 3.0, calibrated against the owner's real times on levels 1 to 10.
  return [
    // 11
    {
      name: 'Carousel',
      hint: 'Ringed beacons only count if you ride inside them, so match their orbit and stay.',
      bounds: 850, fuel: 200,
      start: { x: -560, y: 330, vx: 0, vy: 0, angle: -Math.PI / 2 },
      bodies: [
        { id: 'sun', kind: 'star', mass: 3.2e6 * K, radius: 38, x: 0, y: 0 },
        { id: 'pip', kind: 'planet', mass: 4e5 * K, radius: 16, orbit: { around: 'sun', r: 400, phase: -0.6 } }
      ],
      beacons: [{ x: -250, y: -200 }, rail('sun', 210, 3.6, 1, 2), { x: 150, y: 250 }, { x: 360, y: 300 }],
      cells: [],
      asteroids: [],
      gate: { x: -120, y: 560 },
      par: { gold: 29.1, silver: 79.8 }
    },
    // 12
    {
      name: 'Binary Abyss',
      hint: 'Two black holes circle each other, so cross the still point between them on time.',
      bounds: 1000, fuel: 180,
      start: { x: 0, y: 760, vx: 0, vy: 0, angle: -Math.PI / 2 },
      bodies: [
        { id: 'h1', kind: 'hole', mass: 2.2e6, radius: 12, orbit: { cx: 0, cy: 0, r: 150, mass: 2.2e6 / 4, phase: 0 } },
        { id: 'h2', kind: 'hole', mass: 2.2e6, radius: 12, orbit: { cx: 0, cy: 0, r: 150, mass: 2.2e6 / 4, phase: Math.PI } }
      ],
      beacons: [{ x: 0, y: 0 }, prail(4.4e6, 430, 2.2, 1, 2.5), { orbit: { cx: 0, cy: 0, r: 240, mass: 2.2e6 / 4 * Math.pow(240 / 150, 3), phase: -Math.PI / 2 } }],
      cells: [],
      asteroids: [],
      gate: { x: -560, y: 560 },
      par: { gold: 24.9, silver: 76.2 }
    },
    // 13
    {
      name: 'Accretion Disc',
      hint: 'The inner rocks lap the outer ones, so slip through when the gaps line up.',
      bounds: 900, fuel: 200,
      start: { x: -700, y: 200, vx: 0, vy: 0, angle: 0 },
      bodies: [{ id: 'hole', kind: 'hole', mass: 4e6, radius: 12, x: 0, y: 0 }],
      beacons: [rail('hole', 285, 2.5 + Math.PI, 1), rail('hole', 285, 2.5, 1, 2), { x: 560, y: -300 }],
      cells: [],
      asteroids: ring(0, 0, 200, 4e6, 1, 26, [0, 1, 2, 13, 14, 15], 22, 0).concat(ring(0, 0, 370, 4e6, 1, 44, [0, 1, 2, 22, 23, 24], 20, 1.0)),
      gate: { x: 600, y: 450 },
      par: { gold: 52.1, silver: 105.6 }
    },
    // 14
    {
      name: 'Gatekeeper',
      hint: 'A repulsor sweeps round the black hole, so dive in behind it and climb out ahead.',
      bounds: 950, fuel: 225,
      start: { x: -720, y: -300, vx: 0, vy: 0, angle: 0 },
      bodies: [
        { id: 'hole', kind: 'hole', mass: 6e6, radius: 12, x: 0, y: 0 },
        { id: 'guard', kind: 'repulsor', mass: -2.2e6, radius: 14, orbit: { cx: 0, cy: 0, r: 130, period: 6, phase: 0 } }
      ],
      beacons: [rail('hole', 230, 1.0, 1), rail('hole', 230, 1.0 + Math.PI, 1), rail('hole', 360, 4.0, -1, 2.5), { x: 500, y: 420 }],
      cells: [],
      asteroids: [],
      gate: { x: -600, y: 480 },
      par: { gold: 31.6, silver: 102.0 }
    },
    // 15
    {
      name: 'Relay',
      hint: 'Swing round each planet in turn and let the moonlet beacons hand you on to the next.',
      bounds: 1150, fuel: 190,
      start: { x: -900, y: -350, vx: 0, vy: 0, angle: 0 },
      bodies: [
        { id: 'p1', kind: 'planet', mass: 1.5e6 * K, radius: 24, x: -560, y: 220 },
        { id: 'p2', kind: 'planet', mass: 1.8e6 * K, radius: 26, x: 0, y: -260 },
        { id: 'p3', kind: 'planet', mass: 1.5e6 * K, radius: 24, x: 560, y: 220 }
      ],
      beacons: [rail('p1', 85, 1.6, 1), rail('p2', 90, 0, -1), rail('p3', 85, 4.7, 1), { x: 0, y: 380 }],
      cells: [],
      asteroids: [],
      gate: { x: 860, y: -420 },
      par: { gold: 31.1, silver: 82.5 }
    },
    // 16
    {
      name: 'Transfer Window',
      hint: 'You start in orbit with little fuel, so burn prograde to rise and ride both beacons.',
      bounds: 800, fuel: 92,
      start: { x: -220, y: 0, vx: 0, vy: -132, angle: -Math.PI / 2 },
      bodies: [{ id: 'sun', kind: 'star', mass: 3e6 * K, radius: 36, x: 0, y: 0 }],
      beacons: [rail('sun', 220, Math.PI + 0.2, 1, 3, 36), rail('sun', 440, 4.83, 1, 3, 36)],
      cells: [],
      asteroids: [],
      gate: { x: 560, y: 420 },
      par: { gold: 18.4, silver: 45.6 }
    },
    // 17
    {
      name: 'Nested Orbits',
      hint: 'A moon circles a planet that circles the star, and the beacons ride on all three.',
      bounds: 950, fuel: 220,
      start: { x: -700, y: -480, vx: 0, vy: 0, angle: 0 },
      bodies: [
        { id: 'sun', kind: 'star', mass: 3.2e6 * K, radius: 36, x: 0, y: 0 },
        { id: 'gas', kind: 'planet', mass: 9e5 * K, radius: 22, orbit: { around: 'sun', r: 480, phase: Math.PI * 0.9 } },
        { id: 'moon', kind: 'moon', mass: 1.5e5 * K, radius: 9, orbit: { around: 'gas', r: 110, phase: 0 } }
      ],
      beacons: [{ orbit: { around: 'moon', r: 50, phase: 0 }, r: 30 }, { orbit: { around: 'moon', r: 50, phase: Math.PI }, r: 30 }, rail('gas', 165, 1.2, 1, 2), rail('sun', 200, 0.5, 1, 2)],
      cells: [],
      asteroids: [],
      gate: { x: 560, y: 520 },
      par: { gold: 34.5, silver: 81.6 }
    },
    // 18
    {
      name: 'Ring Rider',
      hint: 'Fly into the gap in the rock ring and ride it round until the beacon fills.',
      bounds: 900, fuel: 230,
      start: { x: -720, y: -200, vx: 0, vy: 0, angle: 0 },
      bodies: [
        { id: 'giant', kind: 'planet', mass: 2e6 * K, radius: 32, x: 0, y: 0 },
        { id: 'inner', kind: 'moon', mass: 1.2e5 * K, radius: 10, orbit: { around: 'giant', r: 210, phase: 2.0 } },
        { id: 'outer', kind: 'moon', mass: 1.5e5 * K, radius: 11, orbit: { around: 'giant', r: 450, phase: 4.2 } }
      ],
      beacons: [rail('inner', 48, 0), prail(2e6 * K, 310, 0, 1, 3, 36), rail('outer', 50, 0)],
      cells: [],
      asteroids: ring(0, 0, 310, 2e6 * K, 1, 40, [0, 1, 2, 38, 39], 18, 0),
      gate: { x: 620, y: -480 },
      par: { gold: 32.4, silver: 126.6 }
    },
    // 19
    {
      name: 'Long Haul',
      hint: 'Three systems far apart, so cruise between them and save fuel for the black hole.',
      bounds: 1600, fuel: 280,
      start: { x: -1250, y: 500, vx: 0, vy: 0, angle: 0 },
      bodies: [
        { id: 'sun', kind: 'star', mass: 2.6e6 * K, radius: 34, x: -800, y: 300 },
        { id: 'belt', kind: 'planet', mass: 1e6 * K, radius: 22, x: 0, y: -450 },
        { id: 'hole', kind: 'hole', mass: 5e6, radius: 12, x: 820, y: 300 }
      ],
      beacons: [{ orbit: { around: 'sun', r: 230, phase: 3.6, dir: 1 }, hold: 2, r: 34 }, { x: -320, y: -380 }, { x: 0, y: -690 }, rail('hole', 240, 0, -1, 2), { x: 820, y: 680 }],
      cells: [{ x: -380, y: 150, amount: 40 }, { x: 400, y: -250, amount: 40 }],
      asteroids: ring(0, -450, 160, 1e6 * K, 1, 24, [0, 1, 12, 13], 16, 0),
      gate: { x: 1150, y: -400 },
      par: { gold: 48.9, silver: 137.7 }
    },
    // 20
    {
      name: 'Grand Orrery',
      hint: 'Everything you have learned turns at once, so read the whole machine before you burn.',
      bounds: 1300, fuel: 200,
      start: { x: -1000, y: -450, vx: 0, vy: 0, angle: 0 },
      bodies: [
        { id: 'hole', kind: 'hole', mass: 5e6, radius: 12, x: 0, y: 0 },
        { id: 'world', kind: 'planet', mass: 1e6 * K, radius: 22, orbit: { around: 'hole', r: 720, phase: Math.PI * 0.75 } },
        { id: 'moon', kind: 'moon', mass: 1.2e5 * K, radius: 9, orbit: { around: 'world', r: 120, phase: 0 } },
        { id: 'guard', kind: 'repulsor', mass: -1.2e6, radius: 14, orbit: { cx: 0, cy: 0, r: 380, period: -18, phase: 0 } }
      ],
      beacons: [rail('moon', 45, 0), rail('world', 210, 2.0, 1, 2), rail('hole', 300, 0.5, 1), rail('hole', 300, 3.5, 1), { x: 760, y: 420 }],
      cells: [{ x: -400, y: 250, amount: 40 }, { x: 420, y: -250, amount: 40 }],
      asteroids: ring(0, 0, 220, 5e6, 1, 28, [0, 1, 2, 14, 15, 16], 22, 0),
      gate: { orbit: { cx: 0, cy: 0, r: 960, period: 40, phase: 0.3 } },
      par: { gold: 46.1, silver: 139.2 }
    }
  ];
});
