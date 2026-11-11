// Game loop (ARCH §2.1): fixed step 1/60, аккумулятор, ≤5 шагов/кадр, dt-кламп 0.25.
import { SIM_STEP, VIEWPORT } from '../config.js';
import { createGameState } from '../state/gamestate.js';
import { createFSM } from '../state/statemachine.js';
import { Input } from './input.js';
import { Camera } from './camera.js';
import { createRenderer } from '../render/renderer.js';
import { createDevTools } from '../debug/devtools.js';
import { Bus } from './events.js';
import { audio, unlockAudio } from '../audio/audio.js';
import '../audio/sfx.js'; // SFX-подписки
import { playerReloadKey } from '../entities/player.js';
import { volRects } from '../render/ui.js';

export function createGame(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = VIEWPORT.w * dpr;
  canvas.height = VIEWPORT.h * dpr;
  const ctx = canvas.getContext('2d');

  const input = new Input();
  input.attach(canvas);
  const camera = new Camera();
  const state = createGameState();
  const fsm = createFSM({ state });

  const game = {
    canvas, ctx, dpr, input, camera, state, fsm,
    frameCount: 0,
    stats: { fps: 60, frameMsEMA: 16.7, enemies: 0, bullets: 0, drawListSize: 0 },
    uiButtons: [],
    introSkip: false,
    storySkip: false
  };
  const renderer = createRenderer(game);
  createDevTools(game);

  // аудио: unlock по первому жесту (DESIGN 5)
  const onGesture = () => { unlockAudio(); };
  window.addEventListener('pointerdown', onGesture);
  window.addEventListener('keydown', onGesture);

  function clientToLogical(cx, cy) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return null;
    return {
      x: (cx - rect.left) * (VIEWPORT.w / rect.width),
      y: (cy - rect.top) * (VIEWPORT.h / rect.height)
    };
  }

  function handleEdges() {
    const ed = input.consumeEdges();
    const gs = state;
    // R — ручная перезарядка
    if (ed.pressed.has('reload')) {
      if (gs.mode === 'level' && !gs.paused && gs.run) playerReloadKey(gs.run.player);
    }
    // Esc — пауза (R13)
    if (ed.pressed.has('esc')) {
      if (gs.mode === 'level') {
        if (gs.overlay) { gs.overlay = null; return; }
        gs.paused = !gs.paused;
        Bus.emit('ui:state-change', { mode: gs.mode, paused: gs.paused });
      } else if (gs.overlay) {
        gs.overlay = null;
      }
    }
    // клик по UI
    if (ed.clicked) {
      // пауза: UI-кнопки (resume/how-to/to-menu + ряд громкости) — до раннего return
      if (gs.mode === 'level' && gs.paused) {
        const pp = clientToLogical(ed.clickPos.x, ed.clickPos.y);
        if (pp) {
          const b = game.uiButtons.find((b) => pp.x >= b.x && pp.x <= b.x + b.w && pp.y >= b.y && pp.y <= b.y + b.h);
          if (b && b.id !== 'vol-slider' && b.id !== 'vol-mute') {
            Bus.emit('ui:click', {});
            fsm.onUI(b.id);
          }
        }
        return;
      }
      if (gs.mode === 'level') return;
      const p = clientToLogical(ed.clickPos.x, ed.clickPos.y);
      if (!p) return;
      // ряд громкости (меню/пауза): mute-кнопка — переключение; слайдер — перетаскивание
      const vr = volRects(game);
      if (vr) {
        if (p.x >= vr.mute.x && p.x <= vr.mute.x + vr.mute.w && p.y >= vr.mute.y && p.y <= vr.mute.y + vr.mute.h) {
          audio.toggleMute();
          Bus.emit('ui:click', { id: 'vol-mute' });
          return;
        }
        const s = vr.slider;
        if (p.x >= s.x - 6 && p.x <= s.x + s.w + 6 && p.y >= s.y - 6 && p.y <= s.y + s.h + 6) {
          audioVolDrag = true;
          audio.setVolume((p.x - s.x) / s.w);
          Bus.emit('ui:click', { id: 'vol-slider' });
          return;
        }
      }
      const btn = game.uiButtons.find((b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
      if (btn) {
        Bus.emit('ui:click', {});
        fsm.onUI(btn.id);
      } else if (gs.mode === 'intro') {
        game.introSkip = true;
      } else if (gs.mode === 'story') {
        game.storySkip = true;
      }
    }
  }

  // учёт убийств: единый источник — run.level (I1)
  Bus.on('enemy:death', (p) => {
    const L = state.run?.level;
    if (!L) return;
    L.killCount++;
    L.effects.push({ kind: 'death', x: p.x, y: p.y, t: 0, ttl: 0.4 });
  });

  let audioVolDrag = false; // drag слайдера громкости (кнопка «ЗВУК», тик M2 «Звук»)

  let last = performance.now();
  let acc = 0;
  let rafId = 0;

  function tick(dt) {
    game.frameCount++;
    const t0 = performance.now();
    const gs = state;

    // мышь: screen → logical (UI) → world (aim)
    const rect = canvas.getBoundingClientRect();
    if (rect.width) {
      input.mouseLogical = {
        x: (input.mouseScreen.x - rect.left) * (VIEWPORT.w / rect.width),
        y: (input.mouseScreen.y - rect.top) * (VIEWPORT.h / rect.height)
      };
      input.aim = camera.screenToWorld(input.mouseLogical);
      // drag слайдера громкости: удерживаем ЛКМ и ведём по строке
      if (input.mouseDown && audioVolDrag) {
        const vr = volRects(game);
        if (vr) {
          audio.setVolume((input.mouseLogical.x - vr.slider.x) / vr.slider.w);
        } else {
          audioVolDrag = false;
        }
      }
    }

    handleEdges();

    if (gs.mode === 'intro') {
      if (game.introSkip) gs.introT = 1000;
      gs.introT += dt;
      game.introSkip = false;
    }
    if (gs.mode === 'story') {
      if (game.storySkip) gs.storyT = 1000;
      gs.storyT += dt;
      game.storySkip = false;
    }
    if (gs.mode === 'victory') gs.victoryT += dt;
    if (gs.mode === 'death') gs.deathT += dt; // ARCH §8.2 (закрытый список: deathT); DESIGN 5.3 — 3s-стинг

    if (gs.mode === 'level' && gs.run) {
      const sample = input.poll();
      input.move = sample.move;
      input.firing = sample.firing;
      if (!gs.paused) {
        acc += dt;
        let steps = 0;
        while (acc >= SIM_STEP && steps < 5) {
          Bus.beginStep();
          gs.run.level.update(SIM_STEP, game);
          fsm.onTick();
          Bus.flush();
          acc -= SIM_STEP;
          steps++;
          if (gs.mode !== 'level') break; // смерть/победа в шаге
        }
        if (steps === 5) acc = 0; // отставание — сброс (max 5 шагов/кадр)
      }
      camera.follow(gs.run.player, gs.run.level.worldW, gs.run.level.worldH);
    }

    // аудио: tick — выбор трека (DESIGN 5.1), эмбиент-тики (шаги), crossfade.
    // I4 (ARCH §4.14): на паузе не вызывается → новые ноты не планируются (музыка стоп).
    if (!(gs.mode === 'level' && gs.paused)) audio.tick(game, dt);

    // статистика
    game.stats.fps = Math.round(game.stats.fps * 0.9 + (dt > 0 ? 1 / dt : 60) * 0.1);
    const R = gs.run;
    const RL = R ? R.level : null;
    game.stats.enemies = RL ? RL.enemies.filter((e) => !e.dead).length : 0;
    game.stats.bullets = RL ? RL.bullets.length : 0;

    renderer.frame(game);

    const ms = performance.now() - t0;
    game.stats.frameMsEMA = game.stats.frameMsEMA * 0.9 + ms * 0.1;

    // курсор: в бою скрыт (прицел рисуется), в UI — стрелка
    canvas.style.cursor = gs.mode === 'level' && !gs.paused ? 'none' : 'default';
  }

  function frame() {
    const now = performance.now();
    const dt = Math.min(0.25, (now - last) / 1000); // dt-кламп
    last = now;
    try {
      tick(dt);
    } catch (err) {
      if (game.showError) game.showError(err);
      else console.error(err);
    }
    rafId = requestAnimationFrame(frame);
  }

  game.frameOnce = (dt) => { last = performance.now(); tick(dt || SIM_STEP); };

  return {
    game,
    renderer,
    start() {
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    },
    stop() { cancelAnimationFrame(rafId); }
  };
}
