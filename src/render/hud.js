// HUD (DESIGN 4.2): патроны (8 ячеек), название уровня, перезарядка, виньетка, выход-подсказка.
import { VIEWPORT, PLAYER, BOSS } from '../config.js';
import { T } from '../levels/texts.js';
import { roundRect } from './sprites.js';

export function draw(game, t) {
  const ctx = game.ctx;
  const gs = game.state;
  const pl = gs.run.player;
  const L = gs.run.level;
  // патроны — 8 ячеек
  const x0 = 16, y0 = 16, cw = 16, ch = 10, gap = 4;
  ctx.save();
  ctx.font = '11px "Courier New", monospace';
  ctx.textAlign = 'left';
  for (let i = 0; i < PLAYER.ammo; i++) {
    const x = x0 + i * (cw + gap);
    roundRect(ctx, x, y0, cw, ch, 3);
    ctx.fillStyle = i < pl.ammo ? '#E8622C' : '#2A4453';
    ctx.fill();
  }
  if (pl.reloading) {
    const p = 1 - pl.reloadT / PLAYER.reloadTime;
    ctx.fillStyle = '#2A4453';
    ctx.fillRect(x0, y0 + 16, 128, 6);
    ctx.fillStyle = '#37B5B0';
    ctx.fillRect(x0, y0 + 16, 128 * p, 6);
    ctx.fillStyle = '#7FE0DB';
    ctx.fillText(T.reload, x0 + 134, y0 + 23);
  }
  // название уровня — центр
  ctx.textAlign = 'center';
  ctx.font = '13px "Courier New", monospace';
  ctx.fillStyle = 'rgba(242,232,207,0.9)';
  ctx.fillText(L.name, VIEWPORT.w / 2, 28);
  // подсказка: выход открыт
  if (L.exitArmed && !L.cleared) {
  ctx.globalAlpha = 0.6 + Math.sin(t * 5) * 0.3;
  ctx.fillStyle = '#7FE0DB';
  ctx.font = '12px "Courier New", monospace';
  ctx.fillText(T.exitArmed, VIEWPORT.w / 2, VIEWPORT.h - 18);
  }
  ctx.globalAlpha = 1;
  // полоса босса (DESIGN 4.2): оранжевая заливка + разделители фаз
  if (L.boss && !L.boss.dead) drawBossBar(ctx, L.boss, t);
  ctx.restore();
  // красная виньетка 200ms после удара
  if (pl.hitFlashT > 0) drawVignette(game, (pl.hitFlashT / 0.2) * 0.35);
  else if (pl.hp === 1) drawVignette(game, 0.12 + Math.sin(t * 6) * 0.05);
}

function drawVignette(game, a) {
  const ctx = game.ctx;
  const w = VIEWPORT.w, h = VIEWPORT.h;
  const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.75);
  grad.addColorStop(0, 'rgba(232,60,60,0)');
  grad.addColorStop(1, `rgba(232,60,60,${a})`);
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// полоса босса «ВЕГА» (DESIGN 4.2): 360px, оранжевая заливка, разделители фаз (20/10)
function drawBossBar(ctx, B, t) {
  const w = 360, h = 14, x = (VIEWPORT.w - w) / 2, y = 10;
  ctx.save();
  ctx.fillStyle = 'rgba(20,32,43,0.85)';
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  const p = Math.max(0, B.hp) / B.maxHp;
  ctx.fillStyle = B.coreActive ? '#FFB84D' : '#E8622C';
  ctx.globalAlpha = B.coreActive ? 0.75 + 0.25 * Math.sin(t * 10) : 1;
  ctx.fillRect(x, y, w * p, h);
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = '#F2E8CF';
  for (const ph of BOSS.phaseHp) {
    ctx.fillRect(x + w * (1 - ph / BOSS.hp), y, 2, h);
  }
  ctx.strokeStyle = '#F2E8CF';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.globalAlpha = 1;
  ctx.font = '10px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#F2E8CF';
  ctx.fillText('ВЕГА', x + w / 2, y + h + 12);
  ctx.restore();
}
