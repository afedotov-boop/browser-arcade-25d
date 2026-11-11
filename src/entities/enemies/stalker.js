// «Стартап» (DESIGN 3.2, ARCH §4.11): спит (патруль 0.5×) → просыпается (игрок ≤200px ИЛИ в него
// стреляли) → рваный заход 270px/s + удар дубиной (windup 0.4s, hitbox 40px, cooldown 1.2s). Дальних атак нет.
import { ENEMIES } from '../../config.js';
import { moveCircle } from '../../core/collision.js';
import { playerHit } from '../player.js';

const CFG = ENEMIES.stalker;
const WINDUP = 0.4; // D-BO-03 (TEAM_DECISION): windup в config/DESIGN не задан; 0.4s — телеграф удара

export const stalkerBehavior = {
  create(e, def) {
    const b = {
      state: 'asleep',
      t: 0,
      patrol: def.patrol || [{ x: e.x, y: e.y }],
      wp: 0
    };
    // Бужение отличается от общего конуса (DESIGN 3.2: «игрок в радиусе 200px»):
    // радиусное, без конуса/LOS/задержки (D-BO-02).
    e.tickDiscover = (game) => {
      if (e.discovered) return;
      const pl = game.state.run.player;
      if (Math.hypot(pl.x - e.x, pl.y - e.y) <= CFG.wakeRadius) e.discover(game);
    };
    // Попадание по нему будит мгновенно (DESIGN 3.2: «или в него стреляли»).
    const baseOnHit = e.onHit.bind(e);
    e.onHit = (dmg) => {
      if (!e.discovered) e.discover(null);
      baseOnHit(dmg);
    };
    b.update = (en, game, h) => stalkerBehavior.update(en, game, h);
    return b;
  },
  update(e, game, h) {
    const L = game.state.run.level;
    const pl = game.state.run.player;
    const b = e.behavior;
    const dist = Math.hypot(pl.x - e.x, pl.y - e.y);

    if (!e.discovered) {
      // спит: патруль по периметру 0.5× скорости (D-BO-02: 135px/s)
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
      } else if (pts.length > 1) {
        // достигли точки (случай spawn == pts[0] включительно) — следующая
        b.wp = (b.wp + 1) % pts.length;
      }
      return;
    }

    // === проснулся: прямой рывок + дубина ===
    const ang = Math.atan2(pl.y - e.y, pl.x - e.x);
    e.facingAngle = ang;
    e.facing = Math.cos(ang) < 0 ? -1 : 1;

    switch (b.state) {
      case 'asleep':
      case 'chase': {
        const r = moveCircle({ x: e.x, y: e.y }, e.radius, Math.cos(ang) * CFG.speed * h, Math.sin(ang) * CFG.speed * h, L.grid, L.covers);
        e.x = r.x; e.y = r.y;
        e.walkT += h;
        if (dist <= CFG.meleeRange) { b.state = 'windup'; b.t = WINDUP; }
        break;
      }
      case 'windup': {
        b.t -= h;
        L.effects.push({ kind: 'melee-telegraph', x: e.x, y: e.y, t: 0, ttl: 0.05, angle: e.facingAngle });
        if (b.t <= 0) {
          // удар: hitbox круг meleeRange от центра врага
          if (Math.hypot(pl.x - e.x, pl.y - e.y) <= CFG.meleeRange) playerHit(pl, 1, L);
          b.state = 'cool';
          b.t = CFG.meleeCooldown;
        }
        break;
      }
      case 'cool': {
        // cooldown 1.2s (DESIGN 3.2: «после промаха — пауза 1.2s на новую атаку»);
        // дожим продолжает, новая атака — после cooldown, если игрок в зоне
        b.t -= h;
        const r = moveCircle({ x: e.x, y: e.y }, e.radius, Math.cos(ang) * CFG.speed * h, Math.sin(ang) * CFG.speed * h, L.grid, L.covers);
        e.x = r.x; e.y = r.y;
        if (b.t <= 0) {
          if (dist <= CFG.meleeRange * 1.4) { b.state = 'windup'; b.t = WINDUP; }
          else b.state = 'chase';
        }
        break;
      }
    }
  }
};
