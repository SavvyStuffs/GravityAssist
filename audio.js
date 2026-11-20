/* Gravity Assist - synthesized sound module. Global: window.Sfx
 * No samples, no libraries. Nothing sounds until Sfx.init() is called. */
(function () {
  'use strict';

  var AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
  var ctx = null, master = null, comp = null, noiseBuf = null;
  var muted = false, MASTER_VOL = 0.35; // everything about 30% quieter after playtesting
  var beaconStep = 0;

  // Engine / danger / music node sets (built once)
  var eng = null, dng = null, mus = null;
  var thrustOn = false, dangerLevel = -1;
  var musicWanted = false, bellTimer = null;

  // Pentatonic (minor, A): semitone offsets from A
  var PENT = [0, 3, 5, 7, 10];
  function hz(base, semis) { return base * Math.pow(2, semis / 12); }
  function pent(base, i) { return hz(base, PENT[i % 5] + 12 * Math.floor(i / 5)); }

  function now() { return ctx.currentTime; }

  // ---------- helpers ----------
  // A single enveloped oscillator note. Cleans itself up when finished.
  function tone(freq, t0, dur, o) {
    o = o || {};
    var osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.endFreq) osc.frequency.exponentialRampToValueAtTime(o.endFreq, t0 + dur);
    if (o.detune) osc.detune.setValueAtTime(o.detune, t0);
    var peak = o.gain == null ? 0.2 : o.gain, a = o.attack == null ? 0.008 : o.attack;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.setTargetAtTime(0.0001, t0 + a + (o.hold || 0), (dur - a) / 4);
    osc.connect(g); g.connect(o.dest || master);
    osc.start(t0); osc.stop(t0 + dur + 0.1);
    osc.onended = function () { try { osc.disconnect(); g.disconnect(); } catch (e) {} };
    return osc;
  }

  // Filtered noise burst, optional filter sweep.
  function noise(t0, dur, o) {
    o = o || {};
    var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf;
    f.type = o.type || 'lowpass';
    f.Q.setValueAtTime(o.q || 0.7, t0);
    f.frequency.setValueAtTime(o.freq || 1000, t0);
    if (o.endFreq) f.frequency.exponentialRampToValueAtTime(o.endFreq, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.gain == null ? 0.2 : o.gain, t0 + (o.attack || 0.004));
    g.gain.setTargetAtTime(0.0001, t0 + (o.attack || 0.004), dur / 4);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.1);
    src.onended = function () { try { src.disconnect(); f.disconnect(); g.disconnect(); } catch (e) {} };
  }

  // The Wilhelm scream: BigSoundBank's recording (sound ID 0477, bigsoundbank.com), supplied by the
  // owner, trimmed and compressed to MP3. It is decoded once when sound starts up.
  var SCREAM_MP3 = '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LjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7YMTvgBadCRptJHPJXgakWGY8AVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==';
  var screamBuf = null, screamLoading = false;
  function loadScream() {
    if (screamBuf || screamLoading || !ctx) return;
    screamLoading = true;
    try {
      var bin = atob(SCREAM_MP3), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var done = function (buf) { screamBuf = buf; };
      var p = ctx.decodeAudioData(bytes.buffer, done, function () { screamLoading = false; });
      if (p && p.then) p.then(done, function () { screamLoading = false; });
    } catch (e) { screamLoading = false; }
  }
  // far: 0 for a crash, 1 for drifting off the chart (quieter and duller, as if from far away)
  function playScream(t, far) {
    if (!screamBuf) { scream(t, far); return; }  // not decoded yet: fall back to the synthesized one
    var src = ctx.createBufferSource(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    src.buffer = screamBuf;
    lp.type = 'lowpass';
    if (far) {
      // Drifting off the edge: starts dull and fades away clearly, as if falling into the distance.
      var len = screamBuf.duration / 0.94;
      src.playbackRate.setValueAtTime(0.94, t);
      lp.frequency.setValueAtTime(2000, t); lp.frequency.linearRampToValueAtTime(500, t + len);
      g.gain.setValueAtTime(0.6, t); g.gain.linearRampToValueAtTime(0.0001, t + len); // even fade over the whole scream
    } else {
      lp.frequency.setValueAtTime(16000, t);
      g.gain.setValueAtTime(0.7, t);   // crash scream, kept modest (was 1.3, then 1.0)
    }
    src.connect(lp); lp.connect(g); g.connect(master);
    src.start(t);
    src.onended = function () { try { src.disconnect(); lp.disconnect(); g.disconnect(); } catch (e) {} };
  }

  // An original synthesized cartoon scream (fallback): a buzzy voice source through three vowel formants
  // ("aah" sliding toward "aw"), yelping up, catching, then falling away. far softens and dulls it.
  function scream(t, far) {
    far = far || 0;
    var dur = 1.15, vol = (0.75 - far * 0.35);
    var src = ctx.createOscillator(), vib = ctx.createOscillator(), vibAmt = ctx.createGain();
    src.type = 'sawtooth';
    var f = src.frequency;
    f.setValueAtTime(560, t);
    f.exponentialRampToValueAtTime(1080, t + 0.13);     // the yelp
    f.exponentialRampToValueAtTime(960, t + 0.34);
    f.setValueAtTime(1010, t + 0.4);                     // the catch, then the long fall
    f.exponentialRampToValueAtTime(820, t + 0.62);
    f.exponentialRampToValueAtTime(330, t + dur);
    vib.frequency.setValueAtTime(6.5, t); vibAmt.gain.setValueAtTime(22, t);
    vibAmt.gain.linearRampToValueAtTime(40, t + dur);
    vib.connect(vibAmt); vibAmt.connect(f);
    var amp = ctx.createGain(), g = amp.gain;
    g.setValueAtTime(0.0001, t);
    g.linearRampToValueAtTime(vol, t + 0.05);
    g.setValueAtTime(vol, t + 0.33);
    g.linearRampToValueAtTime(vol * 0.25, t + 0.37);
    g.linearRampToValueAtTime(vol * 0.9, t + 0.43);
    g.setTargetAtTime(0.0001, t + 0.8, 0.12);
    var formants = [[760, 600, 4.5, 0.8], [1180, 960, 6, 0.6], [2550, 2400, 13, 0.28], [3400, 3300, 16, 0.12]];
    var nodes = [src, vib, vibAmt, amp];
    var tone = ctx.createBiquadFilter(); tone.type = 'lowpass';
    tone.frequency.setValueAtTime(far ? 1800 : 6000, t); nodes.push(tone);
    var breath = ctx.createBufferSource(), bg = ctx.createGain();
    breath.buffer = noiseBuf; bg.gain.setValueAtTime(0.05, t); breath.connect(bg); nodes.push(breath, bg);
    formants.forEach(function (fm) {
      var bp = ctx.createBiquadFilter(), fg = ctx.createGain();
      bp.type = 'bandpass'; bp.Q.setValueAtTime(fm[2], t);
      bp.frequency.setValueAtTime(fm[0], t); bp.frequency.linearRampToValueAtTime(fm[1], t + dur);
      fg.gain.setValueAtTime(fm[3] * 3.2, t);
      src.connect(bp); bg.connect(bp); bp.connect(fg); fg.connect(amp);
      nodes.push(bp, fg);
    });
    amp.connect(tone); tone.connect(master);
    src.start(t); vib.start(t); breath.start(t, Math.random() * 0.5);
    var end = t + dur + 0.3;
    src.stop(end); vib.stop(end); breath.stop(end);
    src.onended = function () { nodes.forEach(function (n) { try { n.disconnect(); } catch (e) {} }); };
  }

  // ---------- one-shot sounds ----------
  var SOUNDS = {
    // Clear two-note chime; each call steps up the pentatonic scale.
    beacon: function (t) {
      var i = beaconStep++ % 10, f = pent(440, i);
      tone(f, t, 0.9, { gain: 0.16 });
      tone(f * 2, t, 0.5, { gain: 0.04 });
      tone(f * 1.5, t + 0.11, 1.0, { gain: 0.14 });
      tone(f * 3, t + 0.11, 0.5, { gain: 0.03 });
    },
    // Short liquid upward blip.
    cell: function (t) {
      tone(380, t, 0.16, { endFreq: 900, gain: 0.15, attack: 0.01 });
      tone(760, t + 0.03, 0.14, { endFreq: 1500, gain: 0.05, attack: 0.01 });
    },
    // Soft swelling chord (A minor add 9-ish), about 0.8 s.
    gate: function (t) {
      [220, 329.6, 440, 523.3, 659.3].forEach(function (f, i) {
        tone(f, t, 0.85, { type: i % 2 ? 'sine' : 'triangle', gain: 0.07, attack: 0.5, detune: (i - 2) * 4 });
      });
    },
    // Bright resolved arpeggio, about 1.2 s.
    win: function (t) {
      [440, 554.4, 659.3, 880, 1108.7].forEach(function (f, i) {
        tone(f, t + i * 0.1, 0.9, { gain: 0.13, hold: 0.05 });
        tone(f * 2, t + i * 0.1, 0.4, { gain: 0.025 });
      });
      tone(220, t + 0.3, 0.9, { gain: 0.08, type: 'triangle' });
    },
    // Noise burst plus falling thump, about 0.5 s.
    crash: function (t) {
      noise(t, 0.3, { freq: 2400, endFreq: 200, gain: 0.16, q: 0.8 });
      tone(150, t, 0.4, { endFreq: 35, gain: 0.25, attack: 0.004 });
      playScream(t + 0.02, 0);
    },
    // Lonely falling tone, about 0.7 s.
    // Drifting off the chart: the same scream, quieter and duller, as if from far away.
    lost: function (t) {
      playScream(t, 1);
    },
    // Bounced off a repulsor: a short springy boing.
    bounce: function (t) {
      tone(220, t, 0.28, { endFreq: 520, gain: 0.16, type: 'triangle', attack: 0.004 });
      tone(440, t + 0.02, 0.22, { endFreq: 900, gain: 0.05, attack: 0.004 });
    },
    // Two dull low ticks.
    empty: function (t) {
      [0, 0.16].forEach(function (d) {
        tone(110, t + d, 0.09, { endFreq: 70, gain: 0.2, type: 'triangle', attack: 0.003 });
        noise(t + d, 0.05, { freq: 400, gain: 0.08 });
      });
    },
    // Very short soft tick; resets the beacon scale.
    start: function (t) {
      beaconStep = 0;
      tone(660, t, 0.06, { gain: 0.07, attack: 0.002 });
    },
    // Quiet UI tick.
    click: function (t) {
      tone(880, t, 0.04, { gain: 0.05, attack: 0.002 });
    },
    // Short sparkle of high pentatonic notes.
    medal: function (t) {
      [0, 1, 2, 4, 5].forEach(function (n, i) {
        tone(pent(1760, n), t + i * 0.05, 0.35, { gain: 0.05, attack: 0.004 });
      });
    }
  };

  // ---------- continuous voices (built once) ----------
  function buildEngine() {
    var src = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), ng = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 0.9;
    ng.gain.value = 0.9;
    var low = ctx.createOscillator(), lg = ctx.createGain();
    low.type = 'triangle'; low.frequency.value = 62;
    lg.gain.value = 0.35;
    var out = ctx.createGain();
    out.gain.value = 0;
    src.connect(lp); lp.connect(ng); ng.connect(out);
    low.connect(lg); lg.connect(out);
    out.connect(master);
    src.start(); low.start();
    eng = { out: out };
  }

  function buildDanger() {
    var osc = ctx.createOscillator(), amp = ctx.createGain(), lvl = ctx.createGain();
    var lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = 41;
    amp.gain.value = 0.5;
    lfo.type = 'sine'; lfo.frequency.value = 1.8; lfoG.gain.value = 0.5; // throb
    lvl.gain.value = 0;
    lfo.connect(lfoG); lfoG.connect(amp.gain);
    osc.connect(amp); amp.connect(lvl); lvl.connect(master);
    osc.start(); lfo.start();
    dng = { lvl: lvl };
  }

  function buildMusic() {
    var out = ctx.createGain(), lp = ctx.createBiquadFilter();
    out.gain.value = 0;
    lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 1.2;
    // slow filter sweep
    var lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.frequency.value = 0.05; lfoG.gain.value = 220;
    lfo.connect(lfoG); lfoG.connect(lp.frequency);
    // detuned voices on a low fifth (A1, E2, A2)
    [[55, 'sine', -5], [55, 'triangle', 6], [82.4, 'sine', 4], [82.4, 'triangle', -7], [110, 'sine', 3]]
      .forEach(function (v) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = v[1]; o.frequency.value = v[0]; o.detune.value = v[2];
        g.gain.value = 0.22;
        o.connect(g); g.connect(lp); o.start();
      });
    lp.connect(out); out.connect(master);
    lfo.start();
    mus = { out: out };
  }

  // Background music: "Kulakovka" by MedicalTech (Pixabay Content License), looped and kept far back.
  var TRACK_URL = 'MedicalTech%20-%20Kulakovka.mp3', TRACK_VOL = 0.13; // the song is loud; 0.13 is about 18 dB down
  var track = null;
  function buildTrack() {
    try {
      var el = new Audio(); el.src = TRACK_URL; el.loop = true; el.preload = 'auto';
      el.setAttribute('playsinline', '');
      var g = ctx.createGain(); g.gain.value = 0;
      ctx.createMediaElementSource(el).connect(g); g.connect(master); // through the master gain, so M mutes it
      track = { el: el, g: g, stopTimer: null };
    } catch (e) { track = null; }
  }

  var trackStarted = false;
  function applyTrack() {
    try {
      if (!ctx) return;
      if (!track) buildTrack();
      if (!track) return;
      if (musicWanted && !muted) {
        if (track.stopTimer) { clearTimeout(track.stopTimer); track.stopTimer = null; }
        var pr = track.el.play(); if (pr && pr.catch) pr.catch(function () {});
        // the very first start fades in slowly (~6 s); after a pause or unmute, ~2 s
        track.g.gain.setTargetAtTime(TRACK_VOL, now(), trackStarted ? 0.7 : 2); trackStarted = true;
      } else {
        track.g.gain.setTargetAtTime(0, now(), 0.3);            // ~1 s fade out, then pause where it is
        if (track.stopTimer) clearTimeout(track.stopTimer);
        track.stopTimer = setTimeout(function () { track.stopTimer = null; if (!(musicWanted && !muted)) try { track.el.pause(); } catch (e) {} }, 1500);
      }
    } catch (e) {}
  }

  // Occasional soft high bell on a random pentatonic note.
  function scheduleBell() {
    if (bellTimer) clearTimeout(bellTimer);
    bellTimer = setTimeout(function () {
      bellTimer = null;
      try {
        if (!musicWanted || !ctx || !mus) return;
        var f = pent(880, Math.floor(Math.random() * 10)), t = now() + 0.02;
        tone(f, t, 3, { gain: 0.05, attack: 0.02, dest: mus.out });
        tone(f * 2.76, t, 1.2, { gain: 0.008, attack: 0.02, dest: mus.out });
      } catch (e) {}
      if (musicWanted) scheduleBell();
    }, 4000 + Math.random() * 5000);
  }

  function ready() {
    if (!ctx) return false;
    if (ctx.state === 'suspended' && ctx.resume) { try { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
    return true;
  }

  // ---------- public API ----------
  window.Sfx = {
    // Create or resume the AudioContext (idempotent).
    init: function () {
      try {
        if (!AC) return;
        if (!ctx) {
          ctx = new AC();
          master = ctx.createGain();
          master.gain.value = muted ? 0 : MASTER_VOL;
          comp = ctx.createDynamicsCompressor();
          master.connect(comp); comp.connect(ctx.destination);
          var n = Math.floor(ctx.sampleRate * 2);
          noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
          var d = noiseBuf.getChannelData(0);
          for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
          buildEngine(); buildDanger();
        }
        loadScream();
        ready();
        if (musicWanted) window.Sfx.music(true);
      } catch (e) {}
    },
    setMuted: function (m) {
      try {
        muted = !!m;
        if (master) master.gain.setTargetAtTime(muted ? 0 : MASTER_VOL, now(), 0.02);
        applyTrack(); // muting pauses the song; unmuting fades it back in
      } catch (e) {}
    },
    isMuted: function () { return muted; },
    // Engine rumble: filtered noise plus low tone; gain ramp only.
    thrust: function (on) {
      try {
        on = !!on;
        if (!ctx || !eng || on === thrustOn) return;
        thrustOn = on;
        eng.out.gain.setTargetAtTime(on ? 0.16 : 0, now(), on ? 0.03 : 0.027);
      } catch (e) {}
    },
    play: function (name) {
      try {
        if (!ready() || !SOUNDS.hasOwnProperty(name)) return;
        SOUNDS[name](now() + 0.005);
      } catch (e) {}
    },
    // Background music: the looped track (fades in when flying, out and paused otherwise).
    music: function (on) {
      try {
        on = !!on;
        musicWanted = on;
        if (!ctx) return;
        applyTrack();
      } catch (e) {}
    },
    // Sub-bass throb scaled by gravity-well depth (0..1).
    danger: function (level) {
      try {
        if (!ctx || !dng) return;
        var l = Math.max(0, Math.min(1, +level || 0));
        l = Math.round(l * 50) / 50;
        if (l === dangerLevel) return;
        dangerLevel = l;
        dng.lvl.gain.setTargetAtTime(l * 0.15, now(), 0.08);
      } catch (e) {}
    }
  };
})();
