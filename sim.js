/* Gravity Assist: deterministic flight simulation. No DOM. Works in the browser (global Sim) and in Node (module.exports). */
(function (root, factory) {
  var S = factory();
  if (typeof module === 'object' && module.exports) module.exports = S; else root.Sim = S;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DT = 1 / 120;              // fixed step, seconds
  var SHIP = {
    thrust: 150,                 // px/s^2 while the engine burns
    turn: 4.5,                   // rad/s
    radius: 7,                   // collision radius, px (forgiving: only the hull's middle can crash)
    reach: 18,                   // pickup reach, px: beacons, fuel and the gate count as soon as the nose touches
    burn: 11.5,                  // fuel units per second of thrust (raised 15% so fuel discipline matters)
    soft: 400                    // gravity softening, px^2
  };
  var DEFAULT_BEACON_R = 24, DEFAULT_GATE_R = 30, DEFAULT_CELL_R = 18, DEFAULT_WORMHOLE_R = 26;
  var TAU = Math.PI * 2;

  // Anything on a rail with no period set moves at true circular-orbit speed: the period comes
  // from the mass it circles (the `around` body, or orbit.mass for a point centre). orbit.dir = -1
  // runs it the other way. This keeps every moon, beacon and rock moving the way the ship would.
  function keplerPeriod(o, map) {
    var m = o.mass;
    if (m === undefined && o.around && map[o.around]) m = Math.abs(map[o.around].mass || 0);
    if (!(m > 0)) return 0;
    return (o.dir === -1 ? -1 : 1) * TAU * Math.sqrt(o.r * o.r * o.r / m);
  }
  function index(level) {
    var map = {};
    (level.bodies || []).forEach(function (b) { if (b.id) map[b.id] = b; });
    if (!level._railsSet) {
      var whEnds = [];
      (level.wormholes || []).forEach(function (w) { if (w.a) whEnds.push(w.a); if (w.b) whEnds.push(w.b); });
      var all = [].concat(level.bodies || [], level.beacons || [], level.cells || [], level.asteroids || [], whEnds, level.gate ? [level.gate] : []);
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
      rootLevel: level,
      level: level,
      stage: 0,
      idx: index(level),
      t: 0,
      ship: { x: st.x || 0, y: st.y || 0, vx: st.vx || 0, vy: st.vy || 0, a: st.angle || 0, fuel: level.fuel },
      got: (level.beacons || []).map(function () { return false; }),
      held: (level.beacons || []).map(function () { return 0; }),   // seconds spent inside a hold beacon
      cells: (level.cells || []).map(function () { return false; }),
      wormCool: (level.wormholes || []).map(function () { return 0; }), // per-pair portal exit cooldown
      lastWarp: null,            // { x0, y0, x1, y1, idx } set on the step a wormhole fires
      gateOpen: !(level.beacons && level.beacons.length),
      status: 'flying',          // 'flying' | 'won' | 'dead'
      cause: null,               // on death: 'crash:<bodyId>', 'pulsar:<bodyId>', 'asteroid', 'lost'
      thrusting: false,
      events: []                 // filled during each step: 'beacon','cell','gate','stage','win','crash','lost','empty','bounce','wormhole','pulsar','wind'
    };
  }

  // Radius of a repulsor's field. Players found the old endless inverse-square push unfair:
  // it shoved hard from well outside the drawn circle.
  function pushRange(b) { return b.range || 1.4 * Math.sqrt(-b.mass / SHIP.thrust); }
  // Pulsar beam state at time t: fires two opposite beams (180° apart), rotating 90° every pulse.
  function pulsarState(b, t) {
    var p = b.pulse || {};
    var period = p.period || 4.5, warn = p.warn || 1.2, fire = p.fire || 0.55, phase = p.phase || 0;
    var shifted = t + phase;
    var cycle = Math.floor(shifted / period);
    var u = ((shifted % period) + period) % period;
    var angle = (p.angle || 0) + cycle * (Math.PI / 2);
    var fireStart = period - fire, warnStart = fireStart - warn;
    var mode = u >= fireStart ? 'fire' : (u >= warnStart ? 'warn' : 'idle');
    return {
      mode: mode,
      angle: angle,
      warnFrac: mode === 'warn' ? (u - warnStart) / Math.max(0.01, warn) : 0,
      fireFrac: mode === 'fire' ? (u - fireStart) / Math.max(0.01, fire) : 0,
      width: p.width || 16,
      cycle: cycle
    };
  }
  // Polarity-flipping Black Hole / White Hole state at time t.
  function flipState(b, t) {
    var f = b.flip || {};
    var period = f.period || 9.0, half = period / 2, warn = f.warn || 1.1, phase = f.phase || 0;
    var u = (((t + phase) % period) + period) % period;
    var isWhite = u >= half;
    var age = isWhite ? (u - half) : u;
    var rem = half - age;
    var ease = Math.min(1, age / 0.16);
    var mag = Math.abs(b.mass || 0), pm = f.pushMult == null ? 0.75 : f.pushMult;
    var effMass = isWhite ? -mag * pm * ease : mag * ease;
    var pushR = f.range || 1.75 * Math.sqrt((mag * pm) / SHIP.thrust);
    return { isWhite: isWhite, effMass: effMass, rem: rem, frac: age / half, warning: rem <= warn, pushR: pushR };
  }
  // Solar Wind state at time t: steady, intermittent (pulse), or breach-activated (onlyWhenOpen).
  function windState(w, t, gateOpen) {
    if (w.onlyWhenOpen && !gateOpen) return { mode: 'off', strength: 0, warnFrac: 0 };
    if (!w.pulse) return { mode: 'on', strength: 1, warnFrac: 0 };
    var p = w.pulse;
    var period = p.period || 8.0, warn = p.warn || 1.3, on = p.on || 2.8, phase = p.phase || 0;
    var u = (((t + phase) % period) + period) % period;
    var onStart = period - on, warnStart = onStart - warn;
    if (u >= onStart) {
      var age = u - onStart, rem = period - u;
      var ramp = Math.min(1, age / 0.25) * Math.min(1, rem / 0.25);
      return { mode: 'on', strength: ramp, warnFrac: 0 };
    }
    if (u >= warnStart) return { mode: 'warn', strength: 0, warnFrac: (u - warnStart) / Math.max(0.01, warn) };
    return { mode: 'idle', strength: 0, warnFrac: 0 };
  }
  // Sum solar wind accelerations (px/s²) at world point (x, y).
  function windAccel(L, t, gateOpen, x, y, out) {
    out = out || { x: 0, y: 0 };
    out.x = 0; out.y = 0;
    var winds = L.winds || [];
    for (var i = 0; i < winds.length; i++) {
      var w = winds[i], ws = windState(w, t, gateOpen);
      if (ws.strength <= 0) continue;
      var force = (w.force || 45) * ws.strength;
      if (w.kind === 'global') {
        var a = w.angle || 0;
        out.x += Math.cos(a) * force;
        out.y += Math.sin(a) * force;
      } else {
        var dx = w.x1 - w.x0, dy = w.y1 - w.y0, len = Math.hypot(dx, dy) || 1;
        var ux = dx / len, uy = dy / len;
        var rx = x - w.x0, ry = y - w.y0;
        var along = rx * ux + ry * uy;
        if (along < -25 || along > len + 25) continue;
        var perp = Math.abs(rx * (-uy) + ry * ux), hw = (w.width || 160) / 2;
        if (perp >= hw) continue;
        var fade = perp > hw * 0.7 ? 1 - (perp - hw * 0.7) / (hw * 0.3) : 1;
        var endFade = along < 0 ? 1 + along / 25 : (along > len ? 1 - (along - len) / 25 : 1);
        var f = force * fade * Math.max(0, Math.min(1, endFade));
        out.x += ux * f;
        out.y += uy * f;
      }
    }
    return out;
  }
  function wrap(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }

  var tmp = { x: 0, y: 0 }, tmp2 = { x: 0, y: 0 }, tmpW = { x: 0, y: 0 };
  // input: { turn: -1..1, thrust: bool, aim: angle in radians or null }.
  // If aim is a number the ship turns toward it at the normal turn rate and turn is ignored.
  function step(s, input, dt) {
    s.events.length = 0;
    s.lastWarp = null;
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
      var fs = b.kind === 'flip' ? flipState(b, s.t) : null;
      var effMass = fs ? fs.effMass : b.mass;
      dx = p.x - sh.x; dy = p.y - sh.y; d2 = dx * dx + dy * dy; d = Math.sqrt(d2);
      var touch = (b.radius || 0) + SHIP.radius;
      if (d < touch) {
        if (!(effMass < 0) || d < 1e-6) { s.status = 'dead'; s.cause = 'crash:' + (b.id || i); s.events.push('crash'); return s; }
        // Repulsors and White Holes are not deadly: touching one bounces the ship off it.
        var nx = -dx / d, ny = -dy / d, q1 = posOf(L, b, s.t + 0.01, idx, { x: 0, y: 0 });
        var bvx = (q1.x - p.x) / 0.01, bvy = (q1.y - p.y) / 0.01;
        var vn = (sh.vx - bvx) * nx + (sh.vy - bvy) * ny;
        if (vn < 0) { sh.vx -= 1.6 * vn * nx; sh.vy -= 1.6 * vn * ny; s.events.push('bounce'); }
        sh.x = p.x + nx * (touch + 0.5); sh.y = p.y + ny * (touch + 0.5);
        dx = p.x - sh.x; dy = p.y - sh.y; d2 = dx * dx + dy * dy; d = Math.sqrt(d2);
      }
      if (effMass) {
        var inv = effMass / Math.pow(d2 + SHIP.soft, 1.5);
        if (effMass < 0) { // repulsors & white holes push at full strength, fade out over the outer quarter of their range, and stop at its edge
          var R = fs ? fs.pushR : pushRange(b), u = d / R;
          if (u >= 1) inv = 0; else if (u > 0.75) { var w = (u - 0.75) / 0.25; inv *= 1 - w * w * (3 - 2 * w); }
        }
        ax += dx * inv; ay += dy * inv;
      }
    }

    if (L.winds && L.winds.length) {
      windAccel(L, s.t, s.gateOpen, sh.x, sh.y, tmpW);
      ax += tmpW.x; ay += tmpW.y;
    }

    sh.vx += ax * dt; sh.vy += ay * dt;
    sh.x += sh.vx * dt; sh.y += sh.vy * dt;
    s.t += dt;

    // Intermittent solar wind gust start event
    if (L.winds && L.winds.length) {
      for (i = 0; i < L.winds.length; i++) {
        var wn = L.winds[i];
        if (wn.pulse && windState(wn, s.t, s.gateOpen).mode === 'on' && windState(wn, s.t - dt, s.gateOpen).mode !== 'on') {
          s.events.push('wind'); break;
        }
      }
    }

    // Pulsar kill-beam collision (two opposite 180° beams, rotating 90° each pulse)
    var pulsarFired = false;
    for (i = 0; i < bodies.length; i++) {
      var pb = bodies[i];
      if (pb.kind !== 'pulsar') continue;
      var ps = pulsarState(pb, s.t);
      if (ps.mode !== 'fire') continue;
      if (!pulsarFired && pulsarState(pb, s.t - dt).mode !== 'fire') { pulsarFired = true; s.events.push('pulsar'); }
      p = posOf(L, pb, s.t, idx, tmp);
      var ux = Math.cos(ps.angle), uy = Math.sin(ps.angle);
      var perp = Math.abs((sh.x - p.x) * (-uy) + (sh.y - p.y) * ux);
      if (perp < ps.width / 2 + SHIP.radius) {
        s.status = 'dead'; s.cause = 'pulsar:' + (pb.id || i); s.events.push('crash'); return s;
      }
    }

    // Wormhole pairs: teleport preserving exact world velocity & heading
    var whs = L.wormholes || [];
    for (i = 0; i < whs.length; i++) {
      if (s.wormCool[i] > 0) s.wormCool[i] = Math.max(0, s.wormCool[i] - dt);
    }
    for (i = 0; i < whs.length; i++) {
      if (s.wormCool[i] > 0) continue;
      var wh = whs[i], wr = (wh.r || DEFAULT_WORMHOLE_R) + SHIP.radius, wr2 = wr * wr;
      var pa = posOf(L, wh.a, s.t, idx, tmp), pb2 = posOf(L, wh.b, s.t, idx, tmp2);
      var da2 = (pa.x - sh.x) * (pa.x - sh.x) + (pa.y - sh.y) * (pa.y - sh.y);
      var db2 = (pb2.x - sh.x) * (pb2.x - sh.x) + (pb2.y - sh.y) * (pb2.y - sh.y);
      if (da2 < wr2 || db2 < wr2) {
        var fromA = da2 < wr2;
        var src = fromA ? pa : pb2, dst = fromA ? pb2 : pa;
        var sp = Math.hypot(sh.vx, sh.vy);
        var ex = sp > 1 ? sh.vx / sp : Math.cos(sh.a), ey = sp > 1 ? sh.vy / sp : Math.sin(sh.a);
        sh.x = dst.x + ex * (wr + 3);
        sh.y = dst.y + ey * (wr + 3);
        s.wormCool[i] = 0.55;
        s.lastWarp = { x0: src.x, y0: src.y, x1: sh.x, y1: sh.y, idx: i };
        s.events.push('wormhole');
        break;
      }
    }

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

    if (sh.x * sh.x + sh.y * sh.y > L.bounds * L.bounds) {
      if (s.gateOpen && L.breach && L.stage2) {
        var bAng = Math.atan2(sh.y, sh.x);
        var halfArc = L.breach.halfArc || 0.24;
        if (Math.abs(wrap(bAng - (L.breach.angle || 0))) <= halfArc) {
          var L2 = L.stage2, st2 = L2.start || {};
          s.stage = (s.stage || 0) + 1;
          s.level = L2;
          s.idx = index(L2);
          sh.x = st2.x || 0; sh.y = st2.y || 0;
          sh.vx = st2.vx || 0; sh.vy = st2.vy || 0;
          sh.a = st2.angle || 0;
          sh.fuel = Math.min(L2.fuel || L.fuel, sh.fuel + (L2.fuelBonus || 0));
          s.got = (L2.beacons || []).map(function () { return false; });
          s.held = (L2.beacons || []).map(function () { return 0; });
          s.cells = (L2.cells || []).map(function () { return false; });
          s.wormCool = (L2.wormholes || []).map(function () { return 0; });
          s.gateOpen = !(L2.beacons && L2.beacons.length);
          s.events.push('stage');
          return s;
        }
      }
      s.status = 'dead'; s.cause = 'lost'; s.events.push('lost');
    }
    return s;
  }

  return {
    DT: DT, SHIP: SHIP, TAU: TAU,
    DEFAULT_BEACON_R: DEFAULT_BEACON_R, DEFAULT_GATE_R: DEFAULT_GATE_R, DEFAULT_CELL_R: DEFAULT_CELL_R, DEFAULT_WORMHOLE_R: DEFAULT_WORMHOLE_R,
    index: index, keplerPeriod: keplerPeriod, pushRange: pushRange, pulsarState: pulsarState, flipState: flipState, windState: windState, windAccel: windAccel, posOf: posOf, create: create, step: step, wrap: wrap
  };
});
