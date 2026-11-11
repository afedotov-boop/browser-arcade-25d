// Bullets (ARCH §4.10): один класс, owner = 'player' | uid врага.
import { PLAYER } from '../config.js';
import { segmentHitsSolid, segmentCircle } from '../core/collision.js';
import { Bus } from '../core/events.js';
import { playerHit } from './player.js';

export function updateBullets(level, h, game) {
  const L = game.state.run.level;
  const pl = game.state.run.player;
  const keep = [];
  for (const b of L.bullets) {
    const prev = { x: b.x, y: b.y };
    b.x += b.vx * h;
    b.y += b.vy * h;
    b.life -= h;
    if (b.life <= 0) continue;
    // стена / cover
    if (segmentHitsSolid(prev, { x: b.x, y: b.y }, L.grid, L.covers)) {
      L.effects.push({ kind: 'spark', x: b.x, y: b.y, angle: Math.atan2(b.vy, b.vx), t: 0, ttl: 0.15 });
      if (b.owner === 'player') Bus.emit('bullet:hit-wall', {});
      continue;
    }
    // противная сторона
    let hit = false;
    if (b.owner === 'player') {
      // «ВЕГА» (DESIGN 3.3): босс — отдельная цель; ×2 — только в окно уязвимости
      // ядра (coreActive, D-BO-05), обычные враги получают 1:1
      const B = L.boss;
      if (B && !B.dead && segmentCircle(prev, { x: b.x, y: b.y }, { x: B.x, y: B.y }, B.radius)) {
        B.onHit(b.dmg * (B.coreActive ? 2 : 1));
        hit = true;
      } else {
        for (const e of L.enemies) {
          if (e.dead) continue;
          if (segmentCircle(prev, { x: b.x, y: b.y }, { x: e.x, y: e.y }, e.radius)) {
            e.onHit(b.dmg);
            hit = true;
            break;
          }
        }
      }
    } else {
      if (segmentCircle(prev, { x: b.x, y: b.y }, { x: pl.x, y: pl.y }, PLAYER.radius)) {
        playerHit(pl, b.dmg, level);
        hit = true;
      }
    }
    if (hit) {
      L.effects.push({ kind: 'spark', x: b.x, y: b.y, angle: Math.atan2(b.vy, b.vx), t: 0, ttl: 0.12, pink: b.owner !== 'player' });
      continue;
    }
    keep.push(b);
  }
  L.bullets = keep;
}
