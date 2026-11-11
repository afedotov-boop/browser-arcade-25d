// Player (ARCH §4.10): движение, прицел, огонь, перезарядка, hit.
import { PLAYER } from '../config.js';
import { moveCircle, segmentHitsSolid } from '../core/collision.js';
import { Bus } from '../core/events.js';

const DEG = Math.PI / 180;

// aim-прицел из mouseWorld (world-координаты курсора вычисляет loop).
export function updatePlayer(pl, level, input, h, game) {
  const L = game.state.run.level;
  // 1) move
  const mv = input.move;
  pl.moving = mv.x !== 0 || mv.y !== 0;
  if (pl.moving) {
    const r = moveCircle({ x: pl.x, y: pl.y }, PLAYER.radius, mv.x * PLAYER.speed * h, mv.y * PLAYER.speed * h, L.grid, L.covers);
    pl.x = r.x; pl.y = r.y;
  }
  // 2) aim (мышь → угол; facing по cos)
  const a = input.aim ?? { x: 0, y: 0 };
  pl.aimAngle = Math.atan2(a.y - pl.y, a.x - pl.x);
  pl.facing = Math.cos(pl.aimAngle) < 0 ? -1 : 1;
  // 3) fire
  pl.fireCd -= h;
  const firing = input.firing;
  if (firing && pl.ammo <= 0 && !pl.reloading) {
    pl.reloading = true; pl.reloadT = PLAYER.reloadTime;
    Bus.emit('player:reload', { auto: true });
  }
  if (firing && !pl.reloading && pl.ammo > 0 && pl.fireCd <= 0) {
    const spread = (level.rng.next() * 2 - 1) * PLAYER.spreadDeg * DEG;
    const ang = pl.aimAngle + spread;
    L.bullets.push({
      x: pl.x + Math.cos(pl.aimAngle) * (PLAYER.radius + 8),
      y: pl.y + Math.sin(pl.aimAngle) * (PLAYER.radius + 8),
      vx: Math.cos(ang) * PLAYER.bulletSpeed,
      vy: Math.sin(ang) * PLAYER.bulletSpeed,
      dmg: PLAYER.bulletDmg, life: PLAYER.bulletLife, owner: 'player'
    });
    L.effects.push({ kind: 'muzzle', x: pl.x, y: pl.y, angle: ang, t: 0, ttl: PLAYER.flash });
    pl.ammo--;
    pl.fireCd = 1 / PLAYER.fireRate;
    Bus.emit('player:shoot', { ammo: pl.ammo });
    if (pl.ammo <= 0) {
      pl.reloading = true; pl.reloadT = PLAYER.reloadTime;
      Bus.emit('player:reload', { auto: true });
    }
  }
  // 4) reload
  if (pl.reloading) {
    pl.reloadT -= h;
    if (pl.reloadT <= 0) {
      pl.reloading = false; pl.reloadT = 0; pl.ammo = PLAYER.ammo;
      Bus.emit('player:reload-done', {});
    }
  }
  // 5) таймеры
  pl.iframeT = Math.max(0, pl.iframeT - h);
  pl.hitFlashT = Math.max(0, pl.hitFlashT - h);
}

// R — ручная перезарядка (edge).
export function playerReloadKey(pl) {
  if (pl.reloading || pl.ammo >= PLAYER.ammo) return;
  pl.reloading = true;
  pl.reloadT = PLAYER.reloadTime;
  Bus.emit('player:reload', { auto: false });
}

// i-frames: iframeT>0 → не проходит; 3-е попадание = смерть.
export function playerHit(pl, dmg, level) {
  if (pl.iframeT > 0) return false;
  pl.hp -= dmg;
  pl.iframeT = PLAYER.iframe;
  pl.hitFlashT = 0.2;
  Bus.emit('player:hit', { hp: pl.hp });
  if (pl.hp <= 0) Bus.emit('player:death', {});
  return true;
}
