/* Gravity Assist: deterministic flight simulation. No DOM. Works in the browser (global Sim) and in Node (module.exports). */
(function (root, factory) {
  var S = factory();
  if (typeof module === 'object' && module.exports) module.exports = S; else root.Sim = S;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DT = 1 / 120;              // fixed step, seconds
  var SHIP = {
    thrust: 150,                 // px/s^2 while the engine burns
    turn: 3.6,                   // rad/s
    radius: 7,                   // collision radius, px (forgiving: only the hull's middle can crash)
    reach: 18,                   // pickup reach, px: beacons, fuel and the gate count as soon as the nose touches
    burn: 10,                    // fuel units per second of thrust
    soft: 400                    // gravity softening, px^2
  };
  var DEFAULT_BEACON_R = 24, DEFAULT_GATE_R = 30, DEFAULT_CELL_R = 18;
  var TAU = Math.PI * 2;

  // Anything on a rail with no period set moves at true circular-orbit speed: the period comes
  // from the mass it circles (the `around` body, or orbit.mass for a point centre). orbit.dir = -1
  // runs it the other way. This keeps every moon, beacon and rock moving the way the ship would.
  function keplerPeriod(o, map) {
    var m = o.mass;
    if (m === undefined && o.around && map[o.around]) m = map[o.around].mass;
    if (!(m > 0)) return 0;
    return (o.dir === -1 ? -1 : 1) * TAU * Math.sqrt(o.r * o.r * o.r / m);
  }
  function index(level) {
    var map = {};
    (level.bodies || []).forEach(function (b) { if (b.id) map[b.id] = b; });
    if (!level._railsSet) {
      var all = [].concat(level.bodies || [], level.beacons || [], level.cells || [], level.asteroids || [], level.gate ? [level.gate] : []);
      all.forEach(function (e) { if (e.orbit && e.orbit.period === undefined) e.orbit.period = keplerPeriod(e.orbit, map); });
      try { Object.defineProperty(level, '_railsSet', { value: true }); } catch (err) { level._railsSet = true; }
    }
    return map;
  }
  // Position at time t of anything that is either fixed ({x, y}) or on a rail
  // ({orbit: {around: bodyId, r, period, phase}} or {orbit: {cx, cy, r, period, phase}}).
  // A negative period runs clockwise on screen (y grows downward).
  function posOf(level, ent, t, idx, out) {
    out = out || { x: 0, y: 0 };
    var o = ent.orbit;
    if (!o) { out.x = ent.x || 0; out.y = ent.y || 0; return out; }
    var cx = o.cx || 0, cy = o.cy || 0;
    if (o.around) {
      var c = posOf(level, (idx || index(level))[o.around], t, idx, { x: 0, y: 0 });
      cx = c.x; cy = c.y;
    }
    var a = (o.phase || 0) + (o.period ? TAU * t / o.period : 0);
    out.x = cx + o.r * Math.cos(a); out.y = cy + o.r * Math.sin(a);
    return out;
  }

  function create(level) {
    var st = level.start || {};
    return {
      level: level,
      idx: index(level),
      t: 0,
      ship: { x: st.x || 0, y: st.y || 0, vx: st.vx || 0, vy: st.vy || 0, a: st.angle || 0, fuel: level.fuel },
      got: (level.beacons || []).map(function () { return false; }),
      held: (level.beacons || []).map(function () { return 0; }),   // seconds spent inside a hold beacon
      cells: (level.cells || []).map(function () { return false; }),
      gateOpen: !(level.beacons && level.beacons.length),
      status: 'flying',          // 'flying' | 'won' | 'dead'
      cause: null,               // on death: 'crash:<bodyId>', 'asteroid', 'lost'
      thrusting: false,
      events: []                 // filled during each step: 'beacon','cell','gate','win','crash','lost','empty'
    };
  }

  // Radius of a repulsor's field. Players found the old endless inverse-square push unfair:
  // it shoved hard from well outside the drawn circle.
  function pushRange(b) { return b.range || 1.4 * Math.sqrt(-b.mass / SHIP.thrust); }
  function wrap(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }

  var tmp = { x: 0, y: 0 };
  // input: { turn: -1..1, thrust: bool, aim: angle in radians or null }.
  // If aim is a number the ship turns toward it at the normal turn rate and turn is ignored.
  function step(s, input, dt) {
    s.events.length = 0;
    if (s.status !== 'flying') return s;
    dt = dt || DT;
    var L = s.level, sh = s.ship, idx = s.idx, i, p, dx, dy, d2, d;

    if (input.aim !== null && input.aim !== undefined) {
      var diff = wrap(input.aim - sh.a), m = SHIP.turn * dt;
      sh.a += Math.max(-m, Math.min(m, diff));
    } else if (input.turn) sh.a += Math.max(-1, Math.min(1, input.turn)) * SHIP.turn * dt;
    sh.a = wrap(sh.a);

    var ax = 0, ay = 0;
    s.thrusting = false;
    if (input.thrust && sh.fuel > 0) {
      ax += Math.cos(sh.a) * SHIP.thrust; ay += Math.sin(sh.a) * SHIP.thrust;
      sh.fuel -= SHIP.burn * dt;
      s.thrusting = true;
      if (sh.fuel <= 0) { sh.fuel = 0; s.events.push('empty'); }
    }

    var bodies = L.bodies || [];
    for (i = 0; i < bodies.length; i++) {
      var b = bodies[i];
      p = posOf(L, b, s.t, idx, tmp);
      dx = p.x - sh.x; dy = p.y - sh.y; d2 = dx * dx + dy * dy; d = Math.sqrt(d2);
      var touch = (b.radius || 0) + SHIP.radius;
      if (d < touch) {
        if (!(b.mass < 0) || d < 1e-6) { s.status = 'dead'; s.cause = 'crash:' + (b.id || i); s.events.push('crash'); return s; }
        // Repulsors are not deadly: touching one bounces the ship off it.
        var nx = -dx / d, ny = -dy / d, q1 = posOf(L, b, s.t + 0.01, idx, { x: 0, y: 0 });
        var bvx = (q1.x - p.x) / 0.01, bvy = (q1.y - p.y) / 0.01;
        var vn = (sh.vx - bvx) * nx + (sh.vy - bvy) * ny;
        if (vn < 0) { sh.vx -= 1.6 * vn * nx; sh.vy -= 1.6 * vn * ny; s.events.push('bounce'); }
        sh.x = p.x + nx * (touch + 0.5); sh.y = p.y + ny * (touch + 0.5);
        dx = p.x - sh.x; dy = p.y - sh.y; d2 = dx * dx + dy * dy; d = Math.sqrt(d2);
      }
      if (b.mass) {
        var inv = b.mass / Math.pow(d2 + SHIP.soft, 1.5);
        if (b.mass < 0) { // repulsors push at full strength, fade out over the outer quarter of the printed range, and stop at its edge
          var R = pushRange(b), u = d / R;
          if (u >= 1) inv = 0; else if (u > 0.75) { var w = (u - 0.75) / 0.25; inv *= 1 - w * w * (3 - 2 * w); }
        }
        ax += dx * inv; ay += dy * inv;
      }
    }

    sh.vx += ax * dt; sh.vy += ay * dt;
    sh.x += sh.vx * dt; sh.y += sh.vy * dt;
    s.t += dt;

    var rocks = L.asteroids || [];
    for (i = 0; i < rocks.length; i++) {
      p = posOf(L, rocks[i], s.t, idx, tmp);
      dx = p.x - sh.x; dy = p.y - sh.y;
      if (dx * dx + dy * dy < Math.pow((rocks[i].radius || 10) + SHIP.radius, 2)) { s.status = 'dead'; s.cause = 'asteroid'; s.events.push('crash'); return s; }
    }

    var beacons = L.beacons || [], left = 0;
    for (i = 0; i < beacons.length; i++) {
      if (s.got[i]) continue;
      p = posOf(L, beacons[i], s.t, idx, tmp);
      dx = p.x - sh.x; dy = p.y - sh.y;
      var inside = dx * dx + dy * dy < Math.pow((beacons[i].r || DEFAULT_BEACON_R) + SHIP.reach, 2);
      // A hold beacon counts only after the ship stays inside it for `hold` seconds in a row.
      if (inside && beacons[i].hold) { s.held[i] += dt; inside = s.held[i] >= beacons[i].hold; }
      else if (beacons[i].hold) s.held[i] = 0;
      if (inside) { s.got[i] = true; s.events.push('beacon'); }
      else left++;
    }
    if (!s.gateOpen && left === 0) { s.gateOpen = true; s.events.push('gate'); }

    var cells = L.cells || [];
    for (i = 0; i < cells.length; i++) {
      if (s.cells[i]) continue;
      p = posOf(L, cells[i], s.t, idx, tmp);
      dx = p.x - sh.x; dy = p.y - sh.y;
      if (dx * dx + dy * dy < Math.pow((cells[i].r || DEFAULT_CELL_R) + SHIP.reach, 2)) {
        s.cells[i] = true; sh.fuel = Math.min(L.fuel, sh.fuel + (cells[i].amount || 20)); s.events.push('cell');
      }
    }

    if (s.gateOpen && L.gate) {
      p = posOf(L, L.gate, s.t, idx, tmp);
      dx = p.x - sh.x; dy = p.y - sh.y;
      if (dx * dx + dy * dy < Math.pow((L.gate.r || DEFAULT_GATE_R) + SHIP.reach, 2)) { s.status = 'won'; s.events.push('win'); return s; }
    }

    if (sh.x * sh.x + sh.y * sh.y > L.bounds * L.bounds) { s.status = 'dead'; s.cause = 'lost'; s.events.push('lost'); }
    return s;
  }

  return {
    DT: DT, SHIP: SHIP, TAU: TAU,
    DEFAULT_BEACON_R: DEFAULT_BEACON_R, DEFAULT_GATE_R: DEFAULT_GATE_R, DEFAULT_CELL_R: DEFAULT_CELL_R,
    index: index, keplerPeriod: keplerPeriod, pushRange: pushRange, posOf: posOf, create: create, step: step, wrap: wrap
  };
});
