// Смотритель (DESIGN 3.2, ARCH §4.11): патруль/пост → обнаружение → замер+прицел 0.5s →
// залп 3 (разброс 12°, gap 0.15s, 720px/s) при 150–300px и los; <40px — дубинка (windup 0.6s, hitbox 40px). Не преследует.
import { ENEMIES } from '../../config.js';
import { moveCircle, lineOfSight } from '../../core/collision.js';
import { playerHit } from '../player.js';

const DEG = Math.PI / 180;
const CFG = ENEMIES.sentry;

function angleTo(e, pl) { return Math.atan2(pl.y - e.y, pl.x - e.x); }

export const sentryBehavior = {
  create(e, def) {
    const b = {
      state: 'idle',
      t: 0,
      patrol: def.patrol || [ { x: e.x, y: e.y } ],
      wp: 0,
      volleyLeft: 0,
      aimAngle: 0,
      facingAngle: 0
    };
    b.update = (en, game, h) => sentryBehavior.update(en, game, h);
    return b;
  },
  update(e, game, h) {
    const L = game.state.run.level;
    const pl = game.state.run.player;
    const b = e.behavior;
    const dist = Math.hypot(pl.x - e.x, pl.y - e.y);
    const los = lineOfSight({ x: e.x, y: e.y }, { x: pl.x, y: pl.y }, L.grid, L.covers);

    if (!e.discovered) {
      // патруль / пост
      const pts = b.patrol;
      const target = pts[b.wp % pts.length];
      const dx = target.x - e.x, dy = target.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d > 4) {
        e.facingAngle = Math.atan2(dy, dx);
        e.facing = Math.cos(e.facingAngle) < 0 ? -1 : 1;
        const r = moveCircle({ x: e.x, y: e.y }, e.radius, (dx / d) * CFG.speed * h, (dy / d) * CFG.speed * h, L.grid, L.covers);
        e.x = r.x; e.y = r.y;
        e.walkT += h;
        if (Math.hypot(target.x - e.x, target.y - e.y) < 6) b.wp = (b.wp + 1) % pts.length;
      } else if (pts.length > 1) {
        // достигли точки (случай spawn == pts[0] включительно) — следующая
        b.wp = (b.wp + 1) % pts.length;
      }
      return;
    }

    // === обнаружен: замер + телеграф 0.5s → залп ===
    switch (b.state) {
      case 'idle': {
        if (dist < CFG.meleeRange && los) { b.state = 'melee_windup'; b.t = CFG.meleeWindup; e.facingAngle = angleTo(e, pl); e.facing = Math.cos(e.facingAngle) < 0 ? -1 : 1; }
        else if (dist <= CFG.rangeMax && los) { b.state = 'aim'; b.t = CFG.aimTelegraph; }
        else if (dist > CFG.rangeMax * 1.6) { /* замер: ждёт (не преследует) */ }
        break;
      }
      case 'aim': {
        b.aimAngle = angleTo(e, pl);
        e.facingAngle = b.aimAngle;
        e.facing = Math.cos(b.aimAngle) < 0 ? -1 : 1;
        b.t -= h;
        L.effects.push({ kind: 'sentry-aim', x: e.x, y: e.y, angle: b.aimAngle, dist, t: 0, ttl: 0.05 });
        if (b.t <= 0) {
          if (dist < CFG.meleeRange) { b.state = 'melee_windup'; b.t = CFG.meleeWindup; }
          else { b.state = 'volley'; b.t = 0; b.volleyLeft = CFG.volley; e.shoot(game, b.aimAngle, CFG.bulletSpeed, 1); }
        }
        break;
      }
      case 'volley': {
        b.t -= h;
        if (b.volleyLeft > 1 && b.t <= 0) {
          b.t = CFG.gap;
          b.volleyLeft--;
          e.shoot(game, b.aimAngle + (L.rng.next() * 2 - 1) * (CFG.spreadDeg / 2) * DEG, CFG.bulletSpeed, 1);
        }
        if (b.t <= 0 && b.volleyLeft <= 1) { b.state = 'cool'; b.t = 0.6; }
        break;
      }
      case 'cool': {
        b.t -= h;
        if (b.t <= 0) b.state = 'idle';
        break;
      }
      case 'melee_windup': {
        b.t -= h;
        e.facingAngle = angleTo(e, pl);
        e.facing = Math.cos(e.facingAngle) < 0 ? -1 : 1;
        L.effects.push({ kind: 'melee-telegraph', x: e.x, y: e.y, t: 0, ttl: 0.05, angle: b.facingAngle });
        if (b.t <= 0) {
          // удар: hitbox круг 40px от центра врага
          if (Math.hypot(pl.x - e.x, pl.y - e.y) <= CFG.meleeRange) {
            playerHit(pl, 1, game.state.run.level);
          }
          b.state = 'cool'; b.t = 0.6;
        }
        break;
      }
    }
  }
};
