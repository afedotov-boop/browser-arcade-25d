// Level (ARCH §4.12): validate, build, update.
import { TILE, PLAYER } from '../config.js';
import { buildGrid, coversOf, segmentCircle, segmentHitsSolid } from '../core/collision.js';
import { Bus } from '../core/events.js';
import { Enemy, ENEMY_BEHAVIORS } from '../entities/enemy.js';
import { Boss } from '../entities/boss.js';
import { updatePlayer, playerHit } from '../entities/player.js';
import { updateBullets } from '../entities/bullet.js';
import { Rng } from '../core/rng.js';

const MUSIC_IDS = new Set(['menu', 'l1', 'l2', 'l3', 'boss', 'death', 'victory']);
const GRACE_S = 5; // безопасная стартовая зона: 5s без активности врагов (DESIGN 3.4)
export { GRACE_S };

export function validateLevel(data) {
  const errors = [];
  if (data.version !== 1) errors.push('version must be 1');
  const { w, h } = data.size;
  if (w < 8 || h < 8 || w > 64 || h > 48) errors.push('size out of bounds 8×8..64×48');
  const grid = buildGrid(data);
  const solidAt = (px, py) => {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= w || ty >= h) return true;
    return !!grid.solid[ty * w + tx];
  };
  const inBounds = (p) => p.x >= 0 && p.y >= 0 && p.x <= w * TILE && p.y <= h * TILE;
  if (!inBounds(data.spawn) || solidAt(data.spawn.x, data.spawn.y)) errors.push('spawn outside or inside wall');
  if (data.clear?.type === 'kill_all' && !data.exit) errors.push('exit required for kill_all');
  for (const e of data.enemies || []) {
    if (!inBounds(e)) errors.push(`enemy ${e.type} outside bounds`);
    else if (solidAt(e.x, e.y)) errors.push(`enemy ${e.type} inside solid`);
    if (ENEMY_BEHAVIORS[e.type] == null) errors.push(`unknown enemy type ${e.type}`);
  }
  if ((data.enemies || []).length === 0 && data.id !== 'dev') errors.push('enemies empty (non-dev)');
  if (data.boss && data.clear?.type !== 'kill_boss') errors.push('boss only with kill_boss');
  for (const c of data.cover || []) {
    if (c.x < 0 || c.y < 0 || c.x + c.w > w || c.y + c.h > h) errors.push(`cover ${c.id} outside arena`);
  }
  if (!MUSIC_IDS.has(data.music)) errors.push(`invalid music id ${data.music}`);
  return { ok: errors.length === 0, errors };
}

export class Level {
  constructor(data, seed) {
    const v = validateLevel(data);
    if (!v.ok) {
      const msg = `[level:${data.id}] invalid: ${v.errors.join('; ')}`;
      console.error(msg);
      if (globalThis.__devError) __devError(msg);
      throw new Error(msg);
    }
    this.data = data;
    this.grid = buildGrid(data);
    this.covers = coversOf(data);
    this.rng = Rng(seed);
    this.uid = 1;
    this.static = null; // offscreen static layer (renderer)
  }
  buildEntities(run) {
    run.level.enemies = (this.data.enemies || []).map((def) => new Enemy(def, def.type, this, this.rng, this.uid++));
    run.level.sparks = [];
    run.level.beams = [];
    // босс «ВЕГА» (DESIGN 3.3): data.boss = {x, y} + clear kill_boss (validate)
    run.level.boss = this.data.boss ? new Boss(this.data.boss, this, this.rng, this.uid++) : null;
  }
  update(h, game) {
    const L = game.state.run.level;
    const pl = game.state.run.player;
    const grace = L.time < GRACE_S; // стартовая зона (DESIGN 3.4): враги и босс заморожены 5s
    updatePlayer(pl, this, game.input, h, game);
    for (const e of L.enemies) {
      if (e.dead || grace) continue;
      e.update(h, this, game);
    }
    // трупы: 1.5s, затем исчезают (DESIGN 3.2)
    for (const e of L.enemies) if (e.dead) e.deadT -= h;
    L.enemies = L.enemies.filter((e) => !e.dead || e.deadT > 0);
    // босс «ВЕГА» (DESIGN 3.3): перед пулями — его пули обновятся в этом же кадре
    if (L.boss && !L.boss.dead && !grace) L.boss.update(h, this, game);
    else if (L.boss && L.boss.dead) L.boss.deadT -= h;
    // P3: гомоинг-искры (DESIGN 3.3)
    if (L.sparks && L.sparks.length) updateSparks(L, pl, h);
    // P2: лучи — 1 хит на луч (защищает i-frames), свип по сегменту
    if (L.beams && L.beams.length && pl.hp > 0) {
      for (const bm of L.beams) {
        const ex = bm.x + Math.cos(bm.angle) * bm.len;
        const ey = bm.y + Math.sin(bm.angle) * bm.len;
        if (segmentCircle({ x: bm.x, y: bm.y }, { x: ex, y: ey }, { x: pl.x, y: pl.y }, PLAYER.radius)) {
          if (playerHit(pl, 1, L)) Bus.emit('boss:beam-hit', { uid: L.boss ? L.boss.uid : 0 });
        }
      }
    }
    updateBullets(this, h, game);
    // effects ttl
    for (const ef of L.effects) ef.t += h;
    L.effects = L.effects.filter((ef) => ef.t < ef.ttl);
    L.time += h;
    // clear-проверка (kill_all: все мёртвы + игрок в exit)
    if (!L.cleared && L.clear?.type === 'kill_all') {
      if (!L.exitArmed && L.killCount >= L.totalEnemies) {
        L.exitArmed = true;
        Bus.emit('level:exit-armed', { id: L.id });
      }
      if (L.forceClear || (L.exitArmed && Math.hypot(pl.x - L.exit.x, pl.y - L.exit.y) <= L.exit.r)) {
        L.cleared = true;
        Bus.emit('level:clear', { id: L.id });
      }
    }
    // clear-kill_boss (DESIGN 3.3): босс повержен → финал (без выхода)
    if (!L.cleared && L.clear?.type === 'kill_boss' && L.boss && L.boss.dead) {
      L.cleared = true;
      Bus.emit('level:clear', { id: L.id });
    }
  }
}

// «ВЕГА» P3: гомоинг-искры (DESIGN 3.3): 180px/s, доворот 30°/s к игроку,
// жизнь 3s, урон 1 при касании (защищают i-frames), исчезают о стену.
function updateSparks(L, pl, h) {
  for (let i = L.sparks.length - 1; i >= 0; i--) {
    const s = L.sparks[i];
    s.t += h;
    if (s.t >= s.life) { L.sparks.splice(i, 1); continue; }
    const desired = Math.atan2(pl.y - s.y, pl.x - s.x);
    let d = desired - s.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const maxTurn = s.turn * h;
    s.angle += Math.max(-maxTurn, Math.min(maxTurn, d));
    const prev = { x: s.x, y: s.y };
    s.x += Math.cos(s.angle) * s.speed * h;
    s.y += Math.sin(s.angle) * s.speed * h;
    if (segmentHitsSolid(prev, { x: s.x, y: s.y }, L.grid, L.covers)) {
      L.sparks.splice(i, 1);
      continue;
    }
    if (segmentCircle(prev, { x: s.x, y: s.y }, { x: pl.x, y: pl.y }, PLAYER.radius)) {
      if (playerHit(pl, 1, L)) Bus.emit('boss:spark-hit', { x: s.x, y: s.y });
      L.sparks.splice(i, 1);
    }
  }
}
