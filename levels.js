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
        bounds: 800, fuel: 105,
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
  return first.concat(second);
});
