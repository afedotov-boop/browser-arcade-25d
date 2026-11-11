// Enemy (базовый, ARCH §4.11): perceive, discover, onHit, смерть. Поведения — реестр.
import { ENEMIES } from '../config.js';
import { lineOfSight } from '../core/collision.js';
import { Bus } from '../core/events.js';
import { sentryBehavior } from './enemies/sentry.js';
import { stalkerBehavior } from './enemies/stalker.js';
import { gunnerBehavior } from './enemies/gunner.js';

const DEG = Math.PI / 180;

export class Enemy {
  constructor(def, type, level, rng, uid) {
    const cfg = ENEMIES[type];
    this.uid = uid;
    this.type = type;
    this.x = def.x;
    this.y = def.y;
    this.hp = cfg.hp;
    this.radius = cfg.radius;
    this.viewHeight = cfg.viewHeight;
    this.width = cfg.width;
    this.discovered = false;
    this.suspicion = 0;
    this.dead = false;
    this.deadT = 0;
    this.alertT = 0;       // «!» над головой
    this.facing = 1;       // sprite flip
    this.facingAngle = 0;  // для конуса perception
    this.walkT = 0;
    this.behavior = (ENEMY_BEHAVIORS[type] || sentryBehavior).create(this, def);
    this.levelRef = level;
  }
  // Общий конус: sight.cone°/radius + delay; los обязателен для «видит» (TEAM_DECISION).
  perceive(game) {
    const pl = game.state.run.player;
    const dist = Math.hypot(pl.x - this.x, pl.y - this.y);
    const sight = ENEMIES.sight;
    const ang = Math.atan2(pl.y - this.y, pl.x - this.x);
    let angDiff = Math.abs(normAng(ang - this.facingAngle));
    const inCone = dist <= sight.radius && angDiff <= (sight.coneDeg / 2) * DEG;
    const los = inCone && lineOfSight({ x: this.x, y: this.y }, { x: pl.x, y: pl.y }, this.levelRef.grid, this.levelRef.covers);
    return { seen: inCone && los, dist, angle: ang, los };
  }
  // один раз за уровень: «!» + SFX + Bus
  discover(game) {
    if (this.discovered) return;
    this.discovered = true;
    this.alertT = 1.2;
    Bus.emit('enemy:discover', { uid: this.uid, type: this.type });
  }
  update(h, level, game) {
    if (!this.discovered) this.tickDiscover(game, h);
    this.alertT = Math.max(0, this.alertT - h);
    this.behavior.update(this, game, h);
  }
  // общее обнаружение: конус + задержка; стalker переопределяет (D-BO-02: радиус,
  // без конуса/LOS/задержки)
  tickDiscover(game, h) {
    const p = this.perceive(game);
    if (p.seen) this.suspicion += h;
    else this.suspicion = Math.max(0, this.suspicion - h * 0.5);
    if (this.suspicion >= ENEMIES.sight.delay) this.discover(game);
  }
  onHit(dmg) {
    if (this.dead) return;
    this.hp -= dmg;
    Bus.emit('enemy:hit', { uid: this.uid, type: this.type, hp: this.hp });
    if (this.hp <= 0) this.die();
  }
  die() {
    this.dead = true;
    this.deadT = 1.5;
    Bus.emit('enemy:death', { uid: this.uid, type: this.type, x: this.x, y: this.y });
    // killCount и труп-эффект добавит подписчик в loop.js (run.level — единый источник)
  }
  // общий примитив: выстрел (пуля уровня врага)
  shoot(game, angle, speed, dmg) {
    const L = game.state.run.level;
    L.bullets.push({
      x: this.x + Math.cos(angle) * (this.radius + 6),
      y: this.y + Math.sin(angle) * (this.radius + 6),
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      dmg, life: 1.6, owner: this.uid
    });
    L.effects.push({ kind: 'muzzle', x: this.x, y: this.y, angle, t: 0, ttl: 0.06, enemy: true });
    Bus.emit('enemy:shoot', { type: this.type });
  }
}

function normAng(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Реестр поведений (ARCH §6): новый тип = config-блок + behavior + строка здесь.
export const ENEMY_BEHAVIORS = {
  sentry: sentryBehavior,
  stalker: stalkerBehavior,
  gunner: gunnerBehavior,
};
