// FSM (ARCH §4.9, §7): режимы MENU/INTRO/LEVEL/STORY/DEATH/VICTORY; paused — флаг над LEVEL.
import { newRun, startLevel, toMenu } from './gamestate.js';
import { Bus } from '../core/events.js';
import { RUN_SEQUENCE } from '../levels/data/registry.js';

const Modes = { MENU: 'menu', INTRO: 'intro', LEVEL: 'level', STORY: 'story', DEATH: 'death', VICTORY: 'victory' };

export function createFSM(game) {
  const gs = () => game.state;
  function go(mode) {
    const g = gs();
    g.mode = mode;
    Bus.emit('ui:state-change', { mode });
    // R12 «чистота состояния» / DESIGN 4.1: оверлей (управление/о игре) живёт только в MENU
    // (там и задуман, включая паузу, где mode остаётся 'level'). Найденно браузерным прогоном
    // t_4d78a23f: «управление», открытое в меню, оставалось поверх интро после «НОВАЯ СМЕНА» —
    // кнопки меню регистрируются раньше «назад» и перехватывали клик в зоне пересечения.
    if (mode !== Modes.MENU) g.overlay = null;
    if (mode === Modes.INTRO) g.introT = 0;
    if (mode === Modes.STORY) g.storyT = 0;
    if (mode === Modes.DEATH) g.deathT = 0;
    if (mode === Modes.VICTORY) g.victoryT = 0;
  }

  const fsm = {
    onUI(action) {
      const g = gs();
      switch (action) {
        case 'new-run':   // MENU/VICTORY → INTRO
          newRun(g);
          go(Modes.INTRO);
          break;
        case 'continue':  // MENU → LEVEL(run.levelIndex) — полная перестройка (I2)
          if (g.run) { startLevel(g, g.run.levelIndex); go(Modes.LEVEL); }
          break;
        case 'start':     // INTRO → LEVEL(0) (первый жест → audio.unlock снаружи)
          startLevel(g, 0);
          go(Modes.LEVEL);
          break;
        case 'next':      // STORY → LEVEL(i+1) (межура, DESIGN 4.1)
          if (g.run) { startLevel(g, g.run.levelIndex + 1); go(Modes.LEVEL); }
          break;
        case 'restart-level': // DEATH → LEVEL(N), полная перестройка (R12)
          if (g.run) { startLevel(g, g.run.levelIndex); go(Modes.LEVEL); }
          break;
        case 'to-menu':
          toMenu(g);
          go(Modes.MENU);
          break;
        case 'pause':
          if (g.mode === Modes.LEVEL) g.paused = true;
          break;
        case 'resume':
          g.paused = false;
          break;
        case 'how-to': g.overlay = 'how-to'; break;
        case 'about': g.overlay = 'about'; break;
        case 'back': g.overlay = null; break;
      }
    },
    onDeath() {
      const g = gs();
      if (g.mode === Modes.LEVEL) go(Modes.DEATH);
    },
    onLevelClear() {
      const g = gs();
      if (g.mode !== Modes.LEVEL) return;
      if (g.run) g.run.completed[g.run.levelIndex] = true;
      // DESIGN 4.1: L1/L2 → STORY (межура), L3 (nextIdx >= 3) → VICTORY (финал 1.4)
      const L = g.run?.level;
      const nextIdx = g.run?.levelIndex + 1;
      if (!L || L.isDev || nextIdx >= RUN_SEQUENCE.length) go(Modes.VICTORY);
      else go(Modes.STORY);
    },
    onTick() { /* смерть/clear приходят по Bus; здесь — страховка: hp≤0 вне Bus */
      const g = gs();
      if (g.mode === Modes.LEVEL && !g.paused && g.run && g.run.player.hp <= 0) this.onDeath();
    }
  };

  Bus.on('player:death', () => fsm.onDeath());
  Bus.on('level:clear', () => fsm.onLevelClear());
  return fsm;
}
