// SFX (DESIGN 5.2 — 23 срабатывания): WebAudio-синтез (osc + noise + biquad),
// без файлов и внешних ассетов (P06). Autoplay-safe: ctx/bus получает только
// из audio.unlockAudio() внутри жеста пользователя; до того все no-op.
// Голос ВЕГИ (DESIGN 1.4/5.2): формантный синтез — процедурный фолбэк
// (внешние TTS-сервисы в окружении недоступны; TEAM_DECISION, см. карточку).
import { Bus } from '../core/events.js';
import { ENEMIES } from '../config.js';

// Общий white-noise буфер (1 c, стерео) — используется SFX и музыкой.
export function makeNoiseBuffer(ctx) {
  const len = Math.floor(ctx.sampleRate * 1.0);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return buf;
}

const S = {
  ctx: null,
  bus: null,
  hits: {},           // hits[name] — счётчик срабатываний (?debug=1: __audio.S.hits)
  _noiseBuf: null,
  _active: 0,         // активные голоса (приоритет SFX, DESIGN 5.3)

  attach(ctx, bus) { this.ctx = ctx; this.bus = bus; },

  // DESIGN 5.3: >4 одновременных SFX — остальные −10 дБ.
  _v(v) { return this._active > 4 ? v * 0.316 : v; },
  _begin() { this._active++; },
  _end(d) { setTimeout(() => { this._active = Math.max(0, this._active - 1); }, d * 1000); },
  _count(name, n) { S.hits[name] = (S.hits[name] || 0) + (n || 1); },

  _noise() {
    if (!this._noiseBuf) this._noiseBuf = makeNoiseBuffer(this.ctx);
    return this._noiseBuf;
  },

  // Осциллятор + огибающая (падение exp/lin) + опц. lowpass.
  _tone({ type = 'sine', f0 = 440, f1 = null, f1exp = false, t = 0, d = 0.1, v = 0.2, lp = 0, attack = 0.005, release = 0.06 }) {
    const ctx = this.ctx;
    const t0 = t || ctx.currentTime + 0.002;
    const v0 = this._v(v);
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t0);
    if (f1 != null) {
      const f1v = Math.max(1, f1);
      if (f1exp) o.frequency.exponentialRampToValueAtTime(f1v, t0 + Math.max(0.02, d * 0.9));
      else o.frequency.linearRampToValueAtTime(f1v, t0 + Math.max(0.02, d * 0.9));
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(v0, t0 + attack);
    g.gain.setTargetAtTime(0.0001, t0 + d, Math.max(0.012, release / 3));
    let head = o;
    if (lp > 0) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; head.connect(f); head = f; }
    head.connect(g);
    g.connect(this.bus);
    o.start(t0);
    o.stop(t0 + d + release + 0.1);
    this._begin();
    this._end(d + release);
  },

  // Шумовой всплеск + фильтры (highpass/lowpass/bandpass).
  _noiseHit({ t = 0, d = 0.1, v = 0.2, hp = 0, lp = 0, bp = 0, q = 1 }) {
    const ctx = this.ctx;
    const t0 = t || ctx.currentTime + 0.002;
    const v0 = this._v(v);
    const src = ctx.createBufferSource();
    src.buffer = this._noise();
    let head = src;
    if (hp > 0) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; head.connect(f); head = f; }
    if (lp > 0) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; head.connect(f); head = f; }
    if (bp > 0) { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = bp; f.Q.value = q; head.connect(f); head = f; }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(v0, t0 + 0.004);
    g.gain.setTargetAtTime(0.0001, t0 + d, Math.max(0.012, d / 4));
    head.connect(g);
    g.connect(this.bus);
    src.start(t0, Math.random() * 0.8);
    src.stop(t0 + d + 0.2);
    this._begin();
    this._end(d + 0.2);
  },

  // --- DESIGN 5.2: 23 SFX (точные спецификации из листа) ---
  // 1. Выстрел: шум + спад частоты 800→200 Гц, 80 мс.
  shoot() {
    this._count('shoot');
    this._tone({ type: 'sine', f0: 800, f1: 200, f1exp: true, d: 0.08, v: 0.2 });
    this._noiseHit({ d: 0.05, v: 0.05, hp: 2000 });
  },
  // 2. Пустой магазин: короткий щелчок.
  empty() {
    this._count('empty');
    this._noiseHit({ d: 0.03, v: 0.18, bp: 3000, q: 3 });
    this._tone({ type: 'square', f0: 2200, d: 0.02, v: 0.07 });
  },
  // 3. Перезарядка: клики-клики + барабан (3 щелчка, 300 мс).
  reload() {
    this._count('reload');
    const t0 = this.ctx.currentTime + 0.002;
    for (let i = 0; i < 4; i++) {
      this._noiseHit({ t: t0 + i * 0.1, d: 0.03, v: 0.16 - i * 0.02, bp: 1800, q: 3 });
    }
    this._noiseHit({ t: t0, d: 0.34, v: 0.035, lp: 1200 });
  },
  // 4. Урон игрока: глухой «тупой» удар + cutoff, низкий синус 100 Гц, 150 мс.
  playerHit() {
    this._count('playerHit');
    this._tone({ f0: 100, f1: 55, f1exp: true, d: 0.15, v: 0.4 });
    this._noiseHit({ d: 0.1, v: 0.14, lp: 420 });
  },
  // 5. Смерть игрока: спад частоты 200→20 Гц, 800 мс.
  playerDeath() {
    this._count('playerDeath');
    this._tone({ type: 'sawtooth', f0: 200, f1: 20, f1exp: true, d: 0.8, v: 0.3, lp: 1000, release: 0.2 });
    this._tone({ f0: 60, f1: 18, f1exp: true, d: 0.9, v: 0.22 });
    this._noiseHit({ d: 0.5, v: 0.08, lp: 500 });
  },
  // 6. Попадание во врага: металлический пинг, высокий синус 1200 Гц, 60 мс.
  enemyHit() {
    this._count('enemyHit');
    this._tone({ f0: 1200, d: 0.06, v: 0.11 });
    this._tone({ f0: 2400, d: 0.04, v: 0.035 });
  },
  // 7. Смерть врага: короткий (шум + треск, 200 мс) + обвал (низкий удар).
  enemyDeath() {
    this._count('enemyDeath');
    this._noiseHit({ d: 0.2, v: 0.2, bp: 2500, q: 0.6 });
    this._tone({ f0: 90, f1: 35, f1exp: true, d: 0.25, v: 0.3 });
    this._noiseHit({ d: 0.12, v: 0.09, lp: 350 });
  },
  // 8. Выстрел Смотрителя: «пищущий» (шум + резкий затухание, 100 мс).
  sentryShoot() {
    this._count('sentryShoot');
    this._noiseHit({ d: 0.1, v: 0.13, bp: 2800, q: 1.5 });
    this._tone({ type: 'square', f0: 1800, f1: 400, d: 0.1, v: 0.07 });
  },
  // 9. Ближний Смотритель: «глухой» низкий удар, 100 мс.
  sentryMelee() {
    this._count('sentryMelee');
    this._tone({ f0: 80, f1: 40, f1exp: true, d: 0.1, v: 0.4 });
    this._noiseHit({ d: 0.07, v: 0.1, lp: 320 });
  },
  // 10. Шаг Стартапа: тихий шум, интервал 120 мс (тиканье — в audio.tick).
  stalkerStep() {
    this._count('stalkerStep');
    this._noiseHit({ d: 0.06, v: 0.035, lp: 500 });
  },
  // 11. Удар Стартапа: «шлепок» (высокий + низкий, 100 мс).
  stalkerStrike() {
    this._count('stalkerStrike');
    this._tone({ f0: 2000, d: 0.05, v: 0.09 });
    this._tone({ f0: 90, f1: 45, f1exp: true, d: 0.1, v: 0.28 });
    this._noiseHit({ d: 0.06, v: 0.08, lp: 600 });
  },
  // 12. Телеграф Регистратора: линейный 400→2000 Гц, 1 с (deng deng).
  gunnerTelegraph() {
    this._count('gunnerTelegraph');
    this._tone({ type: 'sawtooth', f0: 400, f1: 2000, d: 1.0, v: 0.07, lp: 2600, attack: 0.08 });
    this._tone({ type: 'sine', f0: 400, f1: 2000, d: 1.0, v: 0.04, attack: 0.08 });
  },
  // 13. Выстрел Регистратора: 2000 Гц, 50 мс.
  gunnerShoot() {
    this._count('gunnerShoot');
    this._tone({ type: 'square', f0: 2000, d: 0.05, v: 0.1 });
  },
  // 14. Шаг игрока: очень тихий (тиканье — в audio.tick, интервал 200 мс).
  playerStep() {
    this._count('playerStep');
    this._noiseHit({ d: 0.06, v: 0.025, lp: 400 });
  },
  // 15. Дверь/лифт: пневматический шип (шум, 500 мс) + звон 800 Гц 200 мс.
  door() {
    this._count('door');
    this._noiseHit({ d: 0.5, v: 0.09, bp: 1000, q: 0.5 });
    const t0 = this.ctx.currentTime + 0.12;
    this._tone({ f0: 800, d: 0.2, v: 0.13, t: t0 });
    this._tone({ f0: 1600, d: 0.15, v: 0.04, t: t0 });
  },
  // 16. Обнаружение: «дзинь» 1000 Гц, 100 мс.
  discover() {
    this._count('discover');
    this._tone({ f0: 1000, d: 0.1, v: 0.11 });
    this._tone({ f0: 1500, d: 0.07, v: 0.04 });
  },
  // 17. Суммон ВЕГИ (П1, раз в 12 c): ш-ш-ш шум + нарастание, 1 с.
  bossSummon() {
    this._count('bossSummon');
    this._noiseHit({ d: 0.5, v: 0.05, bp: 700, q: 0.5 });
    this._noiseHit({ t: this.ctx.currentTime + 0.5, d: 0.5, v: 0.06, bp: 2200, q: 0.5 });
    this._tone({ f0: 300, f1: 1200, d: 1.0, v: 0.06, attack: 0.25 });
  },
  // 18. Луч ВЕГИ (П2): низкий синус 80 Гц + шум, непрерывный (guu-uum).
  _beam: null,
  beamHum(on) {
    const ctx = this.ctx;
    if (!ctx) return;
    if (on) {
      if (this._beam) return;
      this._count('beamHum');
      const t0 = ctx.currentTime + 0.01;
      const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 80;
      const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 80.6;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
      const src = ctx.createBufferSource(); src.buffer = this._noise(); src.loop = true;
      const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 250;
      const g = ctx.createGain(); g.gain.value = 0.0001;
      o1.connect(f); o2.connect(f); f.connect(g);
      src.connect(nf); nf.connect(g);
      g.connect(this.bus);
      g.gain.setTargetAtTime(0.045, t0, 0.15);
      o1.start(t0); o2.start(t0); src.start(t0);
      this._beam = { o1, o2, src, g };
    } else if (this._beam) {
      const b = this._beam;
      this._beam = null;
      const t = ctx.currentTime;
      b.g.gain.cancelScheduledValues(t);
      b.g.gain.setTargetAtTime(0.0001, t, 0.15);
      try { b.o1.stop(t + 0.8); b.o2.stop(t + 0.8); b.src.stop(t + 0.8); } catch (e) { /* stopped */ }
      setTimeout(() => { try { b.g.disconnect(); } catch (e) { /* */ } }, 1000);
    }
  },
  // 19. Даш ВЕГИ: спад 3000→500 Гц, 300 мс.
  bossDash() {
    this._count('bossDash');
    this._tone({ type: 'sawtooth', f0: 3000, f1: 500, f1exp: true, d: 0.3, v: 0.16, lp: 3500 });
    this._noiseHit({ d: 0.2, v: 0.07, hp: 500 });
  },
  // 20. Смерть ВЕГИ: 500→20 Гц, 2 c + 5 случайных «колоколов» в 0–1.5 c.
  bossDeath() {
    this._count('bossDeath');
    const t0 = this.ctx.currentTime + 0.01;
    this._tone({ type: 'sawtooth', f0: 500, f1: 20, f1exp: true, d: 2.0, v: 0.28, lp: 900, release: 0.5 });
    this._tone({ f0: 60, f1: 18, f1exp: true, d: 1.8, v: 0.2 });
    this._noiseHit({ d: 1.2, v: 0.1, lp: 700 });
    for (let i = 0; i < 5; i++) {
      const bf = 1800 + Math.random() * 1400;
      this._tone({ f0: bf, d: 0.5, v: 0.07, t: t0 + Math.random() * 1.5 });
      this._tone({ f0: bf * 2.7, d: 0.3, v: 0.025, t: t0 + Math.random() * 1.5 });
    }
  },
  // 21. Голос ВЕГИ (1.4/5.2): 4 фразы, тёплый синтезаторный голос, медленная речь.
  _FORMANTS: {
    a: [800, 1150, 2900], o: [500, 850, 2300], u: [320, 900, 2200],
    i: [300, 2250, 3000], e: [550, 1800, 2600], y: [420, 1300, 2800],
    ya: [700, 1700, 2600], yo: [600, 1200, 2800]
  },
  _CONSONANTS: {
    d: [2400, 1.5, 0.06], r: [1300, 2.5, 0.05], j: [2400, 0.8, 0.08], zh: [1700, 0.8, 0.08],
    l: [1500, 2, 0.05], ts: [3200, 1, 0.07], p: [1200, 0.8, 0.08], n: [450, 1, 0.09],
    ch: [2600, 1, 0.08], z: [1800, 0.8, 0.06], m: [420, 1, 0.09]
  },
  // Фразы (DESIGN 1.4): [гласная, длительность слога, согласная-наступление]
  voice(phrase) {
    const ctx = this.ctx;
    if (!ctx) return;
    this._count('voice' + phrase);
    const P = [
      // 0. «Добро пожаловать» (старт боя)
      [['o', 0.30, 'd'], ['a', 0.24, 'r'], ['o', 0.20, 'j'], ['a', 0.20, 'zh'], ['o', 0.18, 'l'], ['ya', 0.36, null]],
      // 1. «Всё идёт по плану» (П2)
      [['yo', 0.30, null], ['i', 0.14, 'ts'], ['yo', 0.16, 'd'], ['a', 0.26, 'p'], ['a', 0.18, 'p'], ['u', 0.34, 'n']],
      // 2. «Пора домой» (П3)
      [['o', 0.22, 'p'], ['a', 0.24, 'r'], ['o', 0.20, 'd'], ['i', 0.34, 'm']],
      // 3. «Вечер — это мы» (смерть босса)
      [['e', 0.28, 'v'], ['a', 0.16, 'ch'], ['e', 0.20, 'r'], ['a', 0.18, 'z'], ['a', 0.18, 't'], ['i', 0.34, 'm']]
    ];
    const ph = P[((phrase % 4) + 4) % 4];
    const t0 = ctx.currentTime + 0.02;
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 7;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 9;
    const f3 = ctx.createBiquadFilter(); f3.type = 'bandpass'; f3.Q.value = 12;
    const g1 = ctx.createGain(); g1.gain.value = 1;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    const g3 = ctx.createGain(); g3.gain.value = 0.1;
    const out = ctx.createGain(); out.gain.value = this._v(0.9);
    out.connect(this.bus);
    f1.connect(g1); g1.connect(out);
    f2.connect(g2); g2.connect(out);
    f3.connect(g3); g3.connect(out);
    const src = ctx.createOscillator(); src.type = 'sawtooth';
    src.frequency.setValueAtTime(112, t0);
    src.frequency.linearRampToValueAtTime(102, t0 + 2.4);
    const vib = ctx.createOscillator(); vib.type = 'sine'; vib.frequency.value = 5.2;
    const vibG = ctx.createGain(); vibG.gain.value = 4;
    vib.connect(vibG); vibG.connect(src.frequency);
    const sg = ctx.createGain(); sg.gain.value = 0.0001;
    src.connect(sg);
    sg.connect(f1); sg.connect(f2); sg.connect(f3);
    let t = t0;
    for (const [vw, dur, cons] of ph) {
      const F = this._FORMANTS[vw] || this._FORMANTS.a;
      f1.frequency.setTargetAtTime(F[0], t, 0.025);
      f2.frequency.setTargetAtTime(F[1], t, 0.025);
      f3.frequency.setTargetAtTime(F[2], t, 0.025);
      sg.gain.setValueAtTime(0.0001, t);
      sg.gain.linearRampToValueAtTime(0.9, t + 0.04);
      if (dur > 0.1) sg.gain.setValueAtTime(0.9, t + dur - 0.06);
      sg.gain.linearRampToValueAtTime(0.0001, t + dur + 0.1);
      if (cons) {
        const c = this._CONSONANTS[cons] || this._CONSONANTS.d;
        this._noiseHit({ t: Math.max(t0, t - 0.06), d: 0.07, v: c[2], bp: c[0], q: c[1] });
      }
      t += dur + 0.09;
    }
    const tEnd = t + 0.2;
    src.start(t0); src.stop(tEnd);
    vib.start(t0); vib.stop(tEnd);
    this._begin(); this._end(tEnd - t0);
    setTimeout(() => { try { out.disconnect(); } catch (e) { /* */ } }, 3000);
  },
  // 22. UI-клик: 800 Гц, 80 мс.
  uiClick() {
    this._count('uiClick');
    this._tone({ f0: 800, d: 0.08, v: 0.09 });
  },
  // 23. UI-ховер: тихий тик 1200 Гц, 30 мс.
  uiHover() {
    this._count('uiHover');
    this._tone({ f0: 1200, d: 0.03, v: 0.045 });
  }
};

// --- Подписки на события шины (имена — ARCH §4.5/§4.9; контракт событий не меняется) ---
const gameRef = () => (typeof window !== 'undefined' ? window.__game : null);
let lastShootAt = 0;

Bus.on('player:shoot', () => { lastShootAt = performance.now(); S.shoot(); });
Bus.on('player:reload', (p) => {
  if (p && !p.auto) { S.reload(); return; } // R — полная перезарядка
  if (performance.now() - lastShootAt < 80) S.reload(); // авто-перезарядка после последнего выстрела (тот же кадр)
  else S.empty(); // пустой магазин: ЛКМ при 0 патронов — «Клик» (DESIGN 5.2)
});
Bus.on('player:hit', () => {
  // Melee-дискриминация (эвристика аудио-слоя — игровой контракт не трогаем):
  // удар Ближнего/Стартапа наносится в пределах meleeRange; пули Смотрителя
  // стартуют от >=150 px, поэтому попадание издалека не спутается с ударом.
  const g = gameRef();
  let kind = null;
  if (g && g.state.run) {
    const L = g.state.run.level, pl = g.state.run.player;
    for (const e of L.enemies) {
      if (e.dead) continue;
      if (e.type !== 'sentry' && e.type !== 'stalker') continue;
      if (Math.hypot(pl.x - e.x, pl.y - e.y) <= ENEMIES[e.type].meleeRange + 16) { kind = e.type; break; }
    }
  }
  if (kind === 'stalker') S.stalkerStrike();
  else if (kind === 'sentry') S.sentryMelee();
  else S.playerHit();
});
Bus.on('player:death', () => S.playerDeath());
Bus.on('enemy:hit', () => S.enemyHit());
Bus.on('enemy:death', () => S.enemyDeath());
Bus.on('enemy:shoot', (p) => { if (p.type === 'sentry') S.sentryShoot(); else if (p.type === 'gunner') S.gunnerShoot(); });
Bus.on('enemy:discover', () => S.discover());
Bus.on('level:exit-armed', () => S.door()); // «Дверь/лифт»: открытие, когда выход стал доступен
Bus.on('boss:summon', () => S.bossSummon());
Bus.on('boss:dash', () => S.bossDash());
Bus.on('boss:death', () => { S.bossDeath(); S.voice(3); }); // «Вечер — это мы»
Bus.on('boss:phase', (p) => { if (p.phase === 2) S.voice(1); else if (p.phase === 3) S.voice(2); });
Bus.on('boss:hit', () => S.enemyHit());
Bus.on('boss:shield-hit', () => S.enemyHit());
Bus.on('boss:spark-hit', () => S.playerHit());
Bus.on('boss:beam-hit', () => S.playerHit());
Bus.on('ui:click', () => S.uiClick());
Bus.on('ui:hover', () => S.uiHover());

export { S };
