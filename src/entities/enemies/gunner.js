// «Регистратор» (DESIGN 3.2, ARCH §4.11): пост (патруль 0.5×) → конус 100°/260px+LOS (общая система
// enemy.js) → телеграф 1.0s (розовая линия по прицелу) → залп 3 (800px/s, разброс 8°, шаг 0.12s)
// → пауза 0.8s → повтор, пока игрок в поле зрения (LOS && ≤420px, config `range`).
// Потеря видимости — возврат на пост (spawn), discovered сбрасывается.
import { ENEMIES } from '../../config.js';
import { moveCircle, lineOfSight } from '../../core/collision.js';

const CFG = ENEMIES.gunner;

export const gunnerBehavior = {
  create(e, def) {
    const b = {
      state: 'post',
      t: 0,
      patrol: def.patrol || [{ x: e.x, y: e.y }],
      wp: 0,
      home: { x: e.x, y: e.y },   // точка поста (spawn)
      aim: 0,
      volleyLeft: 0
    };
    b.update = (en, game, h) => gunnerBehavior.update(en, game, h);
    return b;
  },
  update(e, game, h) {
    const L = game.state.run.level;
    const pl = game.state.run.player;
    const b = e.behavior;

    if (!e.discovered) {
      // пост: патруль 0.5× скорости (DESIGN 3.2: «патрулирует/держит пост»);
      // полное обнаружение — общая система (конус 100°/260px + 0.4s, enemy.js)
      const pts = b.patrol;
      const target = pts[b.wp % pts.length];
      const dx = target.x - e.x, dy = target.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d > 4) {
        e.facingAngle = Math.atan2(dy, dx);
        e.facing = Math.cos(e.facingAngle) < 0 ? -1 : 1;
        const r = moveCircle({ x: e.x, y: e.y }, e.radius, (dx / d) * CFG.speed * 0.5 * h, (dy / d) * CFG.speed * 0.5 * h, L.grid, L.covers);
        e.x = r.x; e.y = r.y;
        e.walkT += h;
        if (Math.hypot(target.x - e.x, target.y - e.y) < 6) b.wp = (b.wp + 1) % pts.length;
      }
      return;
    }

    // === обнаружен ===
    const dist = Math.hypot(pl.x - e.x, pl.y - e.y);
    const los = lineOfSight({ x: e.x, y: e.y }, { x: pl.x, y: pl.y }, L.grid, L.covers);
    const visible = los && dist <= CFG.range;

    // потеря видимости (нет LOS || >420px) — возврат на пост (DESIGN 3.2)
    if (!visible) {
      if (b.state !== 'return') { b.state = 'return'; b.volleyLeft = 0; }
      const hx = b.home.x - e.x, hy = b.home.y - e.y;
      const hd = Math.hypot(hx, hy);
      if (hd > 6) {
        e.facingAngle = Math.atan2(hy, hx);
        e.facing = Math.cos(e.facingAngle) < 0 ? -1 : 1;
        const r = moveCircle({ x: e.x, y: e.y }, e.radius, (hx / hd) * CFG.speed * h, (hy / hd) * CFG.speed * h, L.grid, L.covers);
        e.x = r.x; e.y = r.y;
        e.walkT += h;
      }
      e.suspicion = Math.max(0, e.suspicion - h);
      if (hd <= 6) {
        b.state = 'post';
        e.discovered = false;
        e.suspicion = 0;
      }
      return;
    }

    // игрок в поле зрения: прицел + цикл телеграф → залп → пауза
    const ang = Math.atan2(pl.y - e.y, pl.x - e.x);
    e.facingAngle = ang;
    e.facing = Math.cos(ang) < 0 ? -1 : 1;

    switch (b.state) {
      case 'aim': {
        b.aim = ang;
        L.effects.push({ kind: 'gunner-aim', x: e.x, y: e.y, t: 0, ttl: 0.05, angle: b.aim, dist });
        b.t -= h;
        if (b.t <= 0) {
          b.state = 'volley';
          b.volleyLeft = CFG.volley;
          b.t = 0;
        }
        break;
      }
      case 'volley': {
        L.effects.push({ kind: 'gunner-aim', x: e.x, y: e.y, t: 0, ttl: 0.05, angle: b.aim, dist });
        b.t -= h;
        if (b.t <= 0) {
          // залп 3 (800px/s, разброс 8°, шаг 0.12s) — детерминированный разброс (seeded Rng, I3)
          const spread = (L.rng.next() * 2 - 1) * (CFG.spreadDeg / 2) * (Math.PI / 180);
          e.shoot(game, b.aim + spread, CFG.bulletSpeed, 1);
          b.volleyLeft--;
          if (b.volleyLeft > 0) {
            b.t = CFG.gap;
          } else {
            b.state = 'pause';
            b.t = CFG.pauseAfter;
          }
        }
        break;
      }
      case 'pause': {
        b.t -= h;
        if (b.t <= 0) {
          b.state = 'aim';
          b.t = CFG.telegraph;
        }
        break;
      }
      default: {
        // первое обнаружение (state 'post'/'return' уже обработан выше)
        b.state = 'aim';
        b.t = CFG.telegraph;
      }
    }
  }
};
