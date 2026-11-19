/* Gravity Assist: rendering, input, readouts and menus. The flight model lives in sim.js. */
(() => {
'use strict';

const S = window.Sim;
const LV = Array.isArray(window.LEVELS) ? window.LEVELS : [];
const noop = () => {};
const Sfx = window.Sfx || { init: noop, setMuted: noop, isMuted: () => true, thrust: noop, play: noop, music: noop, danger: noop };
const TAU = Math.PI * 2, DT = S.DT;
const $ = (id) => document.getElementById(id);
const canvas = $('sky'), ctx = canvas.getContext('2d');
const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

const css = getComputedStyle(document.documentElement);
const C = {
  paper: css.getPropertyValue('--paper').trim() || '#14406e',
  deep: css.getPropertyValue('--paper-deep').trim() || '#0c2c50',
  chalk: css.getPropertyValue('--chalk').trim() || '#eef4f8',
  ochre: css.getPropertyValue('--ochre').trim() || '#f0c35a',
  mono: css.getPropertyValue('--mono').trim() || 'monospace'
};
const chalkA = (a) => 'rgba(238,244,248,' + a + ')';
const ochreA = (a) => 'rgba(240,195,90,' + a + ')';

// ---------- saved progress (one viewer, one browser; the game works without it) ----------
const SAVE_KEY = 'perihelion-run-v1';
let save = { best: {}, ghost: {}, splits: {}, muted: false, guide: true };
try {
  const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
  if (raw && typeof raw === 'object') save = { best: raw.best || {}, ghost: raw.ghost || {}, splits: raw.splits || {}, muted: !!raw.muted, guide: raw.guide !== false };
} catch (err) {}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (err) {} }

// On the hosted page, best times also go to your private slot in the page's own store, which
// survives new versions of the game. Copies opened as a file keep using browser storage only.
const cloud = { ref: null, busy: false, again: false };
function mergeBest(best) {
  let n = 0;
  if (!best || typeof best !== 'object') return 0;
  Object.keys(best).forEach((k) => {
    const t = +best[k];
    if (!(t > 0 && t < 10000)) return;
    const old = save.best[k];
    if (typeof old !== 'number' || t < old) { save.best[k] = t; n++; }
  });
  return n;
}
async function pushCloud() {
  if (!cloud.ref) return;
  if (cloud.busy) { cloud.again = true; return; } // one write at a time
  cloud.busy = true;
  try { await cloud.ref.set({ best: Object.assign({}, save.best), v: 1 }); } catch (err) {}
  cloud.busy = false;
  if (cloud.again) { cloud.again = false; pushCloud(); }
}
async function cloudInit() {
  try {
    const c = window.claude;
    if (!c || typeof c.use !== 'function') return;
    const db = await c.use('db'), user = await c.use('user');
    if (!db || !user) return;
    const id = await user.id();
    if (!id) return;
    const ref = db.doc('data/users/' + id + '/progress');
    const snap = await ref.get();
    cloud.ref = ref;
    $('save-help').textContent = 'Your times follow your Claude account on this page, so the same link on your phone and your computer shows the same times. A code is only needed for a downloaded copy of the game.';
    const remote = snap.exists ? (snap.data() || {}).best || {} : {};
    if (mergeBest(remote)) { persist(); if (screen === 'menu') buildCards(); }
    const needPush = Object.keys(save.best).some((k) => !(remote[k] <= save.best[k]));
    if (needPush) pushCloud();
  } catch (err) {}
}
const keyOf = (i) => LV[i] ? LV[i].name : String(i);
const bestOf = (i) => { const v = save.best[keyOf(i)]; return typeof v === 'number' && isFinite(v) ? v : null; };
function medalFor(i, time) {
  if (time === null) return null;
  const p = LV[i].par || {};
  // Finishing slower than the bronze time earns no medal.
  return time <= (p.gold || 0) ? 'Gold' : time <= (p.silver || 0) ? 'Silver' : time <= (p.bronze || Infinity) ? 'Bronze' : null;
}
const unlocked = () => true; // every level is open: progress is easy to lose between copies of the game
function nextToFly() {
  for (let i = 0; i < LV.length; i++) if (bestOf(i) === null) return i;
  return 0;
}

// ---------- state ----------
let screen = 'menu';           // 'menu' | 'play'
let levelIdx = 0, sim = null, phase = 'ready', phaseT = 0, paused = false;
let steps = 0, acc = 0, deaths = 0, finalTime = 0, newBest = false, armed = true;
const prev = { x: 0, y: 0, a: 0 }, draw = { x: 0, y: 0, a: 0 }; // last step and the interpolated pose to render
let splits = [], bestSplits = null; // clock time at each beacon pickup, this run and the best run
let rec = [], ghost = null;    // flat [x, y, a, ...] sampled every REC_EVERY steps
const REC_EVERY = 4;
let trail = [], sparks = [], bursts = [];
let shake = 0, menuT = 0, toastTimer = 0;
const cam = { x: 0, y: 0, zoom: 1 };
// Before the first burn the camera is free: it opens on the whole chart, and you can pinch,
// drag or scroll to look around. The first burn hands it back to the ship.
const view = { on: false, x: 0, y: 0, zoom: 1 };
const viewTouches = new Map();
let pinchD = 0;
function overview() {
  const L = sim.level, avail = Math.max(120, Math.min(W, H - (coarse ? 150 : 110)));
  view.on = true; view.x = 0; view.y = 0;
  view.zoom = Math.max(0.12, Math.min(1.2, avail / (2 * (L.bounds + 40))));
}
let W = 0, H = 0, dpr = 1;
const keys = new Set();
const ptr = { down: false, aimOnly: false, x: 0, y: 0, id: null };
const idxCache = new Map();
const idxOf = (L) => { let m = idxCache.get(L); if (!m) { m = S.index(L); idxCache.set(L, m); } return m; };
const P = { x: 0, y: 0 };
const at = (L, ent, t) => S.posOf(L, ent, t, idxOf(L), P);

function toast(msg, hold) {
  $('toast').textContent = msg;
  clearTimeout(toastTimer);
  if (msg) toastTimer = setTimeout(() => { $('toast').textContent = ''; }, hold || 2600);
}

// ---------- view ----------
const sx = (x) => (x - cam.x) * cam.zoom + W / 2;
const sy = (y) => (y - cam.y) * cam.zoom + H / 2;
function resize() {
  const r = canvas.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = Math.max(1, r.width); H = Math.max(1, r.height);
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
}
// Small screens zoom out further so a phone shows about as much of the chart as a laptop.
const baseZoom = () => Math.max(Math.min(W, H) < 500 ? 0.4 : 0.5, Math.min(1.15, Math.min(W, H) / (Math.min(W, H) < 500 ? 900 : 780)));

// ---------- level flow ----------
// Fade through the star background when entering a level, instead of jumping.
let veilBusy = false;
function enterLevel(i) {
  if (veilBusy) return;
  const v = $('veil');
  if (!v || matchMedia('(prefers-reduced-motion: reduce)').matches) { startLevel(i); return; }
  veilBusy = true; v.classList.add('on');
  setTimeout(() => { startLevel(i); requestAnimationFrame(() => { v.classList.remove('on'); veilBusy = false; }); }, 200);
}
function startLevel(i, keepDeaths, needRelease) {
  if (!LV.length) return;
  replay = null;
  levelIdx = Math.max(0, Math.min(LV.length - 1, i | 0));
  const L = LV[levelIdx];
  sim = S.create(L);
  phase = 'ready'; phaseT = 0; paused = false; steps = 0; acc = 0;
  armed = !needRelease;
  prev.x = draw.x = sim.ship.x; prev.y = draw.y = sim.ship.y; prev.a = draw.a = sim.ship.a;
  if (!keepDeaths) deaths = 0;
  rec = []; trail = []; sparks = []; bursts = []; shake = 0; splits = [];
  { const sp = save.splits[keyOf(levelIdx)]; bestSplits = Array.isArray(sp) ? sp : null; }
  const g = save.ghost[keyOf(levelIdx)];
  ghost = Array.isArray(g) && g.length >= 6 ? g : null;
  viewTouches.clear();
  if (keepDeaths) { view.on = false; cam.x = sim.ship.x; cam.y = sim.ship.y; cam.zoom = baseZoom(); }
  else { overview(); cam.x = view.x; cam.y = view.y; cam.zoom = view.zoom; }
  screen = 'play';
  $('menu').hidden = true; $('result').hidden = true; $('pause').hidden = true; $('hud').hidden = false;
  $('b-levels').hidden = false; $('b-restart').hidden = false; $('b-pause').hidden = false;
  $('pad').hidden = !coarse;
  $('b-pause').textContent = 'Pause';
  $('h-level').textContent = String(levelIdx + 1).padStart(2, '0') + '. ' + L.name;
  $('h-hint').textContent = L.hint || '';
  const b = bestOf(levelIdx), par = L.par || {}, hp = $('h-par');
  hp.textContent = '';
  const bits = [];
  if (par.gold) bits.push('Gold: ' + Math.round(par.gold));
  if (par.silver) bits.push('Silver: ' + Math.round(par.silver));
  if (par.bronze) bits.push('Bronze: ' + Math.round(par.bronze));
  if (b !== null) bits.push('Best: ' + b.toFixed(2));
  bits.forEach((tx) => { const sp = document.createElement('span'); sp.textContent = tx; hp.appendChild(sp); });
  toast('');
  updateHud();
  try { canvas.focus({ preventScroll: true }); } catch (err) {}
}
function showMenu() {
  replay = null;
  coach('');
  screen = 'menu'; paused = false; sim = null;
  Sfx.thrust(false); Sfx.danger(0); Sfx.music(false);
  $('menu').hidden = false; $('result').hidden = true; $('pause').hidden = true; $('hud').hidden = true;
  $('b-levels').hidden = true; $('b-restart').hidden = true; $('b-pause').hidden = true; $('pad').hidden = true;
  padClear.forEach((f) => f());
  toast('');
  buildCards();
}
function buildCards() {
  const wrap = $('cards');
  wrap.textContent = '';
  LV.forEach((L, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'card'; b.id = 'card-' + i;
    const open = unlocked(i), best = bestOf(i), medal = medalFor(i, best);
    b.disabled = !open;
    const n = document.createElement('span'); n.className = 'n'; n.textContent = String(i + 1).padStart(2, '0');
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = L.name;
    const md = document.createElement('span'); md.className = 'md' + (medal ? ' ' + medal.toLowerCase() : '');
    md.textContent = best === null ? '' : best.toFixed(2);
    b.setAttribute('aria-label', 'Level ' + (i + 1) + ', ' + L.name + (best === null ? ', not flown' : ', ' + (medal || 'no medal') + ', best ' + best.toFixed(2) + ' seconds'));
    b.append(n, nm, md);
    b.addEventListener('click', () => { Sfx.init(); Sfx.play('click'); enterLevel(i); });
    wrap.appendChild(b);
  });
  const tally = { Gold: 0, Silver: 0, Bronze: 0 };
  LV.forEach((L, i) => { const m = medalFor(i, bestOf(i)); if (m) tally[m]++; });
  const flown = tally.Gold + tally.Silver + tally.Bronze;
  $('tally').textContent = flown ? tally.Gold + ' gold · ' + tally.Silver + ' silver · ' + tally.Bronze + ' bronze' : '';
  $('tally').hidden = !flown;
  const nx = nextToFly();
  $('continue').textContent = LV.length ? 'Fly ' + LV[nx].name : 'No levels found';
  $('continue').disabled = !LV.length;
}
function setPaused(v) {
  if (screen !== 'play' || phase === 'won') return;
  paused = v;
  $('pause').hidden = !v;
  if (coarse) $('pad').hidden = v;
  if (v) padClear.forEach((f) => f());
  $('b-pause').textContent = v ? 'Resume' : 'Pause';
  if (v) { Sfx.thrust(false); Sfx.danger(0); Sfx.music(false); try { $('p-resume').focus(); } catch (err) {} }
  else { if (phase === 'fly') Sfx.music(true); try { canvas.focus({ preventScroll: true }); } catch (err) {} }
}
function causeText(cause) {
  if (cause === 'lost') return 'Drifted off the chart.';
  if (cause === 'asteroid') return 'Hit an asteroid.';
  const id = String(cause || '').split(':')[1];
  const b = (sim.level.bodies || []).find((x, i) => String(x.id || i) === id);
  const kind = b && b.kind;
  return kind === 'star' ? 'Burned up in the star.' : kind === 'hole' ? 'Swallowed by the black hole.' :
    kind === 'moon' ? 'Hit the moon.' : kind === 'repulsor' ? 'Hit the repulsor.' : 'Hit the planet.';
}
function showResult() {
  const L = LV[levelIdx], medal = medalFor(levelIdx, finalTime), b = bestOf(levelIdx);
  $('r-title').textContent = levelIdx === LV.length - 1 ? 'Last gate reached' : 'Gate reached';
  $('r-time').textContent = finalTime.toFixed(2) + ' s';
  $('r-medal').textContent = medal ? medal + ' medal' + (newBest ? ', new best' : '') : (newBest ? 'New best' : '');
  $('r-gold').textContent = Math.round((L.par && L.par.gold) || 0) + ' s';
  $('r-silver').textContent = Math.round((L.par && L.par.silver) || 0) + ' s';
  $('r-bronze').textContent = Math.round((L.par && L.par.bronze) || 0) + ' s';
  $('r-best').textContent = b !== null ? b.toFixed(2) + ' s' : 'none';
  $('r-fuel').textContent = Math.round(100 * sim.ship.fuel / L.fuel) + '%';
  $('r-deaths').textContent = String(deaths);
  const last = levelIdx === LV.length - 1;
  $('r-next').hidden = last;
  coach(''); if (levelIdx === 0) tut.done = true;
  $('result').hidden = false; $('b-pause').hidden = true; $('pad').hidden = true; padClear.forEach((f) => f());
  toast(''); Sfx.music(false);
  Sfx.play('medal');
  try { (last ? $('r-retry') : $('r-next')).focus(); } catch (err) {}
}

// ---------- solution replay ----------
// Plays back the bot's best recorded flight for this level (solutions.js) through the normal renderer.
let replay = null;
const solOf = (i) => (window.SOLUTIONS || {})[keyOf(i)] || null;
function decodeSol(sol) {
  if (sol._frames) return sol._frames;
  const bin = atob(sol.f), n = Math.floor(bin.length / 6), out = new Array(n);
  const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const dv = new DataView(u8.buffer);
  for (let i = 0; i < n; i++) {
    const o = i * 6, fl = dv.getUint8(o + 5);
    out[i] = { x: dv.getInt16(o, true), y: dv.getInt16(o + 2, true), a: dv.getUint8(o + 4) / 256 * TAU - Math.PI, th: !!(fl & 128), fuel: (fl & 127) / 127 };
  }
  sol._frames = out;
  return out;
}
function watchSolution() {
  const sol = solOf(levelIdx);
  if (!sol) { toast('No recorded solution for this level yet.'); return; }
  startLevel(levelIdx, true);
  phase = 'replay'; view.on = false; viewTouches.clear();
  replay = { sol, fr: decodeSol(sol), t: 0, ev: 0, ended: false };
  $('pad').hidden = true;
  Sfx.play('start'); Sfx.music(true);
  toast('');
}
function stepReplay(dt) {
  const R = replay, fr = R.fr, sol = R.sol, sh = sim.ship, L = sim.level;
  R.t = Math.min(sol.t, R.t + dt);
  sim.t = R.t;
  while (R.ev < sol.ev.length && sol.ev[R.ev][0] <= R.t) {
    const e = sol.ev[R.ev++];
    if (e[1] === 'b') { sim.got[e[2]] = true; Sfx.play('beacon'); burst(sh.x, sh.y, 18, 160, 0.5, true); bursts.push({ x: sh.x, y: sh.y, age: 0 }); if (sim.got.every(Boolean)) { sim.gateOpen = true; Sfx.play('gate'); } }
    else if (e[1] === 'c') { sim.cells[e[2]] = true; Sfx.play('cell'); burst(sh.x, sh.y, 10, 110, 0.4, false); }
  }
  const f = R.t / sol.step, i = Math.min(fr.length - 2, Math.floor(f)), u = Math.max(0, Math.min(1, f - i)), A = fr[i], B = fr[i + 1];
  const nx = A.x + (B.x - A.x) * u, ny = A.y + (B.y - A.y) * u;
  sh.vx = (B.x - A.x) / sol.step; sh.vy = (B.y - A.y) / sol.step;
  prev.x = sh.x = nx; prev.y = sh.y = ny; prev.a = sh.a = A.a + S.wrap(B.a - A.a) * u;
  sh.fuel = A.fuel * L.fuel; sim.thrusting = A.th;
  steps++;
  if (steps % 3 === 0) { trail.push(sh.x, sh.y); if (trail.length > 360) trail.splice(0, 2); }
  if (sim.thrusting && steps % 2 === 0 && !reduced) {
    const back = sh.a + Math.PI + (Math.random() - 0.5) * 0.5, v = 110 + Math.random() * 70;
    sparks.push({ x: sh.x - Math.cos(sh.a) * 14, y: sh.y - Math.sin(sh.a) * 14, vx: sh.vx + Math.cos(back) * v, vy: sh.vy + Math.sin(back) * v, life: 0.35, max: 0.35, ochre: Math.random() < 0.5 });
  }
  if (R.t >= sol.t && !R.ended) {
    R.ended = true; phaseT = 2.2; sim.thrusting = false;
    Sfx.play('win'); burst(sh.x, sh.y, 40, 220, 0.8, true);
  }
}

// ---------- first-flight tutorial (level 1, once per visit) ----------
const tut = { step: -1, t: 0, turned: 0, done: false };
function coach(html) { const c = $('coach'); if (!html) { c.hidden = true; c.innerHTML = ''; tut.shown = -1; return; } c.innerHTML = html; c.hidden = false; }
const TUT_TEXT = () => coarse ? [
  'Hold <b>BURN</b> to fire the engine.',
  'Use the <b>arrow buttons</b> to steer while you burn.',
  'Collect every gold beacon, then fly into the <b>gate</b>.',
  'Stuck on a level? <b>Pause</b>, then <b>Watch the solution</b>.'
] : [
  'Hold <kbd>&uarr;</kbd> to fire the engine.',
  'Steer with <kbd>&larr;</kbd> <kbd>&rarr;</kbd> while you burn.',
  'Collect every gold beacon, then fly into the <b>gate</b>.',
  'Stuck on a level? <b>Pause</b>, then <b>Watch the solution</b>.'
];
function tutorialTick(dt) {
  const away = screen !== 'play' || levelIdx !== 0 || paused || !sim || phase === 'replay' || phase === 'won' || phase === 'dead';
  if (tut.done || away) { if (!$('coach').hidden) coach(''); return; }
  const texts = TUT_TEXT();
  if (tut.step < 0) tut.step = 0;
  if (tut.step === 0 && phase === 'fly') { tut.step = 1; tut.t = 0; }
  else if (tut.step === 1) { tut.t += dt; if (keys.has('left') || keys.has('right') || ptr.down) tut.turned += dt; if (tut.turned > 0.5 || tut.t > 7) { tut.step = 2; tut.t = 0; } }
  else if (tut.step === 2) { tut.t += dt; if (tut.t > 5 || sim.got.some(Boolean)) { tut.step = 3; tut.t = 0; } }
  else if (tut.step === 3) { tut.t += dt; if (tut.t > 6) { tut.done = true; coach(''); return; } }
  if (tut.step === 0 && phase !== 'ready') return;
  if (tut.shown !== tut.step) { tut.shown = tut.step; coach(texts[tut.step]); }
}

// ---------- input ----------
const KEYMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up',
  Left: 'left', Right: 'right', Up: 'up' }; // older browsers name the arrows Left, Right, Up
const CODEMAP = { 37: 'left', 39: 'right', 38: 'up', 65: 'left', 68: 'right', 87: 'up' };
const flightKey = (e) => KEYMAP[e.key] || (e.code && KEYMAP[e.code.replace('Key', '').toLowerCase()]) || CODEMAP[e.keyCode] || null;
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  Sfx.init();
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return; // typing a save code
  const k = flightKey(e);
  if (k) { if (screen === 'play') { keys.add(k); e.preventDefault(); } return; }
  if (e.repeat) return;
  if (e.key === 'r' || e.key === 'R') { if (screen === 'play') { e.preventDefault(); startLevel(levelIdx, phase !== 'won'); } return; }
  if (e.key === 'm' || e.key === 'M') { toggleSound(); return; }
  if (e.key === 'g' || e.key === 'G') { toggleGuide(); return; }
  if (e.key === 'f' || e.key === 'F') { toggleFull(); return; }
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { if (screen === 'play') { e.preventDefault(); setPaused(!paused); } return; }
  if (e.key === 'Enter' && tag !== 'button') {
    if (screen === 'menu') { e.preventDefault(); enterLevel(nextToFly()); }
    else if (!$('result').hidden) { e.preventDefault(); if (levelIdx < LV.length - 1) enterLevel(levelIdx + 1); else showMenu(); }
  }
});
document.addEventListener('keyup', (e) => { const k = flightKey(e); if (k) keys.delete(k); });
function autoPause() { padClear.forEach((f) => f()); keys.clear(); ptr.down = false; ptr.id = null; touches.clear(); if (screen === 'play' && phase === 'fly' && !paused) setPaused(true); }
window.addEventListener('blur', autoPause);
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
const touches = new Map();   // every pointer currently down: id -> {x, y, aimOnly}
function ppos(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, aimOnly: e.button === 2 }; }
function follow(id) { const t = touches.get(id); ptr.down = true; ptr.id = id; ptr.x = t.x; ptr.y = t.y; ptr.aimOnly = t.aimOnly; }
function viewZoomAt(px, py, f) {
  if (!view.on) { view.on = true; view.x = cam.x; view.y = cam.y; view.zoom = cam.zoom; }
  const wx = (px - W / 2) / view.zoom + view.x, wy = (py - H / 2) / view.zoom + view.y;
  view.zoom = Math.max(0.12, Math.min(1.6, view.zoom * f));
  view.x = wx - (px - W / 2) / view.zoom; view.y = wy - (py - H / 2) / view.zoom;
  cam.x = view.x; cam.y = view.y; cam.zoom = view.zoom;
}
const looking = () => screen === 'play' && phase === 'ready' && !paused;
function viewPointerDown(e) {
  const r = canvas.getBoundingClientRect();
  viewTouches.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top });
  if (!view.on) { view.on = true; view.x = cam.x; view.y = cam.y; view.zoom = cam.zoom; }
  if (viewTouches.size === 2) { const [a, b] = Array.from(viewTouches.values()); pinchD = Math.hypot(a.x - b.x, a.y - b.y) || 1; }
}
function viewPointerMove(e) {
  const t = viewTouches.get(e.pointerId);
  if (!t) return false;
  const r = canvas.getBoundingClientRect(), nx = e.clientX - r.left, ny = e.clientY - r.top;
  if (viewTouches.size === 1) {
    view.x -= (nx - t.x) / view.zoom; view.y -= (ny - t.y) / view.zoom;
    cam.x = view.x; cam.y = view.y;
  }
  t.x = nx; t.y = ny;
  if (viewTouches.size === 2) {
    const [a, b] = Array.from(viewTouches.values()), d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    viewZoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinchD); pinchD = d;
  }
  return true;
}
canvas.addEventListener('wheel', (e) => {
  if (!looking()) return;
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  viewZoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
}, { passive: false });
canvas.addEventListener('pointerdown', (e) => {
  Sfx.init();
  if (looking() && (coarse || e.pointerType === 'touch')) { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} viewPointerDown(e); return; }
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  touches.set(e.pointerId, ppos(e));
  follow(e.pointerId);        // the newest finger steers
});
canvas.addEventListener('pointermove', (e) => {
  if (viewPointerMove(e)) return;
  const t = touches.get(e.pointerId);
  if (!t) return;
  const q = ppos(e); t.x = q.x; t.y = q.y;
  if (e.pointerId === ptr.id) { ptr.x = t.x; ptr.y = t.y; }
});
function pup(e) {
  if (viewTouches.delete(e.pointerId)) return;
  touches.delete(e.pointerId);
  if (e.pointerId !== ptr.id) return;
  const rest = Array.from(touches.keys());
  if (rest.length) follow(rest[rest.length - 1]); else { ptr.down = false; ptr.id = null; }
}
canvas.addEventListener('pointerup', pup);
canvas.addEventListener('pointercancel', pup);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const input = { turn: 0, thrust: false, aim: null };
function gather() {
  input.turn = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
  input.thrust = keys.has('up');
  input.aim = null;
  if (ptr.down && sim) {
    const dx = (ptr.x - W / 2) / cam.zoom + cam.x - sim.ship.x, dy = (ptr.y - H / 2) / cam.zoom + cam.y - sim.ship.y;
    if (dx * dx + dy * dy > 144) {
      input.aim = Math.atan2(dy, dx);
      // Burn only once roughly lined up, so a hold does not waste fuel while the ship swings round.
      if (!ptr.aimOnly && Math.abs(S.wrap(input.aim - sim.ship.a)) < 0.7) input.thrust = true;
    }
  }
  return input;
}

function toggleSound() {
  save.muted = !save.muted; persist();
  Sfx.init(); Sfx.setMuted(save.muted);
  $('b-sound').setAttribute('aria-pressed', String(!save.muted));
  if (screen === 'play') { try { canvas.focus({ preventScroll: true }); } catch (err) {} }
}
function bindPad(id, key) {
  const el = $(id), down = new Set();
  const on = (e) => { e.preventDefault(); Sfx.init(); try { el.setPointerCapture(e.pointerId); } catch (err) {} down.add(e.pointerId); keys.add(key); el.classList.add('on'); };
  const off = (e) => { down.delete(e.pointerId); if (!down.size) { keys.delete(key); el.classList.remove('on'); } };
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointercancel', off);
  el.addEventListener('lostpointercapture', off);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  // iPhone Safari zooms on a quick double tap unless the touch events themselves are cancelled
  el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  el.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
  padClear.push(() => { down.clear(); keys.delete(key); el.classList.remove('on'); });
}
const padClear = [];
// iPhone: stop pinch and double-tap zoom while flying (menus can still scroll).
['gesturestart', 'gesturechange'].forEach((t) => document.addEventListener(t, (e) => { if (screen === 'play') e.preventDefault(); }, { passive: false }));
{ let lastEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = performance.now();
    if (screen === 'play' && now - lastEnd < 350 && !(e.target.closest && e.target.closest('button, a, input, textarea, select'))) e.preventDefault();
    lastEnd = now;
  }, { passive: false });
  document.addEventListener('touchmove', (e) => { if (screen === 'play' && e.touches.length > 1) e.preventDefault(); }, { passive: false });
}
bindPad('t-left', 'left'); bindPad('t-right', 'right'); bindPad('t-burn', 'up');
const fsEl = document.documentElement;
const canFull = !!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen);
const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function toggleFull() {
  try {
    if (isFull()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    if (!canFull) { toast('On iPhone, tap Share, then Add to Home Screen, and open the game from there for full screen.', 6000); return; }
    const p = (fsEl.requestFullscreen || fsEl.webkitRequestFullscreen).call(fsEl, { navigationUI: 'hide' });
    const lock = () => { try { const o = window.screen && window.screen.orientation; if (o && o.lock) o.lock('landscape').catch(() => {}); } catch (err) {} };
    if (p && p.then) p.then(lock).catch(() => toast('Full screen is blocked here. Open the game in its own browser tab and try again.', 5000)); else lock();
  } catch (err) { toast('Full screen is blocked here. Open the game in its own browser tab and try again.', 5000); }
}
function syncFull() { const f = isFull(); document.body.classList.toggle('fs', f); $('b-full').setAttribute('aria-pressed', String(f)); $('b-full').setAttribute('aria-label', f ? 'Exit full screen' : 'Full screen'); }
document.addEventListener('fullscreenchange', syncFull);
document.addEventListener('webkitfullscreenchange', syncFull);
function toggleGuide() {
  save.guide = !save.guide; persist();
  $('b-guide').setAttribute('aria-pressed', String(save.guide));
  if (screen === 'play') { try { canvas.focus({ preventScroll: true }); } catch (err) {} }
}
// Save codes: best times packed into a short text you can copy into another copy of the game.
// Each copy of the file (and sometimes each version of the page) keeps its own browser storage.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_~';
function saveCode() {
  let s = '';
  LV.forEach((L, i) => {
    const b = bestOf(i), v = b === null ? -1 : Math.min(4094, Math.ceil(b * 10));
    s += v < 0 ? '--' : B64[v >> 6] + B64[v & 63];
  });
  return 'PR2-' + s.replace(/(--)+$/, '');
}
// Finds a code anywhere in pasted text (a whole message or email is fine).
function codeTimes(str) {
  str = String(str || '');
  let m = str.match(/PR2-([A-Za-z0-9_~-]+)/);
  if (m) {
    const out = [];
    for (let i = 0; i + 1 < m[1].length; i += 2) {
      const a = m[1][i], b = m[1][i + 1];
      out.push(a === '-' ? null : (B64.indexOf(a) * 64 + B64.indexOf(b)) / 10);
    }
    return out;
  }
  m = str.match(/PR1-([0-9a-z.]*)/i); // the first, longer format
  if (m) return m[1].split('.').map((v) => (v ? parseInt(v, 36) / 100 : null));
  return null;
}
function loadCode(str) {
  const times = codeTimes(str);
  if (!times) return -1;
  let n = 0;
  times.forEach((t, i) => {
    if (t === null || !LV[i]) return;
    if (!(t > 0 && t < 10000)) return;
    const k = keyOf(i), old = bestOf(i);
    if (old === null || t < old) { save.best[k] = t; n++; }
  });
  persist();
  if (n) pushCloud();
  return n;
}
function bindSave() {
click('save-copy', () => {
  const code = saveCode(), out = $('save-text');
  out.value = code;
  const done = () => { $('save-note').textContent = 'Copied. Paste it into this box on the other device.'; };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, () => { out.select(); $('save-note').textContent = 'Select the code in the box and copy it.'; });
    else { out.select(); $('save-note').textContent = 'Select the code in the box and copy it.'; }
  } catch (err) { out.select(); $('save-note').textContent = 'Select the code in the box and copy it.'; }
});
function tryLoad(text, quiet) {
  const n = loadCode(text);
  if (n < 0) { if (!quiet) $('save-note').textContent = 'No save code found. Codes start with PR2-.'; return; }
  $('save-note').textContent = n === 0 ? 'Code loaded. Your times here were already as good or better.' : 'Code loaded: ' + n + (n === 1 ? ' best time added.' : ' best times added.');
  buildCards();
}
click('save-load', () => tryLoad($('save-text').value));
// Pasting a code (or a whole message containing one) loads it straight away.
$('save-text').addEventListener('input', () => { if (codeTimes($('save-text').value)) tryLoad($('save-text').value, true); });
click('save-send', () => {
  const code = saveCode(), msg = 'My Gravity Assist save code: ' + code + '\nOpen the game, paste this into the Save code box and it loads.';
  $('save-text').value = code;
  const fallback = () => {
    try { window.location.href = 'mailto:?subject=' + encodeURIComponent('Gravity Assist save code') + '&body=' + encodeURIComponent(msg); } catch (err) {}
    $('save-note').textContent = 'If no email opened, use Copy instead. Your code is in the box.';
  };
  try {
    if (navigator.share) navigator.share({ title: 'Gravity Assist save code', text: msg }).then(() => { $('save-note').textContent = 'Sent. On the other device, paste it into this box.'; }, (e) => { if (!e || e.name !== 'AbortError') fallback(); });
    else fallback();
  } catch (err) { fallback(); }
});
}
const click = (id, fn) => $(id).addEventListener('click', () => { Sfx.init(); Sfx.play('click'); fn(); });
click('continue', () => enterLevel(nextToFly()));
click('b-levels', showMenu);
click('b-restart', () => startLevel(levelIdx, phase !== 'won'));
click('b-pause', () => setPaused(!paused));
$('b-sound').addEventListener('click', toggleSound);
bindSave();
$('b-guide').addEventListener('click', toggleGuide);
$('b-full').addEventListener('click', () => { Sfx.init(); toggleFull(); });
click('r-next', () => enterLevel(levelIdx + 1));
click('r-retry', () => startLevel(levelIdx));
click('r-levels', showMenu);
click('p-resume', () => setPaused(false));
click('p-restart', () => startLevel(levelIdx, phase !== 'won'));
click('p-levels', showMenu);
click('p-solve', () => { setPaused(false); watchSolution(); });
click('r-solve', () => { $('result').hidden = true; watchSolution(); });

// ---------- simulation tick ----------
function burst(x, y, n, speed, life, ochre) {
  if (reduced) n = Math.ceil(n / 4);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, v = speed * (0.35 + Math.random() * 0.65);
    sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.6 + Math.random() * 0.4), max: life, ochre: !!ochre });
  }
}
function tick() {
  const inp = gather();
  const sh = sim.ship;
  if (phase === 'ready') {
    // After a crash the next attempt waits for you to let go, so a held burn cannot start the clock by accident.
    if (!armed) { if (keys.size === 0 && !ptr.down) armed = true; return; }
    if (!(inp.thrust || inp.turn || inp.aim !== null)) return;
    phase = 'fly'; view.on = false; Sfx.play('start'); Sfx.music(true);
  }
  prev.x = sh.x; prev.y = sh.y; prev.a = sh.a;
  S.step(sim, inp);
  steps++;
  if (steps % REC_EVERY === 0) rec.push(Math.round(sh.x * 10) / 10, Math.round(sh.y * 10) / 10, Math.round(sh.a * 100) / 100);
  if (steps % 3 === 0) { trail.push(sh.x, sh.y); if (trail.length > 360) trail.splice(0, 2); }
  if (sim.thrusting && steps % 2 === 0 && !reduced) {
    const back = sh.a + Math.PI + (Math.random() - 0.5) * 0.5, v = 110 + Math.random() * 70;
    sparks.push({ x: sh.x - Math.cos(sh.a) * 14, y: sh.y - Math.sin(sh.a) * 14, vx: sh.vx + Math.cos(back) * v, vy: sh.vy + Math.sin(back) * v, life: 0.35, max: 0.35, ochre: Math.random() < 0.5 });
  }
  for (const ev of sim.events) {
    if (ev === 'beacon') {
      Sfx.play('beacon'); burst(sh.x, sh.y, 18, 160, 0.5, true); bursts.push({ x: sh.x, y: sh.y, age: 0 });
      splits.push(Math.round(sim.t * 100) / 100);
      const n = splits.length, total = sim.got.length, ref = bestSplits && bestSplits[n - 1];
      if (n < total) {
        // split against your best run, the way a time trial shows it
        const d = typeof ref === 'number' ? sim.t - ref : null;
        toast('Beacon ' + n + ' of ' + total + (d === null ? '' : d <= 0 ? '   ' + Math.abs(d).toFixed(2) + ' s ahead of your best' : '   ' + d.toFixed(2) + ' s behind your best'), 1800);
      }
    }
    else if (ev === 'bounce') { Sfx.play('bounce'); burst(sh.x, sh.y, 10, 120, 0.35, true); if (!reduced) shake = 4; }
    else if (ev === 'cell') { Sfx.play('cell'); burst(sh.x, sh.y, 10, 110, 0.4, false); toast('Fuel taken on.', 1200); }
    else if (ev === 'gate') { Sfx.play('gate'); toast('Every beacon collected. The gate is open.'); }
    else if (ev === 'empty') { Sfx.play('empty'); toast(coarse ? 'Tank empty. Coast, or tap Restart.' : 'Tank empty. Coast, or press R to restart.', 4000); }
    else if (ev === 'win') {
      phase = 'won'; phaseT = 0.75; finalTime = Math.round(sim.t * 1000) / 1000;
      Sfx.play('win'); Sfx.thrust(false); burst(sh.x, sh.y, 40, 220, 0.8, true);
      const k = keyOf(levelIdx), old = bestOf(levelIdx);
      newBest = old === null || finalTime < old;
      if (newBest) { save.best[k] = finalTime; save.ghost[k] = rec.slice(); save.splits[k] = splits.slice(); persist(); pushCloud(); }
    } else if (ev === 'crash' || ev === 'lost') {
      phase = 'dead'; phaseT = 1.0; deaths++;
      Sfx.play(ev); Sfx.thrust(false);
      burst(sh.x, sh.y, 46, 240, 0.9, false); if (!reduced) shake = 12;
      toast(causeText(sim.cause) + ' Relaunching.', 1500);
    }
  }
}
function dangerLevel() {
  if (!sim) return 0;
  let worst = 0;
  const L = sim.level, sh = sim.ship;
  for (const b of L.bodies || []) {
    if (!b.mass || b.mass < 0) continue;
    const p = at(L, b, sim.t), d2 = (p.x - sh.x) ** 2 + (p.y - sh.y) ** 2;
    worst = Math.max(worst, b.mass / (d2 + 400) / 320);
  }
  return Math.max(0, Math.min(1, worst - 0.15));
}
function updateHud() {
  if (!sim) return;
  const L = sim.level, f = Math.max(0, sim.ship.fuel / L.fuel);
  $('h-time').textContent = (phase === 'won' ? finalTime : sim.t).toFixed(2);
  $('h-fuel').textContent = Math.round(f * 100) + '%';
  $('tank-fill').style.width = (f * 100).toFixed(1) + '%';
  $('tank').className = 'tank' + (f < 0.2 ? ' low' : '');
  const n = sim.got.length, got = sim.got.filter(Boolean).length;
  $('h-beacons').textContent = n ? got + ' / ' + n : 'none';
}

// ---------- drawing ----------
let grain = null, starTiles = [];
const TILE = 900;
function makeStars() {
  // Flat dots only: two sparse layers, the nearer one moving a little faster as you fly.
  starTiles = [{ n: 150, r: [0.5, 1.1], a: [0.25, 0.55], par: 0.06 }, { n: 45, r: [0.9, 1.6], a: [0.5, 0.9], par: 0.16 }].map((sp, li) => {
    const c = document.createElement('canvas'); c.width = c.height = TILE;
    const g = c.getContext('2d'); let seed = 1234 + li * 777;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < sp.n; i++) {
      const x = rnd() * TILE, y = rnd() * TILE, r = sp.r[0] + rnd() * (sp.r[1] - sp.r[0]), a = sp.a[0] + rnd() * (sp.a[1] - sp.a[0]);
      g.fillStyle = 'rgba(238,244,248,' + a + ')'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      if (li === 1 && rnd() < 0.12) { // the odd bright one gets a small cross, like a chart symbol
        g.strokeStyle = 'rgba(238,244,248,' + a * 0.7 + ')'; g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y); g.moveTo(x, y - 4); g.lineTo(x, y + 4); g.stroke();
      }
    }
    return { pat: ctx.createPattern(c, 'repeat'), par: sp.par };
  });
}
function makeGrain() {
  makeStars();
  const g = document.createElement('canvas'); g.width = g.height = 160;
  const c = g.getContext('2d'), img = c.createImageData(160, 160);
  let seed = 4242; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; // fixed, so the loading screen's copy matches
  for (let i = 0; i < img.data.length; i += 4) {
    const light = rnd() < 0.5;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = light ? 255 : 0;
    img.data[i + 3] = rnd() * (light ? 14 : 26);
  }
  c.putImageData(img, 0, 0);
  grain = ctx.createPattern(g, 'repeat');
}
function text(str, x, y, color, align, size) {
  ctx.font = (size || 10) + 'px ' + C.mono; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}
function ring(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, TAU); }
function drawPaper() {
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
  for (const s of starTiles) {
    const ox = -(cam.x * s.par) % TILE, oy = -(cam.y * s.par) % TILE;
    ctx.save(); ctx.translate(ox, oy); ctx.fillStyle = s.pat; ctx.fillRect(-ox - 1, -oy - 1, W + 2, H + 2); ctx.restore();
  }
  if (grain) { ctx.fillStyle = grain; ctx.fillRect(0, 0, W, H); }
}
function drawChart(L) {
  const z = cam.zoom, ox = sx(0), oy = sy(0), R = L.bounds * z;
  ctx.lineWidth = 1;
  for (let r = 100; r < L.bounds; r += 100) {
    ctx.strokeStyle = chalkA(r % 500 === 0 ? 0.16 : 0.07);
    ring(ox, oy, r * z); ctx.stroke();
  }
  ctx.strokeStyle = chalkA(0.07);
  ctx.beginPath();
  for (let i = 0; i < 12; i++) { const a = i * TAU / 12; ctx.moveTo(ox + Math.cos(a) * 60 * z, oy + Math.sin(a) * 60 * z); ctx.lineTo(ox + Math.cos(a) * R, oy + Math.sin(a) * R); }
  ctx.stroke();
  // the edge of the chart: cross it and the ship is lost
  ctx.strokeStyle = chalkA(0.75); ctx.lineWidth = 1.5;
  ring(ox, oy, R); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = chalkA(0.45);
  ctx.beginPath();
  for (let i = 0; i < 180; i++) {
    const a = i * TAU / 180, c = Math.cos(a), s = Math.sin(a), len = i % 15 === 0 ? 14 : i % 5 === 0 ? 9 : 5;
    ctx.moveTo(ox + c * R, oy + s * R); ctx.lineTo(ox + c * (R + len), oy + s * (R + len));
  }
  ctx.stroke();
}
function railOf(L, ent, t) {
  const o = ent.orbit;
  if (!o) return;
  let cx = o.cx || 0, cy = o.cy || 0;
  if (o.around) { const c = at(L, idxOf(L)[o.around], t); cx = c.x; cy = c.y; }
  ctx.strokeStyle = chalkA(0.13); ctx.lineWidth = 1; ctx.setLineDash([2, 6]);
  ring(sx(cx), sy(cy), o.r * cam.zoom); ctx.stroke(); ctx.setLineDash([]);
}
function drawBody(L, b, t, lit) {
  const p = at(L, b, t), x = sx(p.x), y = sy(p.y), z = cam.zoom, r = Math.max(2, b.radius * z);
  // Where this body's pull equals the ship's engine. Inside it you cannot hover, only orbit.
  if (b.mass < 0) { // a repulsor pushes only inside this circle
    const R = S.pushRange(b) * z;
    ctx.strokeStyle = ochreA(0.55); ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
    ring(x, y, R); ctx.stroke(); ctx.setLineDash([]);
    if (R > 40) text('PUSH RANGE', x, y - R - 9, ochreA(0.7), 'center', 9);
  } else if (b.mass) {
    const lim = Math.sqrt(Math.abs(b.mass) / S.SHIP.thrust) * z;
    if (lim > r + 8) {
      ctx.strokeStyle = b.mass > 0 ? chalkA(0.3) : ochreA(0.35); ctx.lineWidth = 1; ctx.setLineDash([1, 5]);
      ring(x, y, lim); ctx.stroke(); ctx.setLineDash([]);
      if (lim > 70 && b.mass > 0) text('ENGINE LIMIT', x, y - lim - 9, chalkA(0.42), 'center', 9);
    }
  }
  if (b.kind === 'star') {
    ctx.strokeStyle = chalkA(0.75); ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const a = i * TAU / 24 + t * 0.05, len = (i % 2 ? 0.22 : 0.45) * r + 2, c = Math.cos(a), s = Math.sin(a);
      ctx.moveTo(x + c * (r + 4), y + s * (r + 4)); ctx.lineTo(x + c * (r + 4 + len), y + s * (r + 4 + len));
    }
    ctx.stroke();
    ctx.fillStyle = C.chalk; ring(x, y, r); ctx.fill();
  } else if (b.kind === 'hole') {
    ctx.strokeStyle = chalkA(0.5); ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      const rr = r + 6 + k * 9 * z, a0 = -t * (1.6 - k * 0.3) + k;
      ctx.beginPath(); ctx.arc(x, y, rr, a0, a0 + 1.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, rr, a0 + Math.PI, a0 + Math.PI + 1.9); ctx.stroke();
    }
    ctx.fillStyle = '#02050b'; ring(x, y, r); ctx.fill();
    ctx.strokeStyle = C.chalk; ctx.lineWidth = 1.5; ring(x, y, r); ctx.stroke();
  } else if (b.kind === 'repulsor') {
    ctx.strokeStyle = C.ochre; ctx.lineWidth = 1.25;
    ring(x, y, r); ctx.stroke();
    ring(x, y, r * 0.55); ctx.stroke();
    const pulse = (t * 0.8) % 1;
    ctx.strokeStyle = ochreA(0.6 * (1 - pulse)); ring(x, y, r + pulse * 26 * z); ctx.stroke();
    ctx.strokeStyle = C.ochre; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8, c = Math.cos(a), s = Math.sin(a); ctx.moveTo(x + c * (r + 3), y + s * (r + 3)); ctx.lineTo(x + c * (r + 9), y + s * (r + 9)); }
    ctx.stroke();
  } else {
    ctx.fillStyle = C.chalk; ring(x, y, r); ctx.fill();
    if (lit && r > 3) {
      const a = Math.atan2(lit.y - p.y, lit.x - p.x);
      ctx.fillStyle = C.deep; ctx.beginPath(); ctx.arc(x, y, r - 0.6, a + Math.PI / 2, a + Math.PI * 1.5); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = C.chalk; ctx.lineWidth = 1; ring(x, y, r); ctx.stroke();
    if (b.kind === 'planet' && b.radius >= 20) { ctx.strokeStyle = chalkA(0.7); ctx.beginPath(); ctx.ellipse(x, y, r * 1.7, r * 0.45, -0.4, 0, TAU); ctx.stroke(); }
  }
}
const rockShapes = new Map();
function rockShape(i) {
  let s = rockShapes.get(i);
  if (!s) {
    s = []; let seed = (i + 1) * 9973;
    for (let k = 0; k < 9; k++) { seed = (seed * 16807) % 2147483647; s.push(0.72 + (seed % 1000) / 1000 * 0.42); }
    rockShapes.set(i, s);
  }
  return s;
}
function drawRock(L, a, i, t) {
  const p = at(L, a, t), x = sx(p.x), y = sy(p.y), r = (a.radius || 10) * cam.zoom, s = rockShape(i), spin = t * (0.4 + (i % 5) * 0.15);
  ctx.beginPath();
  for (let k = 0; k < s.length; k++) { const an = spin + k * TAU / s.length; ctx[k ? 'lineTo' : 'moveTo'](x + Math.cos(an) * r * s[k], y + Math.sin(an) * r * s[k]); }
  ctx.closePath();
  ctx.fillStyle = C.deep; ctx.fill(); ctx.strokeStyle = C.chalk; ctx.lineWidth = 1.25; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - r * 0.3, y - r * 0.1); ctx.lineTo(x + r * 0.1, y + r * 0.3); ctx.strokeStyle = chalkA(0.6); ctx.stroke();
}
function drawTargets(L, t, st) {
  const z = cam.zoom;
  (L.beacons || []).forEach((b, i) => {
    const p = at(L, b, t), x = sx(p.x), y = sy(p.y), r = (b.r || S.DEFAULT_BEACON_R) * z, got = st && st.got[i];
    if (got) { ctx.strokeStyle = ochreA(0.25); ctx.lineWidth = 1; ring(x, y, r * 0.5); ctx.stroke(); return; }
    const pulse = 0.5 + 0.5 * Math.sin(t * 3 + i);
    ctx.fillStyle = ochreA(0.1 + 0.08 * pulse); ctx.strokeStyle = C.ochre; ctx.lineWidth = 1.5;
    if (b.hold) ctx.setLineDash([5, 4]);
    ring(x, y, r); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    if (b.hold) {
      const done = st && st.held ? Math.min(1, st.held[i] / b.hold) : 0;
      if (done > 0) { ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, r + 5, -Math.PI / 2, -Math.PI / 2 + done * TAU); ctx.stroke(); ctx.lineWidth = 1.5; }
      text('HOLD ' + (done > 0 ? (b.hold * (1 - done)).toFixed(1) : b.hold.toFixed(1)) + ' s', x, y + r + 12, C.ochre, 'center', 9);
    }
    const d = 6 * Math.max(0.8, z);
    ctx.beginPath(); ctx.moveTo(x, y - d); ctx.lineTo(x + d, y); ctx.lineTo(x, y + d); ctx.lineTo(x - d, y); ctx.closePath();
    ctx.fillStyle = C.ochre; ctx.fill();
  });
  (L.cells || []).forEach((c, i) => {
    if (st && st.cells[i]) return;
    const p = at(L, c, t), x = sx(p.x), y = sy(p.y), r = 9 * Math.max(0.8, z);
    ctx.strokeStyle = C.chalk; ctx.lineWidth = 1.25; ctx.fillStyle = C.deep;
    ctx.beginPath(); ctx.rect(x - r * 0.7, y - r, r * 1.4, r * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.chalk; ctx.fillRect(x - r * 0.7, y - r + r * 0.9, r * 1.4, r * 1.1);
    text('FUEL', x, y + r + 9, chalkA(0.7), 'center', 9);
  });
  if (L.gate) {
    const p = at(L, L.gate, t), x = sx(p.x), y = sy(p.y), r = (L.gate.r || S.DEFAULT_GATE_R) * z, open = !st || st.gateOpen;
    if (open) {
      ctx.strokeStyle = C.ochre; ctx.lineWidth = 2;
      ring(x, y, r); ctx.stroke();
      ctx.lineWidth = 1.25;
      for (let k = 0; k < 3; k++) { const a0 = t * 1.8 + k * TAU / 3; ctx.beginPath(); ctx.arc(x, y, r + 7, a0, a0 + 1.2); ctx.stroke(); }
      ctx.fillStyle = ochreA(0.16); ring(x, y, r); ctx.fill();
      text('GATE', x, y, C.ochre, 'center', 10);
    } else {
      ctx.strokeStyle = chalkA(0.55); ctx.lineWidth = 1.25; ctx.setLineDash([4, 5]);
      ring(x, y, r); ctx.stroke(); ctx.setLineDash([]);
      text('GATE SHUT', x, y, chalkA(0.6), 'center', 9);
    }
  }
}
// A small rocket drawn as flat line art, nose forward. Local units: about 30 long.
function rocketPath(x, y, a, k, part) {
  const c = Math.cos(a), s = Math.sin(a);
  const X = (px, py) => x + (px * c - py * s) * k, Y = (px, py) => y + (px * s + py * c) * k;
  ctx.beginPath();
  if (part === 'body') {
    ctx.moveTo(X(-10, -4.5), Y(-10, -4.5)); ctx.lineTo(X(5, -4.5), Y(5, -4.5));
    ctx.quadraticCurveTo(X(13, -4), Y(13, -4), X(17, 0), Y(17, 0));
    ctx.quadraticCurveTo(X(13, 4), Y(13, 4), X(5, 4.5), Y(5, 4.5));
    ctx.lineTo(X(-10, 4.5), Y(-10, 4.5)); ctx.closePath();
  } else if (part === 'fins') {
    ctx.moveTo(X(-3, -4.5), Y(-3, -4.5)); ctx.lineTo(X(-11, -10.5), Y(-11, -10.5)); ctx.lineTo(X(-12, -4.5), Y(-12, -4.5)); ctx.closePath();
    ctx.moveTo(X(-3, 4.5), Y(-3, 4.5)); ctx.lineTo(X(-11, 10.5), Y(-11, 10.5)); ctx.lineTo(X(-12, 4.5), Y(-12, 4.5)); ctx.closePath();
  } else if (part === 'band') {
    ctx.moveTo(X(9, -4.4), Y(9, -4.4)); ctx.lineTo(X(9, 4.4), Y(9, 4.4));
  } else if (part === 'window') {
    ctx.arc(X(2.5, 0), Y(2.5, 0), 2.3 * k, 0, TAU);
  }
}
function shipPath(x, y, a, k) { rocketPath(x, y, a, k, 'body'); }
function drawRocket(x, y, a, k) {
  ctx.lineJoin = 'round'; ctx.lineWidth = 1.5; ctx.strokeStyle = C.chalk;
  ctx.fillStyle = C.deep; rocketPath(x, y, a, k, 'fins'); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.deep; rocketPath(x, y, a, k, 'body'); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 1.25; rocketPath(x, y, a, k, 'band'); ctx.stroke();
  ctx.fillStyle = C.chalk; rocketPath(x, y, a, k, 'window'); ctx.fill();
}
function drawShip() {
  const sh = sim.ship, x = sx(draw.x), y = sy(draw.y), k = Math.max(0.7, cam.zoom), ang = draw.a;
  if (trail.length >= 4) {
    const n = trail.length / 2;
    for (let band = 0; band < 4; band++) {
      const i0 = Math.floor(n * band / 4), i1 = Math.min(n - 1, Math.floor(n * (band + 1) / 4));
      if (i1 <= i0) continue;
      ctx.strokeStyle = chalkA(0.08 + 0.12 * band); ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(sx(trail[i0 * 2]), sy(trail[i0 * 2 + 1]));
      for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(sx(trail[i * 2]), sy(trail[i * 2 + 1]));
      if (band === 3) ctx.lineTo(x, y);
      ctx.stroke();
    }
  }
  if (phase === 'dead') return;
  if (sim.thrusting && (phase === 'fly' || phase === 'replay')) {
    const c = Math.cos(ang), s = Math.sin(ang), len = (19 + Math.random() * 10) * k, bx = x - c * 10 * k, by = y - s * 10 * k;
    ctx.fillStyle = C.ochre; ctx.beginPath();
    ctx.moveTo(bx - s * 3.5 * k, by + c * 3.5 * k);
    ctx.lineTo(bx - c * len, by - s * len);
    ctx.lineTo(bx + s * 3.5 * k, by - c * 3.5 * k);
    ctx.closePath(); ctx.fill();
  }
  // velocity marker: where the ship is actually heading, which is rarely where it points
  const sp = Math.hypot(sh.vx, sh.vy);
  if (sp > 12 && (phase === 'fly' || phase === 'replay')) {
    const ux = sh.vx / sp, uy = sh.vy / sp, len = Math.min(90, 18 + sp * 0.22) * k;
    ctx.strokeStyle = chalkA(0.5); ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.moveTo(x + ux * 20 * k, y + uy * 20 * k); ctx.lineTo(x + ux * len, y + uy * len); ctx.stroke(); ctx.setLineDash([]);
    ring(x + ux * len, y + uy * len, 2.5); ctx.stroke();
  }
  drawRocket(x, y, ang, k);
  if (phase === 'replay') text('SOLUTION', x, y - 32 * k, C.ochre, 'center', 11);
  if (phase === 'ready') {
    if ($('coach').hidden || !armed) text(armed ? 'BURN TO START THE CLOCK' : 'LET GO, THEN BURN', x, y - 32 * k, C.ochre, 'center', 11);
    if (view.on) { ctx.strokeStyle = C.ochre; ctx.lineWidth = 1.25; ring(x, y, 20 * k + 4 * Math.sin(performance.now() / 300)); ctx.stroke(); }
  }
}
// The orbit you are on right now around whatever pulls hardest: an ellipse while you are captured,
// with the low and high points marked, and flagged when its low point is inside the body.
function strongestPull(L, t, x, y) {
  let best = null, bestA = 0;
  for (const b of L.bodies || []) {
    if (!(b.mass > 0)) continue;
    const p = at(L, b, t), d2 = (p.x - x) ** 2 + (p.y - y) ** 2, acc = b.mass / (d2 + S.SHIP.soft);
    if (acc > bestA) { bestA = acc; best = b; }
  }
  return { body: best, acc: bestA };
}
function drawGuide() {
  if (!save.guide || !sim || (phase !== 'fly' && phase !== 'replay')) return;
  const L = sim.level, sh = sim.ship, pull = strongestPull(L, sim.t, sh.x, sh.y), b = pull.body;
  if (!b || pull.acc < 6) return;
  const p0 = at(L, b, sim.t), bx = p0.x, by = p0.y, p1 = at(L, b, sim.t + 0.02);
  const bvx = (p1.x - bx) / 0.02, bvy = (p1.y - by) / 0.02;
  const rx = sh.x - bx, ry = sh.y - by, vx = sh.vx - bvx, vy = sh.vy - bvy, mu = b.mass;
  const r = Math.hypot(rx, ry), v2 = vx * vx + vy * vy, eps = v2 / 2 - mu / r;
  const z = cam.zoom;
  if (eps >= 0) return; // escaping: no closed orbit to show
  const a = -mu / (2 * eps), rv = rx * vx + ry * vy;
  const ex = ((v2 - mu / r) * rx - rv * vx) / mu, ey = ((v2 - mu / r) * ry - rv * vy) / mu, e = Math.hypot(ex, ey);
  if (e > 0.995 || a * (1 + e) > L.bounds * 2.5) return;
  const ang = Math.atan2(ey, ex), semiB = a * Math.sqrt(Math.max(0, 1 - e * e));
  const peri = a * (1 - e), apo = a * (1 + e), impact = peri < b.radius + S.SHIP.radius;
  const cx = bx - a * ex, cy = by - a * ey;
  ctx.lineWidth = 1.5; ctx.setLineDash(impact ? [6, 5] : [5, 6]);
  ctx.strokeStyle = impact ? ochreA(0.85) : chalkA(0.7);
  ctx.beginPath(); ctx.ellipse(sx(cx), sy(cy), Math.max(0.5, a * z), Math.max(0.5, semiB * z), ang, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  if (e > 0.02) {
    const ux = Math.cos(ang), uy = Math.sin(ang);
    const px = sx(bx + ux * peri), py = sy(by + uy * peri), qx = sx(bx - ux * apo), qy = sy(by - uy * apo);
    ctx.fillStyle = impact ? C.ochre : C.chalk;
    ring(px, py, 2.5); ctx.fill();
    ring(qx, qy, 2.5); ctx.fill();
    if (impact) text('IMPACT', px + uy * 14, py - ux * 14, C.ochre, 'center', 9);
    else text('LOW ' + Math.round(peri - b.radius), px + ux * 16, py + uy * 16, chalkA(0.6), 'center', 9);
  } else if (!impact) {
    text('CIRCULAR', sx(bx), sy(by) - a * z - 10, chalkA(0.6), 'center', 9);
  }
}
function drawGhost() {
  if (!ghost || phase === 'ready' || phase === 'dead' || phase === 'replay') return;
  const f = (phase === 'won' ? finalTime : sim.t) / (DT * REC_EVERY) - 1, i = Math.floor(f), n = ghost.length / 3;
  if (i < 0 || i >= n - 1) return;
  const u = f - i, a0 = ghost[i * 3 + 2], a1 = a0 + S.wrap(ghost[i * 3 + 5] - a0);
  const gx = ghost[i * 3] + (ghost[i * 3 + 3] - ghost[i * 3]) * u, gy = ghost[i * 3 + 1] + (ghost[i * 3 + 4] - ghost[i * 3 + 1]) * u;
  shipPath(sx(gx), sy(gy), a0 + (a1 - a0) * u, Math.max(0.85, cam.zoom));
  ctx.strokeStyle = chalkA(0.4); ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
}
function drawSparks(dt) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const p = sparks[i];
    p.life -= dt;
    if (p.life <= 0) { sparks.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    const a = Math.min(1, p.life / p.max);
    ctx.fillStyle = p.ochre ? ochreA(a) : chalkA(a * 0.9);
    ctx.fillRect(sx(p.x) - 1, sy(p.y) - 1, 2, 2);
  }
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    b.age += dt;
    if (b.age > 0.5) { bursts.splice(i, 1); continue; }
    ctx.strokeStyle = ochreA(1 - b.age / 0.5); ctx.lineWidth = 1.5;
    ring(sx(b.x), sy(b.y), (20 + b.age * 120) * cam.zoom); ctx.stroke();
  }
}
const mapGeom = () => { const R = coarse ? Math.min(44, W * 0.11) : Math.min(58, W * 0.12); return coarse ? { R, cx: R + 14, cy: Math.min(H * 0.5, (H < 470 ? 100 : 124) + R) } : { R, cx: W - R - 18, cy: H - R - 64 }; };
let labelSpots = [];
function pointer(wx, wy, color, labelText, rad) {
  const x = sx(wx), y = sy(wy), m = 46, top = coarse ? (H < 470 ? 100 : 120) : 84, bottom = coarse ? H - (H < 470 ? 96 : 130) : H - 64, r = (rad || 0) * cam.zoom;
  if (x + r > 8 && x - r < W - 8 && y + r > 8 && y - r < H - 8) return; // anything you can see needs no arrow
  const cx = W / 2, cy = (top + bottom) / 2, dx = x - cx, dy = y - cy;
  const k = Math.min((W / 2 - m) / Math.max(1e-6, Math.abs(dx)), ((bottom - top) / 2) / Math.max(1e-6, Math.abs(dy)));
  let px = cx + dx * k, py = cy + dy * k;
  const a = Math.atan2(dy, dx), mg = mapGeom();
  if (Math.hypot(px - mg.cx, py - mg.cy) < mg.R + 30) { if (Math.abs(dx) > Math.abs(dy)) py = mg.cy - mg.R - 30; else px = mg.cx - mg.R - 30; }
  ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(px + Math.cos(a) * 10, py + Math.sin(a) * 10);
  ctx.lineTo(px + Math.cos(a + 2.5) * 9, py + Math.sin(a + 2.5) * 9);
  ctx.lineTo(px + Math.cos(a - 2.5) * 9, py + Math.sin(a - 2.5) * 9);
  ctx.closePath(); ctx.fill();
  const lx = px - Math.cos(a) * 24, ly = py - Math.sin(a) * 24;
  if (labelText && !labelSpots.some((q) => Math.hypot(q[0] - lx, q[1] - ly) < 22)) { text(labelText, lx, ly, color, 'center', 9); labelSpots.push([lx, ly]); }
}
function drawPointers() {
  const L = sim.level, sh = sim.ship;
  labelSpots = [];
  if (phase === 'ready') return;
  if (sim.gateOpen && L.gate) { const p = at(L, L.gate, sim.t), wx = p.x, wy = p.y; pointer(wx, wy, C.ochre, 'GATE', L.gate.r || S.DEFAULT_GATE_R); }
  (L.beacons || []).forEach((b, i) => {
    if (sim.got[i]) return;
    const p = at(L, b, sim.t), wx = p.x, wy = p.y;
    pointer(wx, wy, C.ochre, Math.round(Math.hypot(wx - sh.x, wy - sh.y)).toString(), b.r || S.DEFAULT_BEACON_R);
  });
}
function drawMap() {
  const L = sim.level, mg = mapGeom(), R = mg.R, cx = mg.cx, cy = mg.cy, k = R / L.bounds;
  ctx.fillStyle = W < 500 ? 'rgba(8,17,31,0.5)' : 'rgba(8,17,31,0.72)'; ring(cx, cy, R); ctx.fill();
  ctx.strokeStyle = chalkA(0.6); ctx.lineWidth = 1; ring(cx, cy, R); ctx.stroke();
  for (const b of L.bodies || []) {
    const p = at(L, b, sim.t);
    ctx.fillStyle = b.kind === 'repulsor' ? ochreA(0.6) : C.chalk;
    ring(cx + p.x * k, cy + p.y * k, Math.max(1.5, b.radius * k)); ctx.fill();
  }
  (L.beacons || []).forEach((b, i) => {
    if (sim.got[i]) return;
    const p = at(L, b, sim.t);
    ctx.fillStyle = C.ochre; ctx.fillRect(cx + p.x * k - 1.5, cy + p.y * k - 1.5, 3, 3);
  });
  if (L.gate) {
    const p = at(L, L.gate, sim.t);
    ctx.strokeStyle = sim.gateOpen ? C.ochre : chalkA(0.6); ring(cx + p.x * k, cy + p.y * k, 3.5); ctx.stroke();
  }
  const sh = sim.ship;
  ctx.strokeStyle = C.chalk; ctx.lineWidth = 1.5; ctx.beginPath();
  const mx = cx + sh.x * k, my = cy + sh.y * k;
  ctx.moveTo(mx - 4, my); ctx.lineTo(mx + 4, my); ctx.moveTo(mx, my - 4); ctx.lineTo(mx, my + 4); ctx.stroke();
}
function drawWorld(L, t, st) {
  drawChart(L);
  const all = [].concat(L.bodies || [], L.beacons || [], L.cells || [], L.asteroids || [], L.gate ? [L.gate] : []);
  for (const e of all) railOf(L, e, t);
  let star = null;
  for (const b of L.bodies || []) if (b.kind === 'star' && (!star || b.mass > star.mass)) star = b;
  const lit = star ? { x: at(L, star, t).x, y: P.y } : null;
  drawTargets(L, t, st);
  (L.asteroids || []).forEach((a, i) => drawRock(L, a, i, t));
  for (const b of L.bodies || []) drawBody(L, b, t, lit);
}

// ---------- title scene behind the menu ----------
// The same picture as the loading screen in index.html, at the same scale, so the loading screen
// fades into the menu without anything moving: a 600-wide chart, the sun, and the rocket on its orbit.
// The loading drawing is 1600 x 1000 units filling the screen (scaled to 60% on tall screens), and
// 0.7 of its units make one world unit here.
const TITLE = { bounds: 600, bodies: [{ id: 'title-sun', kind: 'star', mass: 0, radius: 30 / 0.7, x: 0, y: 0 }] };
const TITLE_ORBIT = 230 / 0.7, TITLE_LAP = 9; // seconds per lap, as in the loading screen
let titleT0 = null;
function drawTitle() {
  const s = Math.max(W / 1600, H / 1000) * (W <= H ? 0.6 : 1);
  cam.x = 0; cam.y = 0; cam.zoom = 0.7 * s;
  drawChart(TITLE);
  ctx.strokeStyle = chalkA(0.16); ctx.lineWidth = 1; ctx.setLineDash([2 * s, 7 * s]);
  ring(sx(0), sy(0), TITLE_ORBIT * cam.zoom); ctx.stroke(); ctx.setLineDash([]);
  drawBody(TITLE, TITLE.bodies[0], 0, null);
  // the loading screen's orbit started when the page opened, so this carries on from the same spot
  if (titleT0 === null) { // lock to the loading screen's own animation clock, which starts a little after the page does
    titleT0 = 0;
    try { const o = document.querySelector('#loader .ld-orbit'), an = o && o.getAnimations ? o.getAnimations()[0] : null; if (an && an.currentTime !== null) titleT0 = performance.now() - an.currentTime; } catch (e) {}
  }
  const t = reduced ? 0 : (performance.now() - titleT0) / 1000, th = Math.PI + TAU * t / TITLE_LAP;
  const r = TITLE_ORBIT * cam.zoom;
  drawRocket(sx(0) + Math.cos(th) * r, sy(0) + Math.sin(th) * r, th + Math.PI / 2, 1.35 * s);
}

// ---------- frame ----------
let last = 0, hudT = 0;
let frameErr = null;
function frame(now) {
  try { frameBody(now); } catch (err) {
    if (!frameErr) {
      frameErr = String((err && err.message) || err);
      try { console.error(err); } catch (e2) {}
      toast('Something went wrong drawing the game: ' + frameErr + '. Please pass this message on.', 15000);
    }
    requestAnimationFrame(frame);
  }
}
function frameBody(now) {
  const dt = Math.min(0.1, (now - last) / 1000 || 0);
  last = now;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawPaper();

  if (screen === 'menu' || !sim) {
    menuT += dt;
    drawTitle();
    requestAnimationFrame(frame);
    return;
  }

  if (!paused) {
    if (phase === 'replay') {
      if (!replay.ended) { for (let k = 0; k < 2; k++) stepReplay(dt / 2); }
      else { phaseT -= dt; if (phaseT <= 0) { replay = null; startLevel(levelIdx, true); } }
    } else if (phase === 'ready' || phase === 'fly') {
      acc += dt;
      let n = 0;
      while (acc >= DT && n < 14 && (phase === 'ready' || phase === 'fly')) { acc -= DT; n++; tick(); }
      if (n === 14) acc = 0; // never drop the leftover otherwise: on screens faster than 120 Hz a frame is shorter than one step
    } else if (phase === 'dead') {
      phaseT -= dt;
      if (phaseT <= 0) startLevel(levelIdx, true, true);
    } else if (phase === 'won') {
      phaseT -= dt;
      if (phaseT <= 0 && $('result').hidden) showResult();
    }
  }
  {
    const s0 = sim.ship, u = phase === 'fly' ? Math.max(0, Math.min(1, acc / DT)) : 1;
    draw.x = prev.x + (s0.x - prev.x) * u; draw.y = prev.y + (s0.y - prev.y) * u; draw.a = prev.a + S.wrap(s0.a - prev.a) * u;
  }
  const flying = (phase === 'fly' || (phase === 'replay' && replay && !replay.ended)) && !paused;
  Sfx.thrust(flying && sim.thrusting);
  Sfx.danger(flying ? dangerLevel() : 0);

  // camera: lead the ship a little and pull back as it speeds up
  const sh = sim.ship, speed = Math.hypot(sh.vx, sh.vy);
  let tz = baseZoom() * (1 - Math.min(0.28, speed / 1400));
  // pull back far enough to keep the nearest thing you still need in frame, within reason
  let near = Infinity;
  const Lc = sim.level;
  (Lc.beacons || []).forEach((b, i) => { if (!sim.got[i]) { const p = at(Lc, b, sim.t); near = Math.min(near, Math.hypot(p.x - sh.x, p.y - sh.y)); } });
  if (sim.gateOpen && Lc.gate) { const p = at(Lc, Lc.gate, sim.t); near = Math.min(near, Math.hypot(p.x - sh.x, p.y - sh.y)); }
  if (isFinite(near)) tz = Math.max(Math.min(W, H) < 500 ? 0.34 : 0.42, Math.min(tz, (Math.min(W, H - 120) / 2 - 50) / Math.max(1, near * 0.75)));
  const tx = sh.x + sh.vx * 0.3, ty = sh.y + sh.vy * 0.3 + (coarse ? 10 / cam.zoom : 0);
  const ease = 1 - Math.pow(0.002, dt);
  if (view.on) { cam.x = view.x; cam.y = view.y; cam.zoom = view.zoom; }
  else { cam.x += (tx - cam.x) * ease; cam.y += (ty - cam.y) * ease; cam.zoom += (tz - cam.zoom) * (1 - Math.pow(0.02, dt)); }
  let ox = 0, oy = 0;
  if (shake > 0.2) { ox = (Math.random() - 0.5) * shake; oy = (Math.random() - 0.5) * shake; shake *= Math.pow(0.004, dt); }
  cam.x += ox / cam.zoom; cam.y += oy / cam.zoom;

  drawWorld(sim.level, sim.t, sim);
  drawGuide();
  drawGhost();
  drawShip();
  drawSparks(paused ? 0 : dt);
  drawPointers();
  drawMap();
  cam.x -= ox / cam.zoom; cam.y -= oy / cam.zoom;

  tutorialTick(paused ? 0 : dt);
  hudT += dt;
  if (hudT > 0.05) { updateHud(); hudT = 0; }
  requestAnimationFrame(frame);
}

// ---------- boot, and keeping a viewer's place across a republish ----------
let started = false;
function start(data) {
  if (started) return; started = true;
  resize(); makeGrain();
  if (typeof ResizeObserver === 'function') new ResizeObserver(resize).observe(canvas); else window.addEventListener('resize', resize);
  Sfx.setMuted(save.muted);
  $('b-sound').setAttribute('aria-pressed', String(!save.muted));
  $('b-guide').setAttribute('aria-pressed', String(save.guide));
  if (coarse) {
    document.body.classList.add('touch');
    $('keys-hint').textContent = '';
    document.querySelectorAll('.kb').forEach((n) => { n.hidden = true; });
    document.querySelectorAll('.touchonly').forEach((n) => { n.hidden = false; });
  }
  showMenu();
  document.body.classList.add('ready');
  // The loading screen stays at least one second from page open, then fades into the menu.
  const since = (window.performance && performance.now) ? performance.now() : 1000;
  setTimeout(() => document.body.classList.add('loaded'), Math.max(0, 1000 - since));
  cloudInit();
  if (data && data.screen === 'play' && LV[data.levelIdx]) startLevel(data.levelIdx);
  requestAnimationFrame((now) => { last = now; frame(now); });
}
const hot = window.claude && window.claude.hot;
if (hot && hot.snapshot) hot.snapshot(() => ({ screen, levelIdx }));
if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
