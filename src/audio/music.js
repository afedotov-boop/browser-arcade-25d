// Музыка (DESIGN 5.1 — 7 треков): процедурный step-sequencer, WebAudio,
// без аудиофайлов и внешних сервисов (P06). 16-е ноты, lookahead-планирование
// (0.12 c от ctx.currentTime) — джиттер-устойчиво при 60 fps.
// I4 (ARCH §4.14): на паузе audio.tick() не вызывается → новые ноты не
// планируются (хвост <=120 мс), музыка фактически останавливается.
// Кроссфейд 1 с при смене трека (DESIGN 5.3); «Затмение» — one-shot 3 c.
// Интенсификация «ВЕГИ» по фазам (DESIGN 5.1): П2 — +«скрипки»,
// П3 — +перкуссия и октавный бас.
import { AUDIO_TRACKS } from '../config.js';
import { makeNoiseBuffer } from './sfx.js';

// Частоты нот (Гц).
const N = {
  A1: 55, A2: 110, A3: 220, A4: 440,
  C3: 130.81, C4: 261.63, C5: 523.25,
  D2: 73.42, D3: 146.83, D4: 293.66,
  E2: 82.41, E4: 329.63, E5: 659.25,
  F2: 87.31, F3: 174.63, F4: 349.23,
  G1: 49, G2: 98, G3: 196, G4: 392, Gs4: 415.3,
  B3: 246.94, B4: 493.88
};

// Каждый трек — цикл из 4 тактов (16-х на такт); паттерны на такт.
const TRACKS = {
  // «Вечер в Новгорске» — ретро-фюжн lounge, 85 BPM.
  menu: {
    bars: 4,
    roots: [N.A2, N.F2, N.C3, N.G2],
    chords: [[N.A3, N.C4, N.E4, N.G4], [N.F3, N.A3, N.C4, N.E4], [N.C4, N.E4, N.G4, N.B4], [N.G3, N.B3, N.D4, N.E4]],
    kick: [0, 8], snare: [], hat: [0, 4, 8, 12],
    bass: [[0, 1, 7], [8, 1.5, 3]],
    pad: 1
  },
  // «Смена» — напряжённый фанк, 105 BPM.
  l1: {
    bars: 4,
    roots: [N.A2, N.A2, N.D3, N.E2],
    chords: [[N.C4, N.E4, N.G4], [N.C4, N.E4, N.B4], [N.D4, N.F4, N.A4], [N.E4, N.Gs4, N.B4]],
    kick: [0, 6, 8, 14], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14],
    bass: [[0, 1, 2], [3, 1, 1], [6, 1, 1], [10, 1.5, 1], [12, 1, 2]],
    stab: [2, 10]
  },
  // «Атриум» — игривый, 120 BPM.
  l2: {
    bars: 4,
    roots: [N.C3, N.A2, N.F2, N.G2],
    chords: [[N.C4, N.E4, N.G4], [N.A3, N.C4, N.E4], [N.F3, N.A3, N.C4], [N.G3, N.B3, N.D4]],
    kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14],
    bass: [[0, 1, 1], [2, 1, 1], [4, 1, 1], [6, 1, 1], [8, 1, 1], [10, 1.25, 1], [12, 1, 1], [14, 1, 1]],
    pad: 2,
    leadNotes: [N.C4, N.E4, N.A4, N.G4, N.E4, N.D4],
    lead: [0, 2, 4, 8, 10, 12]
  },
  // «Меридиан» — тяжёлый, 70 BPM, гул труб.
  l3: {
    bars: 4,
    roots: [N.D2, N.D2, N.A1, N.G1],
    chords: [[N.D4, N.F4], [N.A3, N.D4], [N.A3, N.D4], [N.G3, N.D4]],
    kick: [0], snare: [], hat: [12],
    bass: [[0, 1, 14]],
    deep: true, drone: true
  },
  // «ВЕГА» — диско-фанк, 140 BPM, 3-фазная интенсификация.
  boss: {
    bars: 4,
    roots: [N.A2, N.D3, N.E2, N.A2],
    chords: [[N.A3, N.C4, N.E4], [N.D4, N.F4, N.A4], [N.E4, N.Gs4, N.B4], [N.A3, N.C4, N.E4]],
    kick: [0, 4, 8, 12], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14],
    bass: [[2, 1, 1], [6, 1, 1], [10, 1, 1], [14, 1, 1]],
    arp: true,
    strings: false, octBass: false, extraPerc: false
  },
  // «Затмение» — 3 c стинг (виниловый треск + power-down 400→50 Гц), затем тишина.
  death: { oneshot: true },
  // «Утро» — тёплый, 90 BPM.
  victory: {
    bars: 4,
    roots: [N.C3, N.A2, N.F2, N.G2],
    chords: [[N.C4, N.E4, N.G4], [N.A3, N.C4, N.E4], [N.F3, N.A3, N.C4], [N.G3, N.B3, N.D4]],
    kick: [0, 8], snare: [4, 12], hat: [0, 4, 8, 12],
    bass: [[0, 1, 6], [8, 1.5, 3]],
    pad: 2,
    pluck: [0, 2, 4, 6, 8, 10, 12, 14],
    pluckNotes: [N.C4, N.E4, N.G4, N.C5, N.G4, N.E4, N.D4, N.G4]
  }
};

export class Music {
  constructor(masterBus) {
    this.master = masterBus;
    this.ctx = null;
    this.current = null;      // id активного трека
    this.trackGain = null;
    this.noise = null;
    this.step = 0;
    this.nextTime = 0;
    this.scheduled = 0;       // ?debug=1: __audio.Music.scheduled
    this.bossPhase = 1;
    this.droneNodes = null;
  }

  // вызывается каждый кадр из audio.tick (кроме паузы — I4).
  update(ctx, target) {
    if (!ctx) return;
    this.ctx = ctx;
    if (!this.noise) this.noise = makeNoiseBuffer(ctx);
    if (target !== this.current) {
      if (!target || !TRACKS[target]) { this.stopAll(); return; }
      this.switchTo(ctx, target, target === 'death' ? 0.25 : 1.0);
    }
    if (this.current === 'boss') {
      const tb = TRACKS.boss;
      tb.strings = this.bossPhase >= 2;
      tb.octBass = this.bossPhase >= 3;
      tb.extraPerc = this.bossPhase >= 3;
    }
    this.schedule(ctx);
  }

  setBossPhase(p) { this.bossPhase = Math.max(1, Math.min(3, p || 1)); }

  // I4 (ARCH §4.14): пауза = стоп музыки, включая уже запланированные
  // lookahead-ноды (step-такт остановлен гейтом tick в loop.js, здесь
  // глушится хвост gain'ом). На возобновлении nextTime ресинхронизируется,
  // чтобы не было «сгустка» catch-up шагов.
  setPaused(p) {
    const g = this.trackGain, ctx = this.ctx;
    if (!g || !ctx) return;
    const t = ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    if (p) {
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.setTargetAtTime(0.0001, t, 0.03);
    } else {
      g.gain.setTargetAtTime(1, t, 0.05);
      this.nextTime = t + 0.05;
    }
  }

  switchTo(ctx, id, fade) {
    const oldGain = this.trackGain;
    this.stopDrone();
    if (oldGain) {
      const t = ctx.currentTime;
      oldGain.gain.cancelScheduledValues(t);
      oldGain.gain.setValueAtTime(oldGain.gain.value, t);
      oldGain.gain.linearRampToValueAtTime(0.0001, t + fade);
      const og = oldGain;
      setTimeout(() => { try { og.disconnect(); } catch (e) { /* */ } }, fade * 1000 + 250);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.linearRampToValueAtTime(1, ctx.currentTime + fade);
    g.connect(this.master);
    this.trackGain = g;
    this.current = id;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.08;
    const tr = TRACKS[id];
    if (tr.oneshot) { this.playSting(ctx, g); return; }
    if (tr.drone) this.startDrone(ctx, g);
  }

  stopAll() {
    if (this.trackGain && this.ctx) {
      const t = this.ctx.currentTime;
      this.trackGain.gain.cancelScheduledValues(t);
      this.trackGain.gain.setTargetAtTime(0.0001, t, 0.08);
      const og = this.trackGain;
      this.trackGain = null;
      setTimeout(() => { try { og.disconnect(); } catch (e) { /* */ } }, 300);
    }
    this.stopDrone();
    this.current = null;
  }

  // «Затмение»: 3 c стинг (DESIGN 5.1).
  playSting(ctx, g) {
    const t0 = ctx.currentTime + 0.02;
    for (let i = 0; i < 22; i++) { // виниловый треск
      const t = t0 + Math.random() * 1.4;
      this._noiseAt(ctx, g, t, 0.02, 0.05 + Math.random() * 0.04, { bp: 2500 + Math.random() * 2000, q: 2 });
    }
    this._tone(ctx, g, t0, { type: 'sawtooth', f0: 400, f1: 50, f1exp: true, d: 2.0, v: 0.26, lp: 900, release: 0.3 });
    this._tone(ctx, g, t0, { type: 'sine', f0: 80, f1: 20, f1exp: true, d: 1.8, v: 0.18 });
  }

  // Гул труб (55 Гц + шум) — «Меридиан» (DESIGN 5.1).
  startDrone(ctx, g) {
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 55;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 55.4;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 220;
    const ng = ctx.createGain(); ng.gain.value = 0.35;
    const dg = ctx.createGain(); dg.gain.value = 0.0001;
    o1.connect(f); o2.connect(f); f.connect(dg);
    src.connect(nf); nf.connect(ng); ng.connect(dg);
    dg.connect(g);
    dg.gain.setTargetAtTime(0.05, ctx.currentTime, 0.5);
    o1.start(); o2.start(); src.start();
    this.droneNodes = { o1, o2, src, dg };
  }
  stopDrone() {
    if (!this.droneNodes || !this.ctx) return;
    const { o1, o2, src, dg } = this.droneNodes;
    this.droneNodes = null;
    const t = this.ctx.currentTime;
    dg.gain.cancelScheduledValues(t);
    dg.gain.setTargetAtTime(0.0001, t, 0.2);
    try { o1.stop(t + 1); o2.stop(t + 1); src.stop(t + 1); } catch (e) { /* stopped */ }
  }

  schedule(ctx) {
    const tr = TRACKS[this.current];
    if (!tr || tr.oneshot || !this.trackGain) return;
    const stepDur = 60 / AUDIO_TRACKS[this.current].bpm / 4;
    if (this.nextTime < ctx.currentTime - 0.3) this.nextTime = ctx.currentTime + 0.05; // ресинк после паузы/лаг
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.playStep(tr, stepDur, this.step, this.nextTime);
      this.scheduled++;
      this.step++;
      this.nextTime += stepDur;
      if (this.step >= tr.bars * 16) this.step = 0;
    }
  }

  playStep(tr, stepDur, step, t) {
    const g = this.trackGain;
    const bar = Math.floor(step / 16);
    const s16 = step % 16;
    const root = tr.roots[bar % tr.roots.length];
    const chord = tr.chords[bar % tr.chords.length];
    const isKick = tr.kick.includes(s16);
    if (isKick) this._kick(this.ctx, g, t, this.current === 'l3' ? 0.32 : 0.22);
    if (tr.snare.includes(s16)) this._snare(this.ctx, g, t, this.current === 'boss' ? 0.15 : 0.11);
    const extraHat = tr.extraPerc && (s16 === 6 || s16 === 14);
    if (tr.hat.includes(s16) || extraHat) {
      this._hat(this.ctx, g, t, s16 % 4 === 2 ? 0.045 : 0.028, extraHat || s16 === 14);
    }
    for (const [bs, ratio, len] of tr.bass) {
      if (bs === s16) this._bass(this.ctx, g, t, root * ratio, stepDur * len, 0.24, this.current === 'l3');
    }
    if (tr.octBass && isKick) this._bass(this.ctx, g, t, root * 2, stepDur * 0.5, 0.13, false);
    if (tr.strings && s16 === 0 && bar % 2 === 0) { // П2 «ВЕГИ»: свелл «скрипок»
      for (const f of chord) {
        this._tone(this.ctx, g, t, { type: 'sawtooth', f0: f, d: stepDur * 14, v: 0.026, lp: 2200, attack: stepDur * 6, release: 0.8 });
      }
    }
    if (tr.stab && tr.stab.includes(s16)) {
      this._tone(this.ctx, g, t, { type: 'sawtooth', f0: chord[0], d: stepDur * 1.5, v: 0.05, lp: 2600, attack: 0.004 });
      this._tone(this.ctx, g, t, { type: 'sawtooth', f0: chord[1] || chord[0] * 1.5, d: stepDur * 1.5, v: 0.04, lp: 2400, attack: 0.004 });
    }
    if (tr.lead && tr.lead.includes(s16)) { // л2: игривая мелодия
      const li = Math.floor(s16 / 2) % tr.leadNotes.length;
      this._tone(this.ctx, g, t, { type: 'square', f0: tr.leadNotes[li], d: stepDur * 1.2, v: 0.045, lp: 3200, attack: 0.004 });
    }
    if (tr.arp && s16 % 2 === 0) { // «ВЕГА»: арпеджио восьмыми
      const seq = [chord[0], chord[1], chord[2] || chord[0] * 1.5, chord[0] * 2];
      this._tone(this.ctx, g, t, { type: 'sawtooth', f0: seq[(s16 / 2) % 4], d: stepDur * 0.9, v: 0.038, lp: 2800, attack: 0.003 });
    }
    if (tr.pluck && tr.pluck.includes(s16)) { // «Утро»: «акустическая гитара»
      const pi = Math.floor(s16 / 2) % tr.pluckNotes.length;
      this._tone(this.ctx, g, t, { type: 'triangle', f0: tr.pluckNotes[pi], d: 0.35, v: 0.055, attack: 0.002, release: 0.12 });
    }
    if (tr.pad && s16 === 0 && bar % tr.pad === 0) { // пэды-свеллы по аккордам
      const dur = stepDur * 16 * tr.pad;
      for (const f of chord) {
        this._tone(this.ctx, g, t, { type: 'sine', f0: f, d: dur, v: 0.032, attack: 0.4, release: 0.6 });
      }
      this._tone(this.ctx, g, t, { type: 'sawtooth', f0: root, d: dur, v: 0.018, lp: 700, attack: 0.5, release: 0.6 });
    }
    if (tr.deep && s16 === 8) this._kick(this.ctx, g, t, 0.35, 0.4); // «Меридиан»: редкий глубокий удар
  }

  // --- минисинтез (записи планируются на t — внутри lookahead-окна) ---
  _kick(ctx, g, t, v = 0.22, d = 0.12) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + d);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(v, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.05);
    o.connect(gn); gn.connect(g);
    o.start(t); o.stop(t + d + 0.1);
  }
  _snare(ctx, g, t, v = 0.12) {
    this._noiseAt(ctx, g, t, 0.12, v, { bp: 1800, q: 0.8 });
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 190;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(v * 0.5, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(gn); gn.connect(g);
    o.start(t); o.stop(t + 0.1);
  }
  _hat(ctx, g, t, v = 0.03, open = false) {
    this._noiseAt(ctx, g, t, open ? 0.15 : 0.035, v, { hp: 7500 });
  }
  _bass(ctx, g, t, f, d, v, sub) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = f;
    const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = sub ? 300 : 520;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(v, t + 0.01);
    gn.gain.setValueAtTime(v, t + d * 0.7);
    gn.gain.linearRampToValueAtTime(0.0001, t + d);
    o.connect(gn); o2.connect(g2); g2.connect(f2); f2.connect(gn);
    gn.connect(g);
    o.start(t); o.stop(t + d + 0.05);
    o2.start(t); o2.stop(t + d + 0.05);
  }
  _tone(ctx, g, t, { type = 'sine', f0 = 440, f1 = null, f1exp = false, d = 0.3, v = 0.1, lp = 0, attack = 0.01, release = 0.06 }) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t);
    if (f1 != null) {
      const f1v = Math.max(1, f1);
      if (f1exp) o.frequency.exponentialRampToValueAtTime(f1v, t + Math.max(0.02, d * 0.9));
      else o.frequency.linearRampToValueAtTime(f1v, t + Math.max(0.02, d * 0.9));
    }
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(v, t + attack);
    gn.gain.setTargetAtTime(0.0001, t + d, Math.max(0.012, release / 3));
    let head = o;
    if (lp > 0) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; head.connect(f); head = f; }
    head.connect(gn);
    gn.connect(g);
    o.start(t);
    o.stop(t + d + release + 0.15);
  }
  _noiseAt(ctx, g, t, d, v, { hp = 0, lp = 0, bp = 0, q = 1 } = {}) {
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    let head = src;
    if (hp > 0) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; head.connect(f); head = f; }
    if (lp > 0) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; head.connect(f); head = f; }
    if (bp > 0) { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = bp; f.Q.value = q; head.connect(f); head = f; }
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(v, t + 0.004);
    gn.gain.setTargetAtTime(0.0001, t + d, Math.max(0.012, d / 4));
    head.connect(gn);
    gn.connect(g);
    src.start(t, Math.random() * 0.8);
    src.stop(t + d + 0.2);
  }
}

export { TRACKS as _musicTracks };
