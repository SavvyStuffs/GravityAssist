/* Gravity Assist: level set. Global LEVELS in the browser, module.exports in Node. */
(function (root, f) { var L = f(); if (typeof module === 'object' && module.exports) module.exports = L; else root.LEVELS = L; })(typeof self !== 'undefined' ? self : this, function () {
  // Levels 1 to 10 and 11 to 20 each keep their own helper functions, so they sit in separate scopes.
  var first = (function () {
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
  
    // Medal times: gold = 1.5x the recorded solution time, silver 2x, bronze 3x (the owner's call); slower finishes get no medal. Rounded to whole seconds.
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
        par: { gold: 14, silver: 18, bronze: 27 }  // optimizer best 9.36 s, fuel used 51.7 of 85; proxy 21/24 (88%) median 12.3 s best 10.6 s
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
        par: { gold: 17, silver: 23, bronze: 34 }  // optimizer best 11.61 s, fuel used 65.3 of 82; proxy 16/24 (67%) median 15.5 s best 14.2 s
      },
      // 3
      {
        name: 'Rail Riders',
        hint: 'The beacons orbit the star, so match their speed instead of chasing them.',
        bounds: 800, fuel: 120,
        start: { x: -560, y: 320, vx: 0, vy: 0, angle: 0 },
        bodies: [{ id: 'sun', kind: 'star', mass: 3.6e6 * K, radius: 36, x: 0, y: 0 }],
        beacons: [rail('sun', 210, 0.5, 1), rail('sun', 210, 2.6, 1), rail('sun', 210, 4.7, 1), rail('sun', 340, 3.5, -1)],
        cells: [],
        asteroids: [],
        gate: { x: 460, y: -420 },
        par: { gold: 25, silver: 33, bronze: 49 }  // optimizer best 14.34 s, fuel used 66.7 of 105; proxy 12/24 (50%) median 17.6 s best 12.2 s; gold from proxy best
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
        par: { gold: 14, silver: 18, bronze: 27 }  // optimizer best 15.10 s, fuel used 79.7 of 110; proxy 11/24 (46%) median 14.5 s best 12.7 s; gold from proxy best
      },
      // 5
      {
        name: 'Dry Tanks',
        hint: 'You cannot finish on the fuel you start with, so detour for the cells.',
        bounds: 780, fuel: 42,
        start: { x: 0, y: 470, vx: 0, vy: 0, angle: -Math.PI / 2 },
        bodies: [
          { id: 'sun', kind: 'star', mass: 3e6 * K, radius: 40, x: 0, y: 0 },
          { id: 'rock', kind: 'planet', mass: 6e5 * K, radius: 20, x: -420, y: -380 }
        ],
        beacons: [{ x: -480, y: -120 }, { x: 470, y: -160 }, { x: 0, y: -460 }],
        cells: [{ x: -300, y: 300, amount: 42 }, { x: 330, y: 320, amount: 42 }, { x: -460, y: -280, amount: 42 }, { x: 420, y: -310, amount: 42 }, { x: 0, y: -330, amount: 42 }, { x: -260, y: -470, amount: 42 }, { x: 260, y: -470, amount: 42 }, { x: 560, y: 60, amount: 42 }, { x: -560, y: 60, amount: 42 }],
        asteroids: [],
        gate: { x: 0, y: 560 },
        par: { gold: 21, silver: 29, bronze: 43 }  // optimizer best 14.37 s, fuel used 141.9 of 175 (tank 35 + cells 140); proxy 12/24 (50%) median 30.5 s best 25.7 s
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
        par: { gold: 20, silver: 27, bronze: 40 }  // optimizer best 14.71 s, fuel used 79.2 of 140; proxy 12/24 (50%) median 22.3 s best 18.9 s
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
        par: { gold: 26, silver: 34, bronze: 51 }  // optimizer best 17.29 s, fuel used 116.8 of 155; proxy 18/24 (75%) median 24.7 s best 21.3 s
      },
      // 8
      {
        name: 'Event Horizon',
        hint: 'Circle the ice planet, then drop into orbit around the black hole. Too close to hover.',
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
        par: { gold: 28, silver: 37, bronze: 55 }  // optimizer best 19.12 s, fuel used 120.3 of 170; proxy 8/24 (33%) median 27.1 s best 24.4 s
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
        par: { gold: 31, silver: 42, bronze: 62 }  // optimizer best 25.09 s, fuel used 140.0 of 215; proxy 10/24 (42%) median 33.9 s best 27.3 s
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
        par: { gold: 38, silver: 50, bronze: 76 }  // optimizer best 26.02 s, fuel used 173.8 of 240 (tank 160 + cells 80); proxy 6/24 (25%) median 39.5 s best 38.0 s
      }
    ];
  })();
  var second = (function () {
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
  
    // Medal times: gold = 1.5x the recorded solution time, silver 2x, bronze 3x (the owner's call); slower finishes get no medal. Rounded to whole seconds.
    return [
      // 11
      {
        name: 'Carousel',
        hint: 'Ringed beacons only count if you stay inside them. Match their orbit and ride along.',
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
        par: { gold: 29, silver: 39, bronze: 58 }
      },
      // 12
      {
        name: 'Binary Abyss',
        hint: 'Two black holes circle each other, so cross the still point between them.',
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
        par: { gold: 25, silver: 33, bronze: 50 }
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
        par: { gold: 52, silver: 70, bronze: 104 }
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
        par: { gold: 32, silver: 42, bronze: 63 }
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
        par: { gold: 31, silver: 41, bronze: 62 }
      },
      // 16
      {
        name: 'Transfer Window',
        hint: 'Low on fuel. Burn the way you are already moving to climb to the outer beacon.',
        bounds: 800, fuel: 92,
        start: { x: -220, y: 0, vx: 0, vy: -132, angle: -Math.PI / 2 },
        bodies: [{ id: 'sun', kind: 'star', mass: 3e6 * K, radius: 36, x: 0, y: 0 }],
        beacons: [rail('sun', 220, Math.PI + 0.2, 1, 3, 36), rail('sun', 440, 4.83, 1, 3, 36)],
        cells: [],
        asteroids: [],
        gate: { x: 560, y: 420 },
        par: { gold: 18, silver: 25, bronze: 37 }
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
        par: { gold: 35, silver: 46, bronze: 69 }
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
        par: { gold: 32, silver: 43, bronze: 65 }
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
        par: { gold: 49, silver: 65, bronze: 98 }
      },
      // 20
      {
        name: 'Grand Orrery',
        hint: 'Everything you have learned turns at once, the universe it at your fingertips.',
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
        par: { gold: 46, silver: 61, bronze: 92 }
      }
    ];
  })();
  // Chart II — Constellation V (21–25): Wormholes (mixed with prior mechanics, tuned for expert pilots).
  var third = (function () {
    var TAU = Math.PI * 2;
    function ring(cx, cy, r, mass, dir, slots, skip, radius, phase) {
      var out = [];
      for (var i = 0; i < slots; i++) {
        if (skip.indexOf(i) >= 0) continue;
        out.push({ orbit: { cx: cx, cy: cy, r: r, mass: mass, dir: dir, phase: (phase || 0) + TAU * i / slots }, radius: radius });
      }
      return out;
    }
    function rail(around, r, phase, dir, hold, br) {
      var b = { orbit: { around: around, r: r, phase: phase, dir: dir || 1 } };
      if (hold) { b.hold = hold; b.r = br || 34; }
      return b;
    }
    function prail(cx, cy, mass, r, phase, dir, hold, br) {
      var b = { orbit: { cx: cx, cy: cy, r: r, mass: mass, phase: phase, dir: dir || 1 } };
      if (hold) { b.hold = hold; b.r = br || 34; }
      return b;
    }
    var K = 1.3;
    var TWIN_M = 2.6e6 * K;

    return [
      // 21 — The Momentum Cannon: ultra-low fuel forces you to dive past the star and carry gravity speed through the wormhole
      {
        name: 'Through the Glass',
        hint: 'Low fuel. Fall under the star for free speed, then carry that slingshot straight through the wormhole.',
        bounds: 1150, fuel: 110,
        start: { x: -800, y: -260, vx: 0, vy: 0, angle: 0.45 },
        bodies: [
          { id: 'sun', kind: 'star', mass: 5.5e6 * K, radius: 42, x: -360, y: 0 },
          { id: 'world', kind: 'planet', mass: 1.5e6 * K, radius: 24, x: 640, y: 40 }
        ],
        wormholes: [
          { a: { x: -160, y: 180 }, b: { x: 220, y: -340 }, r: 30, color: '#72d8ff' }
        ],
        beacons: [
          { x: -360, y: 195 },
          { x: 560, y: -330 },
          { x: 680, y: 245 },
          { x: 300, y: 310 }
        ],
        cells: [{ x: 840, y: 40, amount: 32 }],
        asteroids: [],
        gate: { x: -680, y: 460 },
        par: { gold: 24, silver: 31, bronze: 43 }
      },
      // 22 — The Gravity Well Escape: inner beacons sit inside the Black Hole's Engine Limit; only the periapsis wormhole breaks you out
      {
        name: 'Horizon Jump',
        hint: 'The inner beacons sit inside the black hole\'s engine limit. Dive in, claim them, and escape through the wormhole.',
        bounds: 1180, fuel: 180,
        start: { x: -860, y: -320, vx: 0, vy: 0, angle: 0 },
        bodies: [
          { id: 'hole', kind: 'hole', mass: 7.5e6, radius: 14, x: -240, y: 0 },
          { id: 'world', kind: 'planet', mass: 1.5e6 * K, radius: 24, x: 560, y: 120 },
          { id: 'guard', kind: 'repulsor', mass: -1.8e6, radius: 14, orbit: { around: 'world', r: 195, period: 10, phase: 0 } }
        ],
        wormholes: [
          { a: { x: -240, y: 165 }, b: { x: 540, y: -290 }, r: 30, color: '#72d8ff' }
        ],
        beacons: [
          rail('hole', 160, 0.8, 1),
          rail('hole', 160, 3.9, 1),
          rail('world', 120, 2.2, 1, 2),
          { x: 780, y: 340 }
        ],
        cells: [{ x: 820, y: -140, amount: 42 }, { x: 160, y: 460, amount: 42 }],
        asteroids: [],
        gate: { x: -740, y: 480 },
        par: { gold: 40, silver: 51, bronze: 71 }
      },
      // 23 — The Vault: completely sealed 38-rock fortress; align your entry velocity so you emerge inside already in orbit
      {
        name: 'Sealed Ring',
        hint: 'The rock wall has no gaps. Enter the outer wormhole heading up so you emerge inside already in orbit.',
        bounds: 1120, fuel: 212,
        start: { x: -760, y: 180, vx: 0, vy: 0, angle: -1.2 },
        bodies: [
          { id: 'sun', kind: 'star', mass: 2.2e6 * K, radius: 28, x: 0, y: 0 },
          { id: 'guard', kind: 'repulsor', mass: -1.9e6, radius: 14, orbit: { cx: 0, cy: 0, r: 515, period: -16, phase: 1.2 } }
        ],
        wormholes: [
          { a: { x: 190, y: 0 }, b: { x: -580, y: -320 }, r: 28, color: '#72d8ff' }
        ],
        beacons: [
          { x: 540, y: -330 },
          prail(0, 0, 2.2e6 * K, 490, 0.7, 1),
          rail('sun', 180, 4.7, 1, 2, 36),
          { x: -185, y: 0 }
        ],
        cells: [{ x: 0, y: 190, amount: 45 }, { x: 470, y: 360, amount: 45 }],
        asteroids: ring(0, 0, 325, 2.2e6 * K, 1, 38, [], 22, 0),
        gate: { orbit: { cx: 0, cy: 0, r: 690, period: 34, phase: 0.4 } },
        par: { gold: 39, silver: 51, bronze: 70 }
      },
      // 24 — Twin Vaults: TWO completely sealed rock rings linked in series (Outside -> Cyan -> Star Vault -> Ochre -> Black Hole Vault -> back out!)
      {
        name: 'Twin Vaults',
        hint: 'Two sealed vaults linked in series. Chain the cyan and gold wormholes to reach the black hole core and return.',
        bounds: 1320, fuel: 235,
        start: { x: -940, y: -510, vx: 0, vy: 0, angle: 0 },
        bodies: [
          { id: 'sun', kind: 'star', mass: 2.0e6 * K, radius: 26, x: -480, y: 0 },
          { id: 'hole', kind: 'hole', mass: 2.8e6, radius: 12, x: 480, y: 0 }
        ],
        wormholes: [
          { a: { x: -480, y: -175 }, b: { x: -480, y: -510 }, r: 28, color: '#72d8ff' },
          { a: { x: -480, y: 175 }, b: { x: 480, y: 175 }, r: 28, color: '#f0c35a' }
        ],
        beacons: [
          rail('sun', 175, 0.4, 1),
          rail('hole', 175, 4.7, 1, 2, 36),
          { x: 480, y: -175 },
          { x: 0, y: -510 },
          { x: 0, y: 520 }
        ],
        cells: [
          { x: -655, y: 0, amount: 45 },
          { x: 655, y: 0, amount: 45 },
          { x: 480, y: -510, amount: 45 }
        ],
        asteroids: ring(-480, 0, 310, 2.0e6 * K, 1, 36, [], 22, 0).concat(ring(480, 0, 310, 2.8e6, 1, 36, [], 22, 0.4)),
        gate: { x: 920, y: 460 },
        par: { gold: 70, silver: 90, bronze: 125 }
      },
      // 25 — Klein Loop: sealed Black Hole core whose ONLY entrance is a moving wormhole orbiting inside the ring, paired with a moving wormhole on the outer planet!
      {
        name: 'Klein Loop',
        hint: 'The black hole vault is sealed. Catch the moving wormhole orbiting the outer planet to fold inside the core.',
        bounds: 1300, fuel: 268,
        start: { x: -940, y: -420, vx: 0, vy: 0, angle: 0 },
        bodies: [
          { id: 'hole', kind: 'hole', mass: 3.1e6, radius: 12, x: 0, y: 0 },
          { id: 'world', kind: 'planet', mass: 1.1e6 * K, radius: 22, orbit: { around: 'hole', r: 660, phase: 2.3 } },
          { id: 'guard', kind: 'repulsor', mass: -1.6e6, radius: 14, orbit: { cx: 0, cy: 0, r: 460, period: -16, phase: 0.4 } }
        ],
        wormholes: [
          { a: { orbit: { around: 'hole', r: 178, phase: 0.2 } }, b: { orbit: { around: 'world', r: 135, phase: 0 } }, r: 28, color: '#72d8ff' },
          { a: { x: -780, y: 380 }, b: { x: 780, y: -380 }, r: 28, color: '#f0c35a' }
        ],
        beacons: [
          rail('hole', 178, 3.3, 1, 2, 36),
          rail('hole', 178, 5.2, 1),
          rail('world', 95, 2.4, 1),
          { x: 660, y: 440 },
          { x: -640, y: 560 }
        ],
        cells: [
          { orbit: { around: 'hole', r: 178, phase: 1.8 }, amount: 45 },
          { x: -460, y: -480, amount: 45 },
          { x: 460, y: -480, amount: 45 }
        ],
        asteroids: ring(0, 0, 315, 3.1e6, 1, 36, [], 22, 0),
        gate: { orbit: { cx: 0, cy: 0, r: 880, period: 38, phase: -0.6 } },
        par: { gold: 56, silver: 72, bronze: 100 }
      }
    ];
  })();
  // Chart II — Constellation VI (26–30): Pulsars (180° twin kill beams rotating 90° every pulse, mixed with prior mechanics).
  var fourth = (function () {
    var TAU = Math.PI * 2;
    function ring(cx, cy, r, mass, dir, slots, skip, radius, phase) {
      var out = [];
      for (var i = 0; i < slots; i++) {
        if (skip.indexOf(i) >= 0) continue;
        out.push({ orbit: { cx: cx, cy: cy, r: r, mass: mass, dir: dir, phase: (phase || 0) + TAU * i / slots }, radius: radius });
      }
      return out;
    }
    function rail(around, r, phase, dir, hold, br) {
      var b = { orbit: { around: around, r: r, phase: phase, dir: dir || 1 } };
      if (hold) { b.hold = hold; b.r = br || 34; }
      return b;
    }
    var K = 1.3;

    return [
      // 26 — Lighthouse: cardinal pulsar beams alternate horizontal and vertical; ride the dark quadrants around the star
      {
        name: 'Lighthouse',
        hint: 'Pulsars fire twin opposite beams, rotating 90° each pulse. Orbit in the shadow between sweeps.',
        bounds: 1050, fuel: 175,
        start: { x: 220, y: 620, vx: 0, vy: 0, angle: -1.85 },
        bodies: [
          { id: 'p1', kind: 'pulsar', mass: 3.4e6 * K, radius: 22, x: 0, y: 0, pulse: { period: 4.5, warn: 1.3, fire: 0.55, angle: 0, width: 18 } }
        ],
        beacons: [
          { x: 0, y: -250 },
          { x: 260, y: 0 },
          { x: 0, y: 250 },
          { x: -260, y: 0 },
          rail('p1', 410, 5.5, 1, 2, 36)
        ],
        cells: [{ x: 390, y: -360, amount: 52 }],
        asteroids: [],
        gate: { x: -240, y: -640 },
        par: { gold: 43, silver: 55, bronze: 76 }
      },
      // 27 — Crossfire: two alternating pulsars (+ and ×) carve shifting safe corridors across the arena
      {
        name: 'Crossfire',
        hint: 'Two pulsars beat out of phase — one cardinal, one diagonal. Weave through the shifting dark lanes.',
        bounds: 1220, fuel: 195,
        start: { x: 880, y: 340, vx: 0, vy: 0, angle: Math.PI },
        bodies: [
          { id: 'p1', kind: 'pulsar', mass: 2.3e6 * K, radius: 20, x: -340, y: 0, pulse: { period: 4.8, warn: 1.35, fire: 0.52, angle: 0, width: 16, phase: 0 } },
          { id: 'p2', kind: 'pulsar', mass: 2.3e6 * K, radius: 20, x: 340, y: 0, pulse: { period: 4.8, warn: 1.35, fire: 0.52, angle: Math.PI / 4, width: 16, phase: 2.4 } },
          { id: 'guard', kind: 'repulsor', mass: -1.5e6, radius: 14, orbit: { cx: 0, cy: 0, r: 220, period: 14, phase: 0 } }
        ],
        beacons: [
          { x: -340, y: -220 },
          { x: 0, y: -330 },
          { x: 340, y: -220 },
          { x: 340, y: 230 },
          { x: -340, y: 230 }
        ],
        cells: [{ x: 0, y: 420, amount: 42 }, { x: -740, y: 320, amount: 42 }],
        asteroids: [],
        gate: { x: -820, y: -380 },
        par: { gold: 45, silver: 57, bronze: 79 }
      },
      // 28 — Beam Blink: a pulsar sealed inside a solid rock vault, with TWO diagonal wormhole pairs letting you blink in & out across its beams
      {
        name: 'Beam Blink',
        hint: 'The pulsar sits inside a sealed vault. Fold in through cyan, dodge the cross-beams, and blink out through gold.',
        bounds: 1180, fuel: 165,
        start: { x: -780, y: 440, vx: 0, vy: 0, angle: -0.9 },
        bodies: [
          { id: 'p1', kind: 'pulsar', mass: 2.5e6 * K, radius: 20, x: 0, y: 0, pulse: { period: 4.4, warn: 1.3, fire: 0.52, angle: 0, width: 16 } },
          { id: 'world', kind: 'planet', mass: 1.1e6 * K, radius: 22, x: 640, y: -280 }
        ],
        wormholes: [
          { a: { x: 175, y: -125 }, b: { x: -560, y: -360 }, r: 28, color: '#72d8ff' },
          { a: { x: -175, y: 125 }, b: { x: 560, y: 360 }, r: 28, color: '#f0c35a' }
        ],
        beacons: [
          { x: 0, y: -185 },
          { x: 0, y: 185 },
          rail('p1', 180, 3.6, 1),
          rail('world', 105, 1.0, 1, 2, 36),
          { x: -540, y: 420 }
        ],
        cells: [{ x: 185, y: 80, amount: 42 }, { x: 360, y: -460, amount: 42 }],
        asteroids: ring(0, 0, 320, 2.5e6 * K, 1, 38, [], 22, 0),
        gate: { x: 840, y: -420 },
        par: { gold: 30, silver: 39, bronze: 54 }
      },
      // 29 — Binary Beacon: an ORBITING pulsar revolves around a central black hole, sweeping shifting beams across the whole chart
      {
        name: 'Binary Beacon',
        hint: 'The pulsar orbits the black hole, sweeping its rotating crosshairs across the chart. Watch the charge lines.',
        bounds: 1280, fuel: 195,
        start: { x: 0, y: -820, vx: 0, vy: 0, angle: Math.PI / 2 },
        bodies: [
          { id: 'hole', kind: 'hole', mass: 4.2e6, radius: 12, x: 0, y: 0 },
          { id: 'p1', kind: 'pulsar', mass: 1.6e6 * K, radius: 18, orbit: { around: 'hole', r: 360, phase: 0.4 }, pulse: { period: 4.5, warn: 1.35, fire: 0.52, angle: 0, width: 16 } }
        ],
        wormholes: [
          { a: { x: -740, y: 360 }, b: { x: 740, y: -360 }, r: 28, color: '#72d8ff' }
        ],
        beacons: [
          rail('hole', 185, 1.6, 1),
          rail('hole', 185, 4.7, 1),
          rail('hole', 540, 2.6, 1, 2, 38),
          { x: 640, y: 440 },
          { x: -340, y: -620 }
        ],
        cells: [{ x: -540, y: 120, amount: 42 }, { x: 540, y: -120, amount: 42 }],
        asteroids: [],
        gate: { x: 760, y: 560 },
        par: { gold: 36, silver: 46, bronze: 64 }
      },
      // 30 — Magnetar (Constellation VI Capstone): three staggered pulsars in a giant triad around a central black hole, bridged by twin wormholes
      {
        name: 'Magnetar',
        hint: 'Three pulsars ring the black hole in a three-beat wave. Ride the center sling and fold across the firing triad.',
        bounds: 1320, fuel: 240,
        start: { x: 880, y: 480, vx: 0, vy: 0, angle: -2.6 },
        bodies: [
          { id: 'hole', kind: 'hole', mass: 3.6e6, radius: 12, x: 0, y: 0 },
          { id: 'p1', kind: 'pulsar', mass: 1.7e6 * K, radius: 18, x: 0, y: -490, pulse: { period: 5.1, warn: 1.35, fire: 0.5, angle: 0, width: 16, phase: 0 } },
          { id: 'p2', kind: 'pulsar', mass: 1.7e6 * K, radius: 18, x: 470, y: 290, pulse: { period: 5.1, warn: 1.35, fire: 0.5, angle: Math.PI / 6, width: 16, phase: 1.7 } },
          { id: 'p3', kind: 'pulsar', mass: 1.7e6 * K, radius: 18, x: -470, y: 290, pulse: { period: 5.1, warn: 1.35, fire: 0.5, angle: -Math.PI / 6, width: 16, phase: 3.4 } }
        ],
        wormholes: [
          { a: { x: -740, y: 280 }, b: { x: 740, y: -280 }, r: 28, color: '#72d8ff' },
          { a: { x: 0, y: -790 }, b: { x: 0, y: 740 }, r: 28, color: '#f0c35a' }
        ],
        beacons: [
          { x: 0, y: -670 },
          { x: 640, y: 400 },
          { x: -640, y: 400 },
          rail('hole', 195, 1.2, 1),
          rail('hole', 195, 4.3, 1, 2, 36)
        ],
        cells: [
          { x: -340, y: -320, amount: 45 },
          { x: 340, y: -320, amount: 45 },
          { x: 0, y: 480, amount: 45 }
        ],
        asteroids: [],
        gate: { x: -880, y: -480 },
        par: { gold: 52, silver: 67, bronze: 93 }
      }
    ];
  })();

  // ---------- CONSTELLATION VII (Levels 31–35): Polarity-Flipping Black & White Holes ----------
  var fifth = (function () {
    function ring(cx, cy, r, mass, dir, n, gaps, halfGap, phase0) {
      var out = [], h = halfGap || 2, p0 = phase0 || 0;
      for (var i = 0; i < n; i++) {
        var skip = false;
        for (var g = 0; g < (gaps || []).length; g++) {
          var d = Math.abs(i - gaps[g]); d = Math.min(d, n - d);
          if (d <= h) { skip = true; break; }
        }
        if (!skip) out.push({ radius: 11, orbit: { cx: cx, cy: cy, r: r, mass: mass, dir: dir, phase: p0 + i * Math.PI * 2 / n } });
      }
      return out;
    }
    function rail(around, r, phase, dir, hold, br) {
      var b = { orbit: { around: around, r: r, phase: phase, dir: dir || 1 } };
      if (hold) { b.hold = hold; b.r = br || 34; }
      return b;
    }
    var K = 1.3;

    return [
      // 31 — Event Inversion: dive from top-right deep inside the black hole's engine limit to sweep inner beacons, then ride the white hole flip as a zero-fuel catapult
      {
        name: 'Event Inversion',
        hint: 'Dive inside the black hole as its phase arc runs out — when it inverts to a white hole, ride the outward blast.',
        bounds: 1120, fuel: 140,
        start: { x: 740, y: -420, vx: 0, vy: 0, angle: 2.55 },
        bodies: [
          { id: 'flip1', kind: 'flip', mass: 4.8e6, radius: 14, x: 0, y: 0, flip: { period: 8.0, warn: 1.25, phase: 4.5, pushMult: 1.15, range: 360 } }
        ],
        beacons: [
          { x: 135, y: -75 },
          { x: -115, y: -115 },
          { x: -135, y: 95 },
          { x: -480, y: 240, hold: 2, r: 38 },
          { x: 480, y: 360 }
        ],
        cells: [{ x: -155, y: 0, amount: 48 }],
        asteroids: [],
        gate: { x: -740, y: 420 },
        par: { gold: 32, silver: 41, bronze: 56 }
      },
      // 32 — Bipolar: start at bottom-center between twin singularities locked 180° out of phase
      {
        name: 'Bipolar',
        hint: 'Twin singularities beat out of phase. Fall into the black pole, then let its white-hole flip launch you into its twin.',
        bounds: 1240, fuel: 195,
        start: { x: 0, y: 680, vx: 0, vy: 0, angle: -Math.PI / 2 },
        bodies: [
          { id: 'flipL', kind: 'flip', mass: 4.2e6, radius: 14, x: -350, y: 0, flip: { period: 8.0, warn: 1.2, phase: 0.8, pushMult: 1.1, range: 330 } },
          { id: 'flipR', kind: 'flip', mass: 4.2e6, radius: 14, x: 350, y: 0, flip: { period: 8.0, warn: 1.2, phase: 4.8, pushMult: 1.1, range: 330 } }
        ],
        beacons: [
          { x: -350, y: 155 },
          { x: -195, y: -60 },
          { x: 195, y: 60 },
          { x: 350, y: -155 },
          { x: 560, y: -240, hold: 2, r: 38 }
        ],
        cells: [{ x: 0, y: -340, amount: 50 }, { x: 0, y: 340, amount: 50 }],
        asteroids: [
          { x: 0, y: -210, radius: 14 },
          { x: 0, y: -150, radius: 13 },
          { x: 0, y: 150, radius: 13 },
          { x: 0, y: 210, radius: 14 }
        ],
        gate: { x: 0, y: -740 },
        par: { gold: 31, silver: 40, bronze: 56 }
      },
      // 33 — White Ejector: START TRAPPED INSIDE the sealed 38-rock fortress; sweep the inner beacons and let the white hole blast you out through the gold wormhole
      {
        name: 'White Ejector',
        hint: 'You start trapped inside the sealed vault. Sweep the inner beacons during the black-hole pull, then escape through the wormhole.',
        bounds: 1220, fuel: 165,
        start: { x: -175, y: 115, vx: 0, vy: 0, angle: -1.1 },
        bodies: [
          { id: 'flip1', kind: 'flip', mass: 3.6e6, radius: 14, x: 0, y: 0, flip: { period: 8.2, warn: 1.2, phase: 0.0, pushMult: 0.9, range: 250 } },
          { id: 'world', kind: 'planet', mass: 1.2e6 * K, radius: 22, x: 660, y: -300 }
        ],
        wormholes: [
          { a: { x: 175, y: 115 }, b: { x: -580, y: -320 }, r: 28, color: '#72d8ff' },
          { a: { x: -175, y: -115 }, b: { x: 560, y: 340 }, r: 28, color: '#f0c35a' }
        ],
        beacons: [
          { x: 120, y: -105 },
          { x: -110, y: -115 },
          rail('flip1', 175, 1.8, 1),
          rail('world', 110, 1.2, 1, 2, 36),
          { x: -520, y: 400 }
        ],
        cells: [{ x: 0, y: -165, amount: 52 }, { x: 380, y: -440, amount: 52 }],
        asteroids: ring(0, 0, 345, 3.2e6, 1, 40, [], 22, 0),
        gate: { x: 860, y: -420 },
        par: { gold: 30, silver: 39, bronze: 54 }
      },
      // 34 — Syzygy Flip: start on the far right flying left into a central star with two orbiting antiphase singularities
      {
        name: 'Syzygy Flip',
        hint: 'Two orbiting singularities trade black and white polarity across the star. Surf the white-hole wave into the inner rail.',
        bounds: 1280, fuel: 215,
        start: { x: 920, y: -140, vx: 0, vy: 0, angle: Math.PI },
        bodies: [
          { id: 'sun', kind: 'star', mass: 3.1e6 * K, radius: 28, x: 0, y: 0 },
          { id: 'flip1', kind: 'flip', mass: 3.2e6, radius: 13, orbit: { around: 'sun', r: 410, phase: 0.4, dir: 1 }, flip: { period: 7.6, warn: 1.15, phase: 0, pushMult: 1.1, range: 290 } },
          { id: 'flip2', kind: 'flip', mass: 3.2e6, radius: 13, orbit: { around: 'sun', r: 410, phase: 0.4 + Math.PI, dir: 1 }, flip: { period: 7.6, warn: 1.15, phase: 3.8, pushMult: 1.1, range: 290 } }
        ],
        beacons: [
          rail('sun', 180, 1.0, 1),
          rail('sun', 180, 4.14, 1),
          rail('sun', 610, 2.3, -1, 2, 38),
          { x: -640, y: 420 },
          { x: 640, y: 420 }
        ],
        cells: [{ x: 0, y: -260, amount: 50 }, { x: 0, y: 260, amount: 50 }],
        asteroids: [],
        gate: { x: -840, y: -460 },
        par: { gold: 47, silver: 60, bronze: 83 }
      },
      // 35 — Kerr Engine (Constellation VII Capstone): plunge from top-center into a massive central flipping singularity flanked by twin staggered pulsars
      {
        name: 'Kerr Engine',
        hint: 'A central flipping singularity drives two flanking pulsars. Catch the black-hole whip, then ride the white-hole surge clear of the beams.',
        bounds: 1320, fuel: 285,
        start: { x: -120, y: -860, vx: 0, vy: 0, angle: 1.45 },
        bodies: [
          { id: 'core', kind: 'flip', mass: 4.8e6, radius: 15, x: 0, y: 0, flip: { period: 8.0, warn: 1.25, phase: 0.8, pushMult: 1.15, range: 350 } },
          { id: 'p1', kind: 'pulsar', mass: 1.8e6 * K, radius: 18, x: -460, y: 240, pulse: { period: 4.8, warn: 1.35, fire: 0.5, angle: 0, width: 16, phase: 0 } },
          { id: 'p2', kind: 'pulsar', mass: 1.8e6 * K, radius: 18, x: 460, y: -240, pulse: { period: 4.8, warn: 1.35, fire: 0.5, angle: Math.PI / 4, width: 16, phase: 2.4 } }
        ],
        wormholes: [
          { a: { x: -210, y: -140 }, b: { x: 740, y: 340 }, r: 28, color: '#72d8ff' },
          { a: { x: 210, y: 140 }, b: { x: -740, y: 340 }, r: 28, color: '#f0c35a' }
        ],
        beacons: [
          { x: -135, y: 110 },
          { x: 135, y: -110 },
          { x: -640, y: 420 },
          { x: 640, y: 420 },
          rail('core', 340, 1.5, 1, 2, 38)
        ],
        cells: [
          { x: 0, y: -220, amount: 55 },
          { x: 0, y: 220, amount: 55 }
        ],
        asteroids: [],
        gate: { x: 140, y: 840 },
        par: { gold: 63, silver: 81, bronze: 113 }
      }
    ];
  })();

  // ---------- CONSTELLATION VIII (Levels 36–40): Solar Winds & Multi-Sector Rim Breaches ----------
  var sixth = (function () {
    function ring(cx, cy, r, mass, dir, n, gaps, halfGap, phase0) {
      var out = [], h = halfGap || 2, p0 = phase0 || 0;
      for (var i = 0; i < n; i++) {
        var skip = false;
        for (var g = 0; g < (gaps || []).length; g++) {
          var d = Math.abs(i - gaps[g]); d = Math.min(d, n - d);
          if (d <= h) { skip = true; break; }
        }
        if (!skip) out.push({ radius: 11, orbit: { cx: cx, cy: cy, r: r, mass: mass, dir: dir, phase: p0 + i * Math.PI * 2 / n } });
      }
      return out;
    }
    function rail(around, r, phase, dir, hold, br) {
      var b = { orbit: { around: around, r: r, phase: phase, dir: dir || 1 } };
      if (hold) { b.hold = hold; b.r = br || 34; }
      return b;
    }
    var K = 1.3;

    return [
      // 36 — Solar Sail: clear Sector I through the rotating asteroid ring to tear open the east rim breach & ride the solar flare into Sector II's pulsar slipstreams
      {
        name: 'Solar Sail',
        hint: 'Thread the rotating asteroid ring in Sector I to breach the east rim, then ride Sector II’s opposing slipstreams past the pulsar.',
        bounds: 1160, fuel: 215,
        start: { x: -720, y: 460, vx: 0, vy: 0, angle: -0.65 },
        bodies: [
          { id: 'sun', kind: 'star', mass: 3.4e6 * K, radius: 28, x: 0, y: 0 },
          { id: 'guard', kind: 'repulsor', mass: -1.6e6, radius: 14, orbit: { around: 'sun', r: 530, period: 18, phase: 0.8 } }
        ],
        winds: [
          { kind: 'stream', x0: 70, y0: 0, x1: 1200, y1: 0, width: 250, force: 84, onlyWhenOpen: true }
        ],
        beacons: [
          { x: -240, y: -180 },
          rail('sun', 200, 3.6, 1),
          { x: 460, y: -320 },
          { x: 420, y: 340 }
        ],
        cells: [{ x: -420, y: -440, amount: 52 }, { x: 200, y: 180, amount: 46 }],
        asteroids: ring(0, 0, 345, 3.4e6 * K, 1, 28, [0, 14], 2, 0.3),
        breach: { angle: 0, halfArc: 0.25 },
        stage2: {
          bounds: 1260, fuel: 235, fuelBonus: 135,
          start: { x: -1060, y: 0, vx: 185, vy: 0, angle: 0 },
          bodies: [
            { id: 'pMid', kind: 'pulsar', mass: 2.1e6 * K, radius: 19, x: 0, y: 0, pulse: { period: 4.8, warn: 1.35, fire: 0.5, angle: 0, width: 16 } },
            { id: 'p1', kind: 'planet', mass: 1.4e6 * K, radius: 22, x: -260, y: -460 },
            { id: 'p2', kind: 'planet', mass: 1.7e6 * K, radius: 24, x: 320, y: 470 }
          ],
          winds: [
            { kind: 'stream', x0: -1100, y0: -230, x1: 1060, y1: -230, width: 210, force: 70 },
            { kind: 'stream', x0: 1020, y0: 230, x1: -1020, y1: 230, width: 210, force: 70 }
          ],
          beacons: [
            { x: 420, y: -230 },
            { x: -420, y: 230 },
            { x: -260, y: -610 },
            rail('p2', 130, 0.9, 1, 2, 40)
          ],
          cells: [{ x: 680, y: -230, amount: 55 }, { x: -640, y: 230, amount: 50 }],
          asteroids: [],
          gate: { x: 880, y: 340 }
        },
        par: { gold: 79, silver: 101, bronze: 141 }
      },
      // 37 — Trade Winds: hold orbit under intermittent global solar gusts & pulsar crossfire in Sector I -> south rim breach -> black hole + orbiting repulsors in Sector II
      {
        name: 'Trade Winds',
        hint: 'Hold orbit against intermittent solar gusts and pulsar beams in Sector I, then breach south into the black-hole slipstreams.',
        bounds: 1220, fuel: 230,
        start: { x: 780, y: -440, vx: 0, vy: 0, angle: 2.55 },
        bodies: [
          { id: 'p1', kind: 'pulsar', mass: 2.5e6 * K, radius: 20, x: -220, y: -40, pulse: { period: 4.7, warn: 1.35, fire: 0.5, angle: 0, width: 16 } },
          { id: 'world', kind: 'planet', mass: 1.4e6 * K, radius: 22, x: 440, y: 220 }
        ],
        winds: [
          { kind: 'global', angle: 2.35, force: 36, pulse: { period: 7.8, warn: 1.4, on: 2.6, phase: 2.0 } },
          { kind: 'stream', x0: 0, y0: -240, x1: 0, y1: 1260, width: 250, force: 86, onlyWhenOpen: true }
        ],
        beacons: [
          { x: -220, y: -280 },
          { x: -480, y: 140 },
          rail('world', 125, 1.0, 1, 2, 40),
          { x: 460, y: 480 }
        ],
        cells: [{ x: 180, y: -380, amount: 55 }, { x: -160, y: 340, amount: 50 }],
        asteroids: [
          { x: 110, y: -110, radius: 14 },
          { x: 110, y: 0, radius: 15 },
          { x: 110, y: 110, radius: 14 }
        ],
        breach: { angle: Math.PI / 2, halfArc: 0.25 },
        stage2: {
          bounds: 1260, fuel: 235, fuelBonus: 110,
          start: { x: 0, y: -1060, vx: 0, vy: 175, angle: Math.PI / 2 },
          bodies: [
            { id: 'hole', kind: 'hole', mass: 4.3e6, radius: 13, x: 0, y: 0 },
            { id: 'r1', kind: 'repulsor', mass: -1.6e6, radius: 14, orbit: { around: 'hole', r: 420, period: 16, phase: 0.4 } },
            { id: 'r2', kind: 'repulsor', mass: -1.6e6, radius: 14, orbit: { around: 'hole', r: 420, period: 16, phase: 0.4 + Math.PI } }
          ],
          winds: [
            { kind: 'stream', x0: -1000, y0: -360, x1: 1000, y1: -360, width: 210, force: 74 },
            { kind: 'stream', x0: 1000, y0: 360, x1: -1000, y1: 360, width: 210, force: 74 }
          ],
          beacons: [
            { x: 580, y: -360 },
            rail('hole', 190, 1.4, 1),
            rail('hole', 190, 4.54, 1),
            { x: -580, y: 360 }
          ],
          cells: [{ x: 520, y: 280, amount: 55 }, { x: -520, y: -280, amount: 50 }],
          asteroids: [],
          gate: { x: -840, y: -440 }
        },
        par: { gold: 89, silver: 114, bronze: 159 }
      },
      // 38 — Squall Line: alternating intermittent crosswinds + flipping black/white hole -> west rim breach -> sealed vault under solar gusts
      {
        name: 'Squall Line',
        hint: 'Alternating crosswind corridors batter the flipping singularity. Breach the west rim to reach the sealed vault in Sector II.',
        bounds: 1220, fuel: 215,
        start: { x: 860, y: 220, vx: 0, vy: 0, angle: -2.85 },
        bodies: [
          { id: 'flip1', kind: 'flip', mass: 4.2e6, radius: 14, x: 0, y: 0, flip: { period: 8.2, warn: 1.2, phase: 0.6, pushMult: 1.05, range: 320 } }
        ],
        winds: [
          { kind: 'stream', x0: -380, y0: 820, x1: -380, y1: -820, width: 210, force: 66, pulse: { period: 7.4, warn: 1.3, on: 2.6, phase: 0 } },
          { kind: 'stream', x0: 380, y0: -820, x1: 380, y1: 820, width: 210, force: 66, pulse: { period: 7.4, warn: 1.3, on: 2.6, phase: 3.7 } },
          { kind: 'stream', x0: 80, y0: 0, x1: -1260, y1: 0, width: 250, force: 86, onlyWhenOpen: true }
        ],
        beacons: [
          { x: 380, y: -320 },
          { x: -135, y: -115 },
          { x: -380, y: 340 }
        ],
        cells: [{ x: 140, y: 140, amount: 55 }],
        asteroids: [],
        breach: { angle: Math.PI, halfArc: 0.25 },
        stage2: {
          bounds: 1260, fuel: 230, fuelBonus: 115,
          start: { x: 1040, y: 0, vx: -185, vy: 0, angle: Math.PI },
          bodies: [
            { id: 'sun', kind: 'star', mass: 2.8e6 * K, radius: 24, x: 0, y: 0 }
          ],
          wormholes: [
            { a: { x: 175, y: -115 }, b: { x: 640, y: -380 }, r: 28, color: '#72d8ff' },
            { a: { x: 175, y: 115 }, b: { x: -640, y: 380 }, r: 28, color: '#f0c35a' }
          ],
          winds: [
            { kind: 'global', angle: Math.PI, force: 32, pulse: { period: 8.6, warn: 1.4, on: 2.4, phase: 2.5 } }
          ],
          beacons: [
            { x: 0, y: -185 },
            { x: 0, y: 185 },
            { x: -560, y: -360 },
            { x: 560, y: 380 }
          ],
          cells: [{ x: 180, y: 80, amount: 52 }, { x: -460, y: 100, amount: 52 }],
          asteroids: ring(0, 0, 325, 2.8e6 * K, 1, 38, [], 22, 0),
          gate: { x: -860, y: -420 }
        },
        par: { gold: 72, silver: 93, bronze: 129 }
      },
      // 39 — Jetstream: twin staggered pulsars inside opposing high-speed slipstreams -> NE rim breach -> flipping core + orbiting wormhole + gusts
      {
        name: 'Jetstream',
        hint: 'Ride the opposing jetstreams past twin staggered pulsars, then breach the northeast rim into the shifting core.',
        bounds: 1260, fuel: 225,
        start: { x: -180, y: -860, vx: 0, vy: 0, angle: 1.2 },
        bodies: [
          { id: 'p1', kind: 'pulsar', mass: 2.1e6 * K, radius: 19, x: -340, y: 0, pulse: { period: 4.9, warn: 1.35, fire: 0.5, angle: 0, width: 16, phase: 0 } },
          { id: 'p2', kind: 'pulsar', mass: 2.1e6 * K, radius: 19, x: 340, y: 0, pulse: { period: 4.9, warn: 1.35, fire: 0.5, angle: Math.PI / 4, width: 16, phase: 2.45 } }
        ],
        winds: [
          { kind: 'stream', x0: -980, y0: -380, x1: 980, y1: -380, width: 220, force: 76 },
          { kind: 'stream', x0: 980, y0: 380, x1: -980, y1: 380, width: 220, force: 76 },
          { kind: 'stream', x0: -120, y0: 120, x1: 940, y1: -940, width: 250, force: 86, onlyWhenOpen: true }
        ],
        beacons: [
          { x: 460, y: -380 },
          { x: 640, y: 120 },
          { x: -460, y: 380 },
          { x: -640, y: -120 }
        ],
        cells: [{ x: 0, y: -380, amount: 52 }, { x: 0, y: 380, amount: 52 }],
        asteroids: [],
        breach: { angle: -Math.PI / 4, halfArc: 0.25 },
        stage2: {
          bounds: 1280, fuel: 235, fuelBonus: 120,
          start: { x: -780, y: 740, vx: 135, vy: -130, angle: -0.76 },
          bodies: [
            { id: 'core', kind: 'flip', mass: 4.5e6, radius: 15, x: 0, y: 0, flip: { period: 8.0, warn: 1.2, phase: 0.8, pushMult: 1.1, range: 340 } },
            { id: 'shep', kind: 'planet', mass: 1.2e6 * K, radius: 22, x: 620, y: -340 }
          ],
          wormholes: [
            { a: { orbit: { around: 'core', r: 210, period: 16, phase: 0.4 } }, b: { x: -640, y: -420 }, r: 28, color: '#72d8ff' }
          ],
          winds: [
            { kind: 'global', angle: -0.65, force: 34, pulse: { period: 8.4, warn: 1.4, on: 2.5, phase: 1.8 } }
          ],
          beacons: [
            { x: -135, y: 105 },
            { x: 135, y: -105 },
            { x: -660, y: -220 },
            rail('shep', 135, 1.0, 1, 2, 40)
          ],
          cells: [{ x: 340, y: 380, amount: 55 }, { x: -240, y: -480, amount: 55 }],
          asteroids: [],
          gate: rail('core', 620, 2.6, 1)
        },
        par: { gold: 88, silver: 114, bronze: 158 }
      },
      // 40 — Heliopause (Chart II Grand Finale — Locked until all 39 prior charts are completed!):
      // Massive 2-sector epic uniting EVERY mechanic in the game (10 beacons total)
      {
        name: 'Heliopause',
        hint: 'Every celestial hazard across two vast sectors. Clear Sector I to ride the northern solar flare through the breach into the inner sanctum.',
        bounds: 1460, fuel: 265,
        start: { x: 0, y: 1120, vx: 0, vy: 0, angle: -Math.PI / 2 },
        bodies: [
          { id: 'core', kind: 'flip', mass: 4.5e6, radius: 15, x: 0, y: 0, flip: { period: 8.4, warn: 1.25, phase: 0.8, pushMult: 1.1, range: 340 } },
          { id: 'sun', kind: 'star', mass: 2.3e6 * K, radius: 24, orbit: { around: 'core', r: 580, period: 36, phase: 0.2 } },
          { id: 'moon', kind: 'moon', mass: 0.42e6 * K, radius: 11, orbit: { around: 'sun', r: 120, phase: 1.0 } },
          { id: 'p1', kind: 'pulsar', mass: 1.7e6 * K, radius: 18, orbit: { around: 'core', r: 520, period: 36, phase: 0.2 + Math.PI }, pulse: { period: 5.0, warn: 1.35, fire: 0.5, angle: 0, width: 16 } },
          { id: 'rep', kind: 'repulsor', mass: -1.8e6, radius: 14, x: 640, y: 420 }
        ],
        wormholes: [
          { a: { x: -860, y: 420 }, b: { x: 860, y: -420 }, r: 28, color: '#72d8ff' }
        ],
        winds: [
          { kind: 'stream', x0: -620, y0: 820, x1: -620, y1: -820, width: 220, force: 74 },
          { kind: 'global', angle: 0, force: 30, pulse: { period: 9.0, warn: 1.4, on: 2.4, phase: 3.0 } },
          { kind: 'stream', x0: 0, y0: 140, x1: 0, y1: -1500, width: 260, force: 90, onlyWhenOpen: true }
        ],
        beacons: [
          { x: -620, y: 460 },
          { x: -620, y: -460 },
          { x: 140, y: -120 },
          { x: 820, y: -220 },
          { x: 640, y: 640, hold: 2, r: 40 }
        ],
        cells: [
          { x: -340, y: 680, amount: 58 },
          { x: 380, y: -560, amount: 58 },
          { x: 340, y: 420, amount: 58 }
        ],
        asteroids: [],
        breach: { angle: -Math.PI / 2, halfArc: 0.25 },
        stage2: {
          bounds: 1480, fuel: 285, fuelBonus: 165,
          start: { x: 0, y: 1260, vx: 0, vy: -190, angle: -Math.PI / 2 },
          bodies: [
            { id: 'hole', kind: 'hole', mass: 3.8e6, radius: 13, x: 0, y: 0 },
            { id: 'pL', kind: 'pulsar', mass: 1.7e6 * K, radius: 18, x: -720, y: -120, pulse: { period: 5.0, warn: 1.35, fire: 0.5, angle: 0, width: 16, phase: 0 } },
            { id: 'pR', kind: 'pulsar', mass: 1.7e6 * K, radius: 18, x: 720, y: 120, pulse: { period: 5.0, warn: 1.35, fire: 0.5, angle: Math.PI / 4, width: 16, phase: 2.5 } },
            { id: 'flipN', kind: 'flip', mass: 3.8e6, radius: 14, x: 0, y: -780, flip: { period: 8.2, warn: 1.2, phase: 1.2, pushMult: 1.08, range: 310 } }
          ],
          wormholes: [
            { a: { x: 185, y: -155 }, b: { x: -640, y: 540 }, r: 28, color: '#72d8ff' },
            { a: { x: 185, y: 155 }, b: { x: 640, y: -540 }, r: 28, color: '#f0c35a' }
          ],
          winds: [
            { kind: 'stream', x0: -1020, y0: -480, x1: 1020, y1: -480, width: 220, force: 74 },
            { kind: 'stream', x0: 1020, y0: 520, x1: -1020, y1: 520, width: 220, force: 74 },
            { kind: 'global', angle: -Math.PI / 2, force: 28, pulse: { period: 9.2, warn: 1.4, on: 2.4, phase: 2.0 } }
          ],
          beacons: [
            { x: 0, y: -195 },
            { x: 0, y: 195 },
            { x: -860, y: -480 },
            { x: 0, y: -960 },
            { x: 860, y: 520 }
          ],
          cells: [
            { x: 185, y: 95, amount: 60 },
            { x: -460, y: -480, amount: 60 },
            { x: 460, y: 520, amount: 60 }
          ],
          asteroids: ring(0, 0, 345, 3.8e6, 1, 40, [], 22, 0),
          gate: rail('hole', 680, 0.8, 1)
        },
        par: { gold: 119, silver: 153, bronze: 212 }
      },
      // 41 — Corona Storm (40-tier 2-sector epic): Binary stars + flanking pulsars + global gusts -> East Breach -> Antiphase twin flipping poles in triple alternating jetstreams
      {
        name: 'Corona Storm',
        hint: 'Twin binary stars and flanking pulsars guard Sector I. Breach east into the antiphase dipole swept by triple alternating jetstreams.',
        bounds: 1420, fuel: 260,
        start: { x: -860, y: -520, vx: 0, vy: 0, angle: 0.45 },
        bodies: [
          { id: 's1', kind: 'star', mass: 2.3e6 * K, radius: 24, orbit: { cx: 0, cy: 0, r: 210, period: 19, phase: 0 } },
          { id: 's2', kind: 'star', mass: 2.3e6 * K, radius: 24, orbit: { cx: 0, cy: 0, r: 210, period: 19, phase: Math.PI } },
          { id: 'pN', kind: 'pulsar', mass: 1.7e6 * K, radius: 18, x: 0, y: -660, pulse: { period: 4.9, warn: 1.35, fire: 0.5, angle: 0, width: 16, phase: 0 } },
          { id: 'pS', kind: 'pulsar', mass: 1.7e6 * K, radius: 18, x: 0, y: 660, pulse: { period: 4.9, warn: 1.35, fire: 0.5, angle: Math.PI / 4, width: 16, phase: 2.45 } }
        ],
        wormholes: [
          { a: { x: -720, y: 420 }, b: { x: 720, y: -420 }, r: 28, color: '#72d8ff' }
        ],
        winds: [
          { kind: 'global', angle: -0.5, force: 32, pulse: { period: 8.6, warn: 1.4, on: 2.5, phase: 2.2 } },
          { kind: 'stream', x0: 140, y0: 0, x1: 1460, y1: 0, width: 260, force: 90, onlyWhenOpen: true }
        ],
        beacons: [
          { x: -320, y: -660 },
          { x: -580, y: 380 },
          { x: 580, y: -380 },
          { x: 320, y: 660 },
          { x: 640, y: 360, hold: 2, r: 40 }
        ],
        cells: [
          { x: -460, y: -120, amount: 58 },
          { x: 460, y: 120, amount: 58 },
          { x: 0, y: 920, amount: 58 }
        ],
        asteroids: [],
        breach: { angle: 0, halfArc: 0.25 },
        stage2: {
          bounds: 1440, fuel: 275, fuelBonus: 70,
          start: { x: -1220, y: 0, vx: 190, vy: 0, angle: 0 },
          bodies: [
            { id: 'flipL', kind: 'flip', mass: 4.3e6, radius: 14, x: -440, y: 0, flip: { period: 8.0, warn: 1.2, phase: 0.8, pushMult: 1.1, range: 330 } },
            { id: 'flipR', kind: 'flip', mass: 4.3e6, radius: 14, x: 440, y: 0, flip: { period: 8.0, warn: 1.2, phase: 4.8, pushMult: 1.1, range: 330 } },
            { id: 'rep', kind: 'repulsor', mass: -1.7e6, radius: 14, orbit: { cx: 0, cy: 0, r: 240, period: 14, phase: 0 } }
          ],
          winds: [
            { kind: 'stream', x0: -1020, y0: -480, x1: 1020, y1: -480, width: 210, force: 76 },
            { kind: 'stream', x0: 960, y0: 0, x1: -960, y1: 0, width: 190, force: 64, pulse: { period: 7.4, warn: 1.3, on: 2.6, phase: 1.5 } },
            { kind: 'stream', x0: -1020, y0: 480, x1: 1020, y1: 480, width: 210, force: 76 }
          ],
          beacons: [
            { x: -440, y: -210 },
            { x: -440, y: 210 },
            { x: 440, y: -210 },
            { x: 440, y: 210 },
            { x: 0, y: -480 }
          ],
          cells: [
            { x: 0, y: -740, amount: 60 },
            { x: 0, y: 480, amount: 60 },
            { x: 780, y: -480, amount: 55 }
          ],
          asteroids: [
            { x: 0, y: -240, radius: 14 },
            { x: 0, y: -175, radius: 13 },
            { x: 0, y: 175, radius: 13 },
            { x: 0, y: 240, radius: 14 }
          ],
          gate: { x: 960, y: 480 }
        },
        par: { gold: 98, silver: 126, bronze: 175 }
      },
      // 42 — Twin Breach (40-tier 2-sector epic): START TRAPPED INSIDE the left sealed flip-vault, warp into the right pulsar-vault, escape -> SW Breach -> Black hole orbited by BOTH a pulsar & a flip-hole
      {
        name: 'Twin Breach',
        hint: 'You start trapped in the left flip-vault. Warp through the right pulsar-vault to escape, then breach southwest into the binary abyss.',
        bounds: 1440, fuel: 265,
        start: { x: -625, y: -95, vx: 0, vy: 0, angle: -0.35 },
        bodies: [
          { id: 'flipL', kind: 'flip', mass: 3.3e6, radius: 14, x: -440, y: 0, flip: { period: 8.2, warn: 1.2, phase: 0, pushMult: 0.9, range: 240 } },
          { id: 'pR', kind: 'pulsar', mass: 2.2e6 * K, radius: 19, x: 440, y: 0, pulse: { period: 4.8, warn: 1.35, fire: 0.5, angle: 0, width: 16 } }
        ],
        wormholes: [
          { a: { x: -270, y: 115 }, b: { x: 605, y: -115 }, r: 28, color: '#72d8ff' },
          { a: { x: 605, y: 115 }, b: { x: -780, y: -480 }, r: 28, color: '#f0c35a' }
        ],
        winds: [
          { kind: 'global', angle: 0.8, force: 30, pulse: { period: 8.8, warn: 1.4, on: 2.4, phase: 2.0 } },
          { kind: 'stream', x0: 80, y0: -80, x1: -1060, y1: 1060, width: 260, force: 90, onlyWhenOpen: true }
        ],
        beacons: [
          { x: -440, y: -185 },
          { x: -440, y: 185 },
          { x: 440, y: -185 },
          { x: 440, y: 185 },
          { x: 0, y: 660, hold: 2, r: 40 }
        ],
        cells: [
          { x: -285, y: -115, amount: 58 },
          { x: 260, y: 0, amount: 58 },
          { x: 0, y: -420, amount: 58 }
        ],
        asteroids: ring(-440, 0, 330, 3.3e6, 1, 38, [], 22, 0).concat(ring(440, 0, 330, 2.2e6 * K, -1, 38, [], 22, 0)),
        breach: { angle: 2.356, halfArc: 0.25 },
        stage2: {
          bounds: 1460, fuel: 280, fuelBonus: 165,
          start: { x: 880, y: -860, vx: -135, vy: 135, angle: 2.356 },
          bodies: [
            { id: 'hole', kind: 'hole', mass: 4.5e6, radius: 13, x: 0, y: 0 },
            { id: 'p1', kind: 'pulsar', mass: 1.7e6 * K, radius: 18, orbit: { around: 'hole', r: 460, period: 30, phase: 0.2 }, pulse: { period: 4.9, warn: 1.35, fire: 0.5, angle: 0, width: 16 } },
            { id: 'f1', kind: 'flip', mass: 3.1e6, radius: 13, orbit: { around: 'hole', r: 460, period: 30, phase: 0.2 + Math.PI }, flip: { period: 7.8, warn: 1.2, phase: 0.8, pushMult: 1.1, range: 290 } }
          ],
          winds: [
            { kind: 'stream', x0: 820, y0: -520, x1: -520, y1: 820, width: 220, force: 72 },
            { kind: 'stream', x0: -820, y0: 520, x1: 520, y1: -820, width: 220, force: 72 }
          ],
          beacons: [
            rail('hole', 195, 1.0, 1),
            rail('hole', 195, 4.14, 1),
            { x: -660, y: -420 },
            { x: 660, y: 420 },
            { x: -460, y: 740 }
          ],
          cells: [
            { x: 460, y: -460, amount: 60 },
            { x: -460, y: 460, amount: 60 },
            { x: 0, y: 720, amount: 58 }
          ],
          asteroids: [],
          gate: rail('hole', 680, 2.2, 1)
        },
        par: { gold: 105, silver: 135, bronze: 188 }
      },
      // 43 — Solar Crucible (40-tier 2-sector epic): 3-Pulsar Triad around a central Flipping Singularity + alternating crosswinds + moving wormhole -> NW Breach -> Sealed Flip Fortress + Binary Escorts
      {
        name: 'Solar Crucible',
        hint: 'A 3-pulsar triad and alternating crosswinds ring the flipping core. Breach northwest into the sealed flip fortress.',
        bounds: 1460, fuel: 275,
        start: { x: 1040, y: 360, vx: 0, vy: 0, angle: 2.95 },
        bodies: [
          { id: 'core', kind: 'flip', mass: 4.4e6, radius: 14, x: 0, y: 0, flip: { period: 8.2, warn: 1.2, phase: 0.6, pushMult: 1.1, range: 330 } },
          { id: 'p1', kind: 'pulsar', mass: 1.6e6 * K, radius: 18, x: 0, y: -560, pulse: { period: 5.1, warn: 1.35, fire: 0.5, angle: 0, width: 16, phase: 0 } },
          { id: 'p2', kind: 'pulsar', mass: 1.6e6 * K, radius: 18, x: 540, y: 340, pulse: { period: 5.1, warn: 1.35, fire: 0.5, angle: Math.PI / 6, width: 16, phase: 1.7 } },
          { id: 'p3', kind: 'pulsar', mass: 1.6e6 * K, radius: 18, x: -540, y: 340, pulse: { period: 5.1, warn: 1.35, fire: 0.5, angle: -Math.PI / 6, width: 16, phase: 3.4 } }
        ],
        wormholes: [
          { a: { orbit: { around: 'core', r: 220, period: 16, phase: 0.6 } }, b: { x: -780, y: -480 }, r: 28, color: '#72d8ff' }
        ],
        winds: [
          { kind: 'stream', x0: -460, y0: 880, x1: -460, y1: -880, width: 210, force: 70, pulse: { period: 7.6, warn: 1.3, on: 2.6, phase: 0 } },
          { kind: 'stream', x0: 460, y0: -880, x1: 460, y1: 880, width: 210, force: 70, pulse: { period: 7.6, warn: 1.3, on: 2.6, phase: 3.8 } },
          { kind: 'stream', x0: 100, y0: 100, x1: -1080, y1: -1080, width: 260, force: 90, onlyWhenOpen: true }
        ],
        beacons: [
          { x: 0, y: -780 },
          { x: 740, y: 460 },
          { x: -740, y: 460 },
          { x: 145, y: -120 },
          { x: -145, y: 120 }
        ],
        cells: [
          { x: 380, y: -380, amount: 60 },
          { x: -380, y: -380, amount: 60 },
          { x: 0, y: 580, amount: 60 }
        ],
        asteroids: [],
        breach: { angle: -2.356, halfArc: 0.25 },
        stage2: {
          bounds: 1460, fuel: 285, fuelBonus: 170,
          start: { x: 940, y: 820, vx: -135, vy: -135, angle: -2.356 },
          bodies: [
            { id: 'core2', kind: 'flip', mass: 3.8e6, radius: 14, x: 0, y: 0, flip: { period: 8.0, warn: 1.2, phase: 0.4, pushMult: 0.95, range: 265 } },
            { id: 'sW', kind: 'star', mass: 2.1e6 * K, radius: 22, x: -740, y: -240 },
            { id: 'sE', kind: 'star', mass: 2.1e6 * K, radius: 22, x: 680, y: 180 },
            { id: 'repW', kind: 'repulsor', mass: -1.6e6, radius: 14, orbit: { around: 'sW', r: 320, period: 16, phase: 0 } }
          ],
          wormholes: [
            { a: { x: 185, y: -155 }, b: { x: 640, y: -560 }, r: 28, color: '#72d8ff' },
            { a: { x: 185, y: 155 }, b: { x: -640, y: 560 }, r: 28, color: '#f0c35a' }
          ],
          winds: [
            { kind: 'global', angle: -2.35, force: 32, pulse: { period: 8.6, warn: 1.4, on: 2.5, phase: 1.8 } }
          ],
          beacons: [
            { x: 0, y: -190 },
            { x: 0, y: 190 },
            { x: -740, y: -460 },
            { x: 520, y: 620 },
            rail('sW', 225, 2.0, 1, 2, 42)
          ],
          cells: [
            { x: -185, y: 0, amount: 58 },
            { x: 420, y: -620, amount: 60 },
            { x: -420, y: 620, amount: 60 }
          ],
          asteroids: ring(0, 0, 345, 3.6e6, 1, 40, [], 22, 0),
          gate: { x: -960, y: -560 }
        },
        par: { gold: 117, silver: 151, bronze: 210 }
      },
      // 44 — Event Tempest (40-tier 2-sector epic): Nested Star-Planet-Moon + Twin Antiphase Flipping Holes + Opposing Jetstreams -> South Breach -> 4-Corner Crucible (2 Pulsars + 2 Flip Holes around Central Black Hole)
      {
        name: 'Event Tempest',
        hint: 'Two antiphase singularities orbit the nested system in Sector I. Breach south into the four-corner crucible around the black hole.',
        bounds: 1460, fuel: 275,
        start: { x: 960, y: -560, vx: 0, vy: 0, angle: 2.65 },
        bodies: [
          { id: 'sun', kind: 'star', mass: 3.1e6 * K, radius: 26, x: 0, y: 0 },
          { id: 'pl', kind: 'planet', mass: 1.1e6 * K, radius: 20, orbit: { around: 'sun', r: 640, period: 36, phase: 2.2 } },
          { id: 'mn', kind: 'moon', mass: 0.36e6 * K, radius: 10, orbit: { around: 'pl', r: 105, phase: 0.5 } },
          { id: 'f1', kind: 'flip', mass: 3.3e6, radius: 13, orbit: { around: 'sun', r: 440, period: 28, phase: 0.4 }, flip: { period: 7.8, warn: 1.2, phase: 0, pushMult: 1.1, range: 290 } },
          { id: 'f2', kind: 'flip', mass: 3.3e6, radius: 13, orbit: { around: 'sun', r: 440, period: 28, phase: 0.4 + Math.PI }, flip: { period: 7.8, warn: 1.2, phase: 3.9, pushMult: 1.1, range: 290 } }
        ],
        wormholes: [
          { a: { x: -860, y: -420 }, b: { x: 860, y: 420 }, r: 28, color: '#72d8ff' }
        ],
        winds: [
          { kind: 'stream', x0: -1020, y0: -560, x1: 1020, y1: -560, width: 210, force: 74 },
          { kind: 'stream', x0: 1020, y0: 560, x1: -1020, y1: 560, width: 210, force: 74 },
          { kind: 'stream', x0: 0, y0: -120, x1: 0, y1: 1500, width: 260, force: 90, onlyWhenOpen: true }
        ],
        beacons: [
          rail('sun', 195, 1.0, 1),
          rail('sun', 195, 4.14, 1),
          { x: -660, y: -560 },
          { x: 660, y: 560 },
          rail('pl', 145, 1.2, 1, 2, 42)
        ],
        cells: [
          { x: 0, y: -320, amount: 60 },
          { x: 0, y: 320, amount: 60 },
          { x: -780, y: 260, amount: 58 }
        ],
        asteroids: [],
        breach: { angle: Math.PI / 2, halfArc: 0.25 },
        stage2: {
          bounds: 1480, fuel: 295, fuelBonus: 215,
          start: { x: 0, y: -1260, vx: 0, vy: 190, angle: Math.PI / 2 },
          bodies: [
            { id: 'hole', kind: 'hole', mass: 4.4e6, radius: 13, x: 0, y: 0 },
            { id: 'pNW', kind: 'pulsar', mass: 1.7e6 * K, radius: 18, x: -580, y: -360, pulse: { period: 4.9, warn: 1.35, fire: 0.5, angle: 0, width: 16, phase: 0 } },
            { id: 'pSE', kind: 'pulsar', mass: 1.7e6 * K, radius: 18, x: 580, y: 360, pulse: { period: 4.9, warn: 1.35, fire: 0.5, angle: Math.PI / 4, width: 16, phase: 2.45 } },
            { id: 'fNE', kind: 'flip', mass: 3.6e6, radius: 14, x: 580, y: -360, flip: { period: 8.0, warn: 1.2, phase: 0.6, pushMult: 1.1, range: 310 } },
            { id: 'fSW', kind: 'flip', mass: 3.6e6, radius: 14, x: -580, y: 360, flip: { period: 8.0, warn: 1.2, phase: 4.6, pushMult: 1.1, range: 310 } }
          ],
          winds: [
            { kind: 'global', angle: 0.4, force: 34, pulse: { period: 8.4, warn: 1.4, on: 2.5, phase: 2.0 } }
          ],
          beacons: [
            rail('hole', 195, 0.8, 1),
            { x: -580, y: -580 },
            { x: 580, y: -580 },
            { x: 580, y: 580 },
            { x: -580, y: 580 }
          ],
          cells: [
            { x: 0, y: -580, amount: 62 },
            { x: 0, y: 580, amount: 62 },
            { x: -580, y: 0, amount: 60 }
          ],
          asteroids: [],
          gate: rail('hole', 690, 3.6, 1)
        },
        par: { gold: 136, silver: 175, bronze: 243 }
      },
      // 45 — Singularity's End (LOCKED CHART II GRAND FINALE — THREE CONTINUOUS SECTORS, 14 BEACONS! Sector III is BRUTALLY HARD!)
      {
        name: "Singularity's End",
        hint: 'Three continuous sectors to the edge of the cosmos. Survive the Outer Belt and Inversion Vault to face the brutal Event Horizon Sanctum.',
        bounds: 1420, fuel: 265,
        start: { x: -940, y: 620, vx: 0, vy: 0, angle: -0.55 },
        bodies: [
          { id: 'sun', kind: 'star', mass: 3.2e6 * K, radius: 26, x: 0, y: 0 },
          { id: 'p1', kind: 'pulsar', mass: 1.7e6 * K, radius: 18, orbit: { around: 'sun', r: 440, period: 30, phase: 0.4 }, pulse: { period: 4.9, warn: 1.35, fire: 0.5, angle: 0, width: 16 } },
          { id: 'rep', kind: 'repulsor', mass: -1.8e6, radius: 14, orbit: { around: 'sun', r: 440, period: 30, phase: 0.4 + Math.PI } }
        ],
        wormholes: [
          { a: { x: -760, y: -420 }, b: { x: 760, y: 420 }, r: 28, color: '#72d8ff' }
        ],
        winds: [
          { kind: 'stream', x0: -980, y0: -520, x1: 980, y1: -520, width: 210, force: 74 },
          { kind: 'global', angle: -0.35, force: 30, pulse: { period: 8.6, warn: 1.4, on: 2.4, phase: 2.0 } },
          { kind: 'stream', x0: 120, y0: 0, x1: 1460, y1: 0, width: 260, force: 90, onlyWhenOpen: true }
        ],
        beacons: [
          { x: -640, y: -520 },
          { x: 640, y: -520 },
          rail('sun', 195, 1.5, 1),
          { x: 680, y: 520 }
        ],
        cells: [
          { x: -340, y: 440, amount: 58 },
          { x: 0, y: -520, amount: 58 },
          { x: 340, y: 440, amount: 58 }
        ],
        asteroids: [],
        breach: { angle: 0, halfArc: 0.25 },
        stage2: {
          // SECTOR II: The Inversion Vault -> North Rim Breach into Sector III
          bounds: 1460, fuel: 285, fuelBonus: 180,
          start: { x: -1240, y: 0, vx: 190, vy: 0, angle: 0 },
          bodies: [
            { id: 'flip2', kind: 'flip', mass: 3.8e6, radius: 14, x: 0, y: 0, flip: { period: 8.0, warn: 1.2, phase: 0.4, pushMult: 0.95, range: 265 } },
            { id: 'pL2', kind: 'pulsar', mass: 1.7e6 * K, radius: 18, x: -720, y: -180, pulse: { period: 4.8, warn: 1.35, fire: 0.5, angle: 0, width: 16, phase: 0 } },
            { id: 'pR2', kind: 'pulsar', mass: 1.7e6 * K, radius: 18, x: 720, y: 180, pulse: { period: 4.8, warn: 1.35, fire: 0.5, angle: Math.PI / 4, width: 16, phase: 2.4 } }
          ],
          wormholes: [
            { a: { x: 185, y: -155 }, b: { x: -640, y: 540 }, r: 28, color: '#72d8ff' },
            { a: { x: 185, y: 155 }, b: { x: 640, y: -540 }, r: 28, color: '#f0c35a' }
          ],
          winds: [
            { kind: 'stream', x0: -1020, y0: -500, x1: 1020, y1: -500, width: 210, force: 76 },
            { kind: 'stream', x0: 1020, y0: 520, x1: -1020, y1: 520, width: 210, force: 76 },
            { kind: 'stream', x0: 0, y0: -380, x1: 0, y1: -1500, width: 260, force: 92, onlyWhenOpen: true }
          ],
          beacons: [
            { x: 0, y: -190 },
            { x: 0, y: 190 },
            { x: -860, y: -500 },
            { x: 860, y: 520 },
            { x: 0, y: -740 }
          ],
          cells: [
            { x: -185, y: 0, amount: 58 },
            { x: 460, y: 520, amount: 62 },
            { x: -460, y: -500, amount: 62 }
          ],
          asteroids: ring(0, 0, 345, 3.6e6, 1, 40, [], 22, 0),
          breach: { angle: -Math.PI / 2, halfArc: 0.25 },
          stage2: {
            // SECTOR III (BRUTALLY HARD): Event Horizon Sanctum — Sealed Fast-Flipping Core with ORBITING Entry Wormhole + 3-Beat Pulsar Triad + Northern Flip Singularity + Opposing Jetstreams + Rapid Global Gusts + Orbiting Gate!
            bounds: 1560, fuel: 310, fuelBonus: 210,
            start: { x: 0, y: 1340, vx: 0, vy: -195, angle: -Math.PI / 2 },
            bodies: [
              { id: 'core3', kind: 'flip', mass: 4.2e6, radius: 14, x: 0, y: 0, flip: { period: 7.4, warn: 1.15, phase: 0.3, pushMult: 0.95, range: 260 } },
              { id: 'pA', kind: 'pulsar', mass: 1.8e6 * K, radius: 18, x: -760, y: -220, pulse: { period: 4.5, warn: 1.25, fire: 0.5, angle: 0, width: 17, phase: 0 } },
              { id: 'pB', kind: 'pulsar', mass: 1.8e6 * K, radius: 18, x: 760, y: -220, pulse: { period: 4.5, warn: 1.25, fire: 0.5, angle: Math.PI / 6, width: 17, phase: 1.5 } },
              { id: 'pC', kind: 'pulsar', mass: 1.8e6 * K, radius: 18, x: 0, y: 760, pulse: { period: 4.5, warn: 1.25, fire: 0.5, angle: -Math.PI / 6, width: 17, phase: 3.0 } },
              { id: 'flipTop', kind: 'flip', mass: 4.4e6, radius: 14, x: 0, y: -880, flip: { period: 7.6, warn: 1.15, phase: 3.8, pushMult: 1.15, range: 330 } }
            ],
            wormholes: [
              { a: { orbit: { around: 'core3', r: 195, period: 16, phase: 5.5 } }, b: { x: -680, y: 540 }, r: 28, color: '#72d8ff' },
              { a: { x: 185, y: 165 }, b: { x: 680, y: -560 }, r: 28, color: '#f0c35a' }
            ],
            winds: [
              { kind: 'stream', x0: -1120, y0: -520, x1: 1120, y1: -520, width: 220, force: 82 },
              { kind: 'stream', x0: 1120, y0: 540, x1: -1120, y1: 540, width: 220, force: 82 },
              { kind: 'global', angle: -0.6, force: 36, pulse: { period: 7.2, warn: 1.3, on: 2.5, phase: 1.4 } }
            ],
            beacons: [
              { x: 0, y: -195 },
              { x: 0, y: 195 },
              { x: 0, y: -1050 },
              { x: -940, y: -520 },
              { x: 940, y: 540, hold: 2, r: 40 }
            ],
            cells: [
              { x: -185, y: 0, amount: 65 },
              { x: 480, y: 540, amount: 68 },
              { x: -480, y: -520, amount: 68 },
              { x: 380, y: -920, amount: 65 }
            ],
            asteroids: ring(0, 0, 355, 4.0e6, 1, 42, [], 22, 0),
            gate: rail('core3', 680, 0.6, 1)
          }
        },
        par: { gold: 188, silver: 241, bronze: 335 }
      }
    ];
  })();
  return first.concat(second, third, fourth, fifth, sixth);
});
