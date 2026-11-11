// UI-экраны (DESIGN 1.4/4.1): меню, интро, межуры (typewriter), смерть, победа, пауза, оверлеи.
// Кнопки регистрируются в game.uiButtons — хит-тест клика в loop.js.
import { VIEWPORT } from '../config.js';
import { T } from '../levels/texts.js';
import { RUN_SEQUENCE, levelMeta } from '../levels/data/registry.js';
import { isUnlocked, audio } from '../audio/audio.js';
import { Bus } from '../core/events.js';
import { roundRect } from './sprites.js';

const BW = 320, BH = 44, BX = VIEWPORT.w / 2 - BW / 2;
const INTRO_CPS = 30;

function button(game, id, label, y, primary) {
  // R12/P04 (t_4d78a23f): при открытом оверлее «Управление/О игре» активна ТОЛЬКО его
  // кнопка «назад» — иначе кнопки экрана позади регистрируются раньше и перехватывают
  // клик в зоне пересечения (меню «Управление» 412..456 пересекает «назад» 380..424).
  if (game.state.overlay && id !== 'back') return;
  game.uiButtons.push({ id, label, x: BX, y, w: BW, h: BH, primary });
}

function isHot(game, id) {
  const m = game.input.mouseLogical;
  if (!m) return false;
  const b = game.uiButtons.find((x) => x.id === id);
  return !!b && m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h;
}

function drawButton(game, id, label, y, primary, dim) {
  const ctx = game.ctx;
  const hot = isHot(game, id);
  ctx.save();
  const fill = dim ? '#22303B' : (primary ? '#E8622C' : '#2A4453');
  const stroke = hot ? (primary ? '#FFD24D' : '#7FE0DB') : (primary ? '#FF9EC4' : '#4A6B7E');
  roundRect(ctx, BX, y, BW, BH, 6);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = hot ? 2.5 : 1.5;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.fillStyle = dim ? 'rgba(242,232,207,0.4)' : (primary ? '#14202B' : '#F2E8CF');
  ctx.font = `${primary ? 'bold ' : ''}16px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, VIEWPORT.w / 2, y + BH / 2 + 1);
  ctx.restore();
}

// ── Слайдер громкости + mute (карточка M2 «Звук»: регулировка громкости/mute) ──
// Ряд рисуется на экране меню (y 240..264) и на паузе (y 440..464); хит-области
// регистрируются в uiButtons (drag/клик обрабатывает loop.js), hover — ui.tickUI.
export function volRects(game) {
  const gs = game.state;
  if (gs.overlay) return null;
  let y = null;
  if (gs.mode === 'menu') y = 240;
  else if (gs.mode === 'level' && gs.paused) y = 440;
  else return null;
  return {
    y,
    labelX: 310,
    slider: { x: 350, y: y - 12, w: 240, h: 24 },
    mute: { x: 610, y: y - 12, w: 80, h: 24 }
  };
}

function volButtons(game, vr) {
  const off = audio.muted || audio.volume <= 0;
  game.uiButtons.push({ id: 'vol-slider', label: '', x: vr.slider.x, y: vr.slider.y, w: vr.slider.w, h: vr.slider.h, primary: false });
  game.uiButtons.push({ id: 'vol-mute', label: off ? T.volOff : T.volOn, x: vr.mute.x, y: vr.mute.y, w: vr.mute.w, h: vr.mute.h, primary: false });
}

function drawVolumeRow(game, vr) {
  const ctx = game.ctx;
  const m = game.input.mouseLogical;
  const off = audio.muted || audio.volume <= 0;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = off ? 'rgba(242,232,207,0.4)' : '#C9A227';
  ctx.font = '13px "Courier New", monospace';
  ctx.fillText(T.volLabel, vr.labelX, vr.y + 1);
  const s = vr.slider;
  const hot = !!(m && m.x >= s.x && m.x <= s.x + s.w && m.y >= s.y && m.y <= s.y + s.h);
  roundRect(ctx, s.x, s.y, s.w, s.h, 5);
  ctx.fillStyle = '#101B24';
  ctx.fill();
  ctx.lineWidth = hot ? 2 : 1;
  ctx.strokeStyle = hot ? '#FFD24D' : '#4A6B7E';
  ctx.stroke();
  const pct = audio.muted ? 0 : audio.volume;
  const fw = s.w * pct;
  if (fw > 2) {
    roundRect(ctx, s.x + 1, s.y + 4, Math.max(2, fw - 2), s.h - 8, 3);
    ctx.fillStyle = off ? 'rgba(242,232,207,0.3)' : '#7FE0DB';
    ctx.fill();
  }
  const mu = vr.mute;
  const hotMu = !!(m && m.x >= mu.x && m.x <= mu.x + mu.w && m.y >= mu.y && m.y <= mu.y + mu.h);
  roundRect(ctx, mu.x, mu.y, mu.w, mu.h, 5);
  ctx.fillStyle = hotMu ? '#2A4453' : '#22303B';
  ctx.fill();
  ctx.lineWidth = hotMu ? 2 : 1;
  ctx.strokeStyle = hotMu ? '#7FE0DB' : '#4A6B7E';
  ctx.stroke();
  ctx.fillStyle = hotMu ? '#FFD24D' : 'rgba(242,232,207,0.7)';
  ctx.font = '11px "Courier New", monospace';
  ctx.fillText(off ? T.volOff : T.volOn, mu.x + mu.w / 2, mu.y + mu.h / 2 + 1);
  ctx.restore();
}

// hover-tick SFX (DESIGN 5.2 «клик по UI»: щелчок на навигацию — hover-обратная
// связь при перемещении на новую кнопку), не чаще 90 мс; звук только после unlock.
let _hoverId = null;
let _hoverAt = 0;
export function tickUI(game) {
  if (!isUnlocked()) return;
  const hot = game.uiButtons.find((b) =>
    b.id !== 'vol-slider' && b.id !== 'vol-mute' && isHot(game, b.id));
  if (!hot) {
    _hoverId = null;
    return;
  }
  if (hot.id !== _hoverId) {
    _hoverId = hot.id;
    if (!_hoverAt || performance.now() - _hoverAt > 90) {
      _hoverAt = performance.now();
      Bus.emit('ui:hover', { id: hot.id });
    }
  }
}

function screenBackground(ctx) {
  ctx.fillStyle = '#101B24';
  ctx.fillRect(0, 0, VIEWPORT.w, VIEWPORT.h);
  ctx.save();
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < VIEWPORT.w; i += 32) {
    for (let j = 0; j < 3; j++) {
      if ((i / 32 + j) % 2 === 0) {
        ctx.fillStyle = '#182E3A';
        ctx.fillRect(i, VIEWPORT.h - 64 + j * 32, 32, 32);
      }
    }
  }
  ctx.restore();
}

function title(ctx, t) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = '#E8622C';
  ctx.shadowBlur = 28;
  ctx.fillStyle = '#F2E8CF';
  ctx.font = 'bold 54px "Courier New", monospace';
  ctx.fillText(T.gameTitle, VIEWPORT.w / 2, 150);
  ctx.shadowBlur = 0;
  ctx.font = '14px "Courier New", monospace';
  ctx.fillStyle = '#C9A227';
  ctx.fillText(T.company, VIEWPORT.w / 2, 182);
  ctx.fillStyle = 'rgba(242,232,207,0.55)';
  ctx.font = '12px "Courier New", monospace';
  ctx.fillText(T.companySlogan, VIEWPORT.w / 2, 202);
  const cx = VIEWPORT.w / 2, cy = 92;
  ctx.strokeStyle = '#37B5B0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.8 + i * (Math.PI / 3));
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 9, 0, 0, Math.PI * 2);
    ctx.globalAlpha = 0.8;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

export function drawMenu(game, t) {
  const ctx = game.ctx;
  screenBackground(ctx);
  title(ctx, t);
  const hasRun = !!game.state.run;
  button(game, 'new-run', T.menuNew, 300, true);
  drawButton(game, 'new-run', T.menuNew, 300, true, false);
  if (hasRun) {
    button(game, 'continue', T.menuContinue, 356, false);
    drawButton(game, 'continue', T.menuContinue, 356, false, false);
  }
  button(game, 'how-to', T.menuHowTo, 412, false);
  drawButton(game, 'how-to', T.menuHowTo, 412, false, false);
  button(game, 'about', T.menuAbout, 468, false);
  drawButton(game, 'about', T.menuAbout, 468, false, false);
  {
    const vr = volRects(game);
    if (vr) { volButtons(game, vr); drawVolumeRow(game, vr); }
  }
  if (!isUnlocked()) {
    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(t * 3) * 0.3;
    ctx.fillStyle = '#7FE0DB';
    ctx.font = '12px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(T.soundHint, VIEWPORT.w / 2, 522);
    ctx.restore();
  }
}

function introFullText() { return T.intro.join('\n\n'); }

// Межуры (DESIGN 4.1): текст 1.4 + «СМЕНА N/3 · НАЗВАНИЕ» следующего уровня, «ДАЛЬШЕ».
// T.story[i] — межура после уровня с индексом i (0 → после L1, 1 → после L2).
export function drawStory(game, t) {
  const ctx = game.ctx;
  screenBackground(ctx);
  const gs = game.state;
  const idx = gs.run ? gs.run.levelIndex : 0;
  const s = T.story[idx] || T.story[0];
  const nextId = RUN_SEQUENCE[idx + 1];
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#C9A227';
  ctx.font = 'bold 20px "Courier New", monospace';
  ctx.fillText(nextId ? levelMeta(nextId).name : '', VIEWPORT.w / 2, 60);
  const full = s.join('\n\n');
  const n = Math.min(full.length, Math.floor(gs.storyT * INTRO_CPS));
  const shown = full.slice(0, n);
  ctx.fillStyle = '#F2E8CF';
  ctx.font = '15px "Courier New", monospace';
  let y = 110;
  for (const para of shown.split('\n\n')) {
    const lines = para.split('\n');
    for (const ln of lines) {
      for (let i = 0; i < ln.length; i += 64) {
        ctx.fillText(ln.slice(i, i + 64), VIEWPORT.w / 2, y);
        y += 24;
      }
    }
    y += 12;
  }
  const done = n >= full.length;
  button(game, 'next', T.storyNext, 480, true);
  drawButton(game, 'next', T.storyNext, 480, true, !done);
  if (!done) {
    ctx.globalAlpha = 0.4;
    ctx.font = '11px "Courier New", monospace';
    ctx.fillText('щёлкни, чтобы пропустить', VIEWPORT.w / 2, 528);
  }
  ctx.restore();
}

export function drawIntro(game, t) {
  const ctx = game.ctx;
  screenBackground(ctx);
  const gs = game.state;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#C9A227';
  ctx.font = '16px "Courier New", monospace';
  ctx.fillText('НОВГОРСК, 1997', VIEWPORT.w / 2, 60);
  const full = introFullText();
  const n = Math.min(full.length, Math.floor(gs.introT * INTRO_CPS));
  const shown = full.slice(0, n);
  const lines = shown.split('\n');
  ctx.fillStyle = '#F2E8CF';
  ctx.font = '15px "Courier New", monospace';
  let y = 110;
  for (const ln of lines) {
    for (let i = 0; i < ln.length; i += 70) {
      ctx.fillText(ln.slice(i, i + 70), VIEWPORT.w / 2, y);
      y += 24;
    }
    y += 12;
  }
  const done = n >= full.length;
  button(game, 'start', T.introStart, 480, true);
  drawButton(game, 'start', T.introStart, 480, true, !done);
  if (!done) {
    ctx.globalAlpha = 0.4;
    ctx.font = '11px "Courier New", monospace';
    ctx.fillText('щёлкни, чтобы пропустить', VIEWPORT.w / 2, 528);
  }
  ctx.restore();
}

export function drawDeath(game, t) {
  const ctx = game.ctx;
  ctx.save();
  ctx.fillStyle = 'rgba(20,10,14,0.78)';
  ctx.fillRect(0, 0, VIEWPORT.w, VIEWPORT.h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = '#FF4D88';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#FF4D88';
  ctx.font = 'bold 44px "Courier New", monospace';
  ctx.fillText(T.deathTitle, VIEWPORT.w / 2, 180);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(242,232,207,0.75)';
  ctx.font = '14px "Courier New", monospace';
  ctx.fillText(T.deathSub, VIEWPORT.w / 2, 216);
  const label = game.state.run?.level?.name || '';
  button(game, 'restart-level', T.deathRestart + label, 300, true);
  drawButton(game, 'restart-level', T.deathRestart + label, 300, true, false);
  button(game, 'to-menu', T.deathToMenu, 356, false);
  drawButton(game, 'to-menu', T.deathToMenu, 356, false, false);
  ctx.restore();
}

export function drawVictory(game, t) {
  const ctx = game.ctx;
  ctx.save();
  ctx.fillStyle = 'rgba(10,20,26,0.82)';
  ctx.fillRect(0, 0, VIEWPORT.w, VIEWPORT.h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = '#37B5B0';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#7FE0DB';
  ctx.font = 'bold 44px "Courier New", monospace';
  ctx.fillText(T.victoryTitle, VIEWPORT.w / 2, 120);
  ctx.shadowBlur = 0;
  // финал 1.4 — типewriter (DESIGN 4.1)
  const full = T.victoryFinale.join('\n\n');
  const n = Math.min(full.length, Math.floor(game.state.victoryT * INTRO_CPS));
  const shown = full.slice(0, n);
  ctx.fillStyle = 'rgba(242,232,207,0.85)';
  ctx.font = '15px "Courier New", monospace';
  let y = 170;
  for (const para of shown.split('\n\n')) {
    const lines = para.split('\n');
    for (const ln of lines) {
      for (let i = 0; i < ln.length; i += 64) {
        ctx.fillText(ln.slice(i, i + 64), VIEWPORT.w / 2, y);
        y += 24;
      }
    }
    y += 12;
  }
  const done = n >= full.length;
  button(game, 'new-run', T.victoryAgain, 440, true);
  drawButton(game, 'new-run', T.victoryAgain, 440, true, !done);
  button(game, 'to-menu', T.victoryToMenu, 496, false);
  drawButton(game, 'to-menu', T.victoryToMenu, 496, false, false);
  ctx.restore();
}

export function drawPause(game, t) {
  const ctx = game.ctx;
  ctx.save();
  ctx.fillStyle = 'rgba(10,16,22,0.55)';
  ctx.fillRect(0, 0, VIEWPORT.w, VIEWPORT.h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#F2E8CF';
  ctx.font = 'bold 36px "Courier New", monospace';
  ctx.fillText(T.pauseTitle, VIEWPORT.w / 2, 200);
  button(game, 'resume', T.pauseResume, 260, true);
  drawButton(game, 'resume', T.pauseResume, 260, true, false);
  button(game, 'how-to', T.pauseHowTo, 316, false);
  drawButton(game, 'how-to', T.pauseHowTo, 316, false, false);
  button(game, 'to-menu', T.pauseToMenu, 372, false);
  drawButton(game, 'to-menu', T.pauseToMenu, 372, false, false);
  {
    const vr = volRects(game);
    if (vr) { volButtons(game, vr); drawVolumeRow(game, vr); }
  }
  ctx.restore();
}

export function drawOverlay(game, t, which) {
  const ctx = game.ctx;
  ctx.save();
  ctx.fillStyle = 'rgba(10,16,22,0.85)';
  roundRect(ctx, VIEWPORT.w / 2 - 240, 90, 480, 360, 10);
  ctx.fill();
  ctx.strokeStyle = '#4A6B7E';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#C9A227';
  ctx.font = 'bold 22px "Courier New", monospace';
  ctx.fillText(which === 'how-to' ? T.howToTitle : T.aboutTitle, VIEWPORT.w / 2, 130);
  ctx.fillStyle = '#F2E8CF';
  ctx.font = '15px "Courier New", monospace';
  let y = 170;
  if (which === 'how-to') {
    for (const line of T.howTo) { ctx.fillText(line, VIEWPORT.w / 2, y); y += 28; }
  } else {
    // DESIGN 4.1: «О ИГРЕ» — ровно 1 строка
    ctx.fillText(T.about, VIEWPORT.w / 2, y);
  }
  button(game, 'back', T.back, 380, false);
  drawButton(game, 'back', T.back, 380, false, false);
  ctx.restore();
}
