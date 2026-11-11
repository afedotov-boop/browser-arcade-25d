// Audio (docs/ARCHITECTURE.md §10.2): WebAudio — lazy AudioContext,
// autoplay-safe (контекст создаётся ТОЛЬКО в обработчике user-gesture).
// До первого жеста — полная тишина (autoplay policy: browser-проверка
// "тишина до клика"). Громкость/mute с персистентностью (localStorage).
// Каждый кадр: audio.tick() — выбор трека (DESIGN 5.1), тиkanie-эмбиент
// (шаги игрока 200 мс / шаги Стартапа 120 мс), луч ВЕГИ, голос на старте боя.
// I4 (ARCH §4.14): на паузе tick не планирует ноты → музыка стоп.
import { Bus } from '../core/events.js';
import { S } from './sfx.js';
import { Music } from './music.js';
import { GRACE_S } from '../levels/level.js';

const LS_KEY = 'lzk_audio';
const _load = (k, d) => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? d : JSON.parse(v); // null (нет ключа) → дефолт; иначе JSON
  } catch (e) { return d; }
};
const _save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } };

const audio = {
  ctx: null,
  master: null,
  musicBus: null,
  sfxBus: null,
  volume: Math.min(1, Math.max(0, _load(LS_KEY + '_vol', 0.8))),
  muted: !!_load(LS_KEY + '_mute', false),
  unlocked: false,
  music: null,
  _bossGreeted: new WeakSet(),
  _stepT: 0,
  _stalkerT: 0,
  _aimPrev: new Set(), // uid Регистраторов в телеграфе (SFX 12: 1s «заряд»)

  get ctxState() { return this.ctx ? this.ctx.state : 'none'; },

  // Autoplay-safe: вызывается ТОЛЬКО из обработчиков пользовательского жеста
  // (keydown/pointerdown в loop.js). Повторный вызов безопасен.
  unlock() {
    if (typeof window === 'undefined' || !window.AudioContext) return false;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.music = new Music(this.musicBus);
      S.attach(this.ctx, this.sfxBus);
      this.master.gain.value = this.muted ? 0 : this.volume;
      try {
        const r = this.ctx.resume();
        if (r && typeof r.then === 'function') r.catch(() => { /* suspended до следующего жеста */ });
      } catch (e) { /* autoplay policy */ }
      this.unlocked = true;
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => { /* suspended */ });
    }
    return true;
  },

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, Number(v) || 0));
    _save(LS_KEY + '_vol', this.volume);
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  },
  setMuted(m) {
    this.muted = !!m;
    _save(LS_KEY + '_mute', this.muted);
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  },
  toggleMute() { this.setMuted(!this.muted); },

  // Целевой трек по состоянию (DESIGN 5.1 — 7 треков).
  targetTrack(game) {
    const gs = game.state;
    switch (gs.mode) {
      case 'menu': return 'menu';
      case 'intro': case 'story': return gs.run && gs.run.levelIndex >= 2 ? 'l3' : 'menu';
      case 'death': return 'death';
      case 'victory': return 'victory';
      default: return null;
    }
  },

  // Каждый кадр из loop.tick (не вызывается на паузе — I4).
  tick(game, dt) {
    const gs = game.state;
    const L = gs.run ? gs.run.level : null;
    const pl = gs.run ? gs.run.player : null;
    let target = this.targetTrack(game);
    if (gs.mode === 'level' && gs.run) {
      target = gs.run.level.boss ? 'boss' : ('l' + (gs.run.levelIndex + 1));
      // Интенсификация «ВЕГИ» по фазе (DESIGN 5.1: П2 +скрипки, П3 +перкуссия).
      if (target === 'boss' && L.boss && !L.boss.dead) this.music.setBossPhase(L.boss.phase || 1);
      // Голос ВЕГИ фраза 0 «Добро пожаловать» — на старте боя (конец grace).
      if (L.boss && !L.boss.dead && L.time >= GRACE_S && !this._bossGreeted.has(L.boss)) {
        this._bossGreeted.add(L.boss);
        S.voice(0);
      }
    }
    if (this.ctx) this.music.update(this.ctx, target);
    // Луч ВЕГИ (П2): непрерывный гул, пока лучи активны.
    S.beamHum(!!(L && L.beams && L.beams.length));
    // Телеграф Регистратора (DESIGN 5.2 SFX 12): восходящий «заряд» 1s —
    // audio-слой по diff состояния aim (контракт событий не расширяем).
    if (L && gs.mode === 'level' && !gs.paused) {
      const aimingNow = new Set();
      for (const e of L.enemies) {
        if (e.type === 'gunner' && !e.dead && e.discovered && e.behavior && e.behavior.state === 'aim') {
          aimingNow.add(e.uid);
        }
      }
      for (const u of aimingNow) if (!this._aimPrev.has(u)) S.gunnerTelegraph();
      this._aimPrev = aimingNow;
    } else if (this._aimPrev.size) {
      this._aimPrev = new Set();
    }
    // Тиканье: шаги игрока (интервал 200 мс, DESIGN 5.2) — только в бою.
    if (gs.mode === 'level' && !gs.paused && pl && pl.moving) {
      this._stepT -= dt;
      if (this._stepT <= 0) { this._stepT = 0.2; S.playerStep(); }
    } else {
      this._stepT = 0;
    }
    // Шаги Стартапа (интервал 120 мс) — рядом и активный Стартап.
    if (L && gs.mode === 'level' && !gs.paused && pl) {
      let near = null;
      for (const e of L.enemies) {
        if (e.type === 'stalker' && !e.dead && e.discovered) {
          const d = Math.hypot(pl.x - e.x, pl.y - e.y);
          if (d < 340 && (!near || d < Math.hypot(pl.x - near.x, pl.y - near.y))) near = e;
        }
      }
      if (near) {
        this._stalkerT -= dt;
        if (this._stalkerT <= 0) { this._stalkerT = 0.12; S.stalkerStep(); }
      } else {
        this._stalkerT = 0;
      }
    }
  }
};

// DEBUG-экспозиция (используется верификацией: ?debug=1 → __audio.getState()).
// Аппарат создаётся лениво (unlock), поэтому состояние читается функциями.
const makeDebugAudio = () => ({
  S,
  audio,
  music: () => audio.music,
  unlock: () => audio.unlock(),
  setVolume: (v) => audio.setVolume(v),
  toggleMute: () => audio.toggleMute(),
  getState: () => ({
    ctxState: audio.ctxState,
    unlocked: audio.unlocked,
    volume: audio.volume,
    muted: audio.muted,
    currentTrack: audio.music ? audio.music.current : null,
    scheduled: audio.music ? audio.music.scheduled : 0,
    hits: { ...S.hits }
  })
});

if (typeof window !== 'undefined') {
  window.__audio = makeDebugAudio();
}
Bus.on('app:ready', () => { if (typeof window !== 'undefined') window.__audio = makeDebugAudio(); });

// I4 (ARCH §4.14): пауза — музыка стоп (глушим хвост lookahead-нод).
Bus.on('ui:state-change', (ev = {}) => {
  if (ev.mode === 'level' && audio.music) audio.music.setPaused(!!ev.paused);
});

export function unlockAudio() { return audio.unlock(); }
export function isUnlocked() { return audio.unlocked; }
export { audio };
