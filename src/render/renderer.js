// Renderer (ARCH §4.14): 960×540 letterbox, dpr≤2, y-sort, 2.5D-пассы.
// Граница D-ARCH-01: симуляция не знает о Canvas (frame(game) — точка замены на Three.js).
import { VIEWPORT, TILE, PLAYER, PALETTE } from '../config.js';
import { drawShadow, drawPlayer, drawEnemy, drawBoss, corpseAlpha, drawBullet, drawCrosshair, drawExitMarker, roundRect } from './sprites.js';
import { drawEffectsPrepass, drawEffectsPostpass, drawAlerts } from './effects.js';
import * as hud from './hud.js';
import * as ui from './ui.js';

const WORLD_MODES = new Set(['level', 'death', 'victory', 'story']);

export function createRenderer(game) {
  const { ctx, dpr } = game;
  let staticCache = null; // { key, canvas }

  function buildStatic(L) {
    const key = `${L.id}:${L.grid.w}x${L.grid.h}:${L.grid.solid.join('')}`;
    if (staticCache && staticCache.key === key) return staticCache.canvas;
    const w = L.grid.w * TILE, h = L.grid.h * TILE;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    // пол: шахматка 16px (DESIGN 2.3)
    g.fillStyle = '#162833';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#182E3A';
    for (let ty = 0; ty < h; ty += 32) {
      for (let tx = 0; tx < w; tx += 32) {
        g.fillRect(tx, ty, 16, 16);
        g.fillRect(tx + 16, ty + 16, 16, 16);
      }
    }
    // стены
    const { solid } = L.grid;
    const isS = (x, y) => x >= 0 && y >= 0 && x < L.grid.w && y < L.grid.h && solid[y * L.grid.w + x];
    for (let ty = 0; ty < L.grid.h; ty++) {
      for (let tx = 0; tx < L.grid.w; tx++) {
        if (!solid[ty * L.grid.w + tx]) continue;
        const x = tx * TILE, y = ty * TILE;
        g.fillStyle = '#2E4A5E';
        g.fillRect(x, y, TILE, TILE);
        g.strokeStyle = '#4A6B7E';
        g.lineWidth = 1;
        g.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        // передняя грань — если южный сосед не стена (2.5D: высота 20px)
        if (!isS(tx, ty + 1)) {
          g.fillStyle = '#223A49';
          g.fillRect(x, y + TILE, TILE, 20);
          g.fillStyle = '#162833';
          g.fillRect(x, y + TILE + 17, TILE, 3);
          g.strokeStyle = '#3A586B';
          g.beginPath();
          g.moveTo(x, y + TILE);
          g.lineTo(x + TILE, y + TILE);
          g.stroke();
        }
      }
    }
    staticCache = { key, canvas: c };
    return c;
  }

  function drawCoverBox(g, c) {
    // covers уже в px (coversOf)
    const x = c.x, y = c.y, w = c.w, h = c.h;
    g.fillStyle = '#33505F';
    g.fillRect(x, y, w, h);
    g.strokeStyle = '#4A6B7E';
    g.lineWidth = 1.5;
    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    // хромовая кромка
    g.strokeStyle = '#6B8CA0';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x, y + h); g.lineTo(x + w, y + h);
    g.stroke();
    // передняя грань (высота = c.front)
    g.fillStyle = '#223A49';
    g.fillRect(x, y + h, w, c.front);
    g.fillStyle = '#162833';
    g.fillRect(x, y + h + c.front - 3, w, 3);
  }

  function frame(game) {
    const gs = game.state;
    const t = performance.now() / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PALETTE.petrole;
    ctx.fillRect(0, 0, VIEWPORT.w, VIEWPORT.h);
    game.uiButtons.length = 0;

    const L = gs.run?.level;
    if (L && WORLD_MODES.has(gs.mode)) {
      drawWorld(game, L, t);
      if (gs.mode === 'level') {
        hud.draw(game, t);
        if (gs.paused) ui.drawPause(game, t);
      }
    }
    if (gs.mode === 'menu') ui.drawMenu(game, t);
    else if (gs.mode === 'intro') ui.drawIntro(game, t);
    else if (gs.mode === 'story') ui.drawStory(game, t);
    else if (gs.mode === 'death') ui.drawDeath(game, t);
    if (gs.mode === 'victory') ui.drawVictory(game, t);
    if (gs.overlay === 'how-to' && (gs.mode === 'menu' || (gs.mode === 'level' && gs.paused))) ui.drawOverlay(game, t, 'how-to');
    if (gs.overlay === 'about' && gs.mode === 'menu') ui.drawOverlay(game, t, 'about');
    if (L && gs.mode === 'level' && !gs.paused) drawCrosshairScreen(game, t);
    ui.tickUI(game); // hover-tick SFX (DESIGN 5.2) — после регистрации uiButtons кадра
  }

  function drawWorld(game, L, t) {
    const gs = game.state;
    const pl = gs.run.player;
    const staticC = buildStatic(L);
    const cam = game.camera;
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    // 1) static layer
    ctx.drawImage(staticC, 0, 0);
    // 2) tint (world-space, только вьюпорт)
    if (L.tint) {
      ctx.save();
      ctx.globalAlpha = L.tint.amount;
      ctx.fillStyle = L.tint.color;
      ctx.fillRect(cam.x, cam.y, VIEWPORT.w, VIEWPORT.h);
      ctx.restore();
    }
    // 3) маркер выхода
    if (L.exit) drawExitMarker(ctx, L.exit, L.exitArmed, t);
    // 4) pre-pass: телеграф-линии по-над полом
    drawEffectsPrepass(ctx, L.effects);
    // 5) тени
    for (const c of L.covers) drawShadow(ctx, c.x + c.w / 2, c.y + c.h, c.w * 0.55, 0.3);
    for (const e of L.enemies) drawShadow(ctx, e.x, e.y, e.radius * 1.05, e.dead ? 0.35 * corpseAlpha(e.deadT) : 0.35);
    if (!pl || pl.hp > 0) drawShadow(ctx, pl.x, pl.y, PLAYER.radius, 0.35);
    // 6) y-sort
    const items = [];
    for (const c of L.covers) items.push({ y: c.y + c.h, fn: () => drawCoverBox(ctx, c) });
    for (const e of L.enemies) {
      if (!e.dead) items.push({ y: e.y, fn: () => drawEnemy(ctx, e, t) });
      else items.push({ y: e.y, fn: () => { ctx.save(); ctx.globalAlpha = corpseAlpha(e.deadT); drawEnemy(ctx, e, t); ctx.restore(); } });
    }
    items.push({ y: pl.y, fn: () => {
      if (pl.iframeT > 0 && Math.floor(pl.iframeT / 0.05) % 2 === 0) return; // мигание i-frames
      drawPlayer(ctx, pl, t);
    } });
    if (L.boss) {
      if (L.boss.dead) items.push({ y: L.boss.y, fn: () => { ctx.save(); ctx.globalAlpha = corpseAlpha(L.boss.deadT); drawBoss(ctx, L.boss, t); ctx.restore(); } });
      else items.push({ y: L.boss.y, fn: () => drawBoss(ctx, L.boss, t) });
    }
    if (L.sparks) for (const s of L.sparks) {
      items.push({ y: s.y, fn: () => {
        const p = s.t / s.life;
        ctx.save();
        ctx.globalAlpha = 1 - p;
        ctx.fillStyle = '#FFB84D';
        ctx.beginPath();
        ctx.arc(s.x, s.y - 24, 5 + Math.sin(s.t * 40) * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#E8622C';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      } });
    }
    for (const b of L.bullets) items.push({ y: b.y, fn: () => drawBullet(ctx, b) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.fn();
    game.stats.drawListSize = items.length;
    // 6.5) лучи P2 (DESIGN 3.3) — по-над всем, до эффектов
    if (L.beams && L.beams.length) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.lineCap = 'round';
      for (const bm of L.beams) {
        const ex = bm.x + Math.cos(bm.angle) * bm.len;
        const ey = bm.y + Math.sin(bm.angle) * bm.len;
        ctx.strokeStyle = '#E8622C';
        ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(bm.x, bm.y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = '#FFB84D';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(bm.x, bm.y); ctx.lineTo(ex, ey); ctx.stroke();
      }
      ctx.restore();
    }
    // 7) post: эффекты и «!»
    drawEffectsPostpass(ctx, L.effects);
    drawAlerts(ctx, L.enemies, t);
    ctx.restore();
  }

  // HUD/прицел — screen-space (после restore)
  function drawCrosshairScreen(game, t) {
    const gs = game.state;
    if (gs.mode !== 'level' || gs.paused) return;
    const L = gs.run.level;
    const pl = gs.run.player;
    const m = game.input.mouseLogical;
    if (!m) return;
    let over = false;
    for (const e of L.enemies) {
      if (e.dead) continue;
      if (Math.hypot(game.input.aim.x - e.x, game.input.aim.y - e.y) < e.radius + 8) { over = true; break; }
    }
    drawCrosshair(ctx, m.x, m.y, over);
    void pl; void t;
  }

  function finishFrame(game) {
    drawCrosshairScreen(game);
  }

  return { frame, buildStatic, finishFrame, _internals: { hud, ui } };
}
