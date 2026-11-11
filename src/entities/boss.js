// БОСС «ВЕГА» (DESIGN 3.3, ARCH §4.11): 30 HP, три фазы по порогам BOSS.phaseHp (20/10).
// P1 «Добро пожаловать»: орбита периметра (90px/s), залпы 3 (720px/s, разброс 15°, шаг 0.2s,
//     телеграф 0.8s, LOS) каждые 6s; призыв 2 Смотрителя каждые 12s через портал 1.0s (≤4 живых).
// P2 «Колыбельная»: центр, цикл: 4 луча (шаг 90°, 180°/s, длина до стены, dmg 1) 8s →
//     затишье 2s (coreActive: уязвимость ×2, bullet.js).
// P3 «Вечер не кончается»: цикл: щит 8s (invulnerable, погоня 140px/s, гомоинг-искры 2/6s:
//     180px/s, доворот 30°/s, 1 dmg, жизнь 3s) → ядро 4s (coreActive, дэш: телеграф 1.0s →
//     400px/s 0.3s → зависание 0.5s, dmg 2) → щит 8s → ядро 4s (до смерти).
// HP 0 → event 'boss:death'. ×2-окна — флаг coreActive (D-BO-05: применяется только к боссу).
import { BOSS, TILE, PLAYER } from '../config.js';
import { moveCircle, lineOfSight, segmentCircle } from '../core/collision.js';
import { playerHit } from './player.js';
import { Enemy } from './enemy.js';
import { Bus } from '../core/events.js';

const DEG = Math.PI / 180;
// Ключей в config нет — константы спецификации DESIGN 3.3:
const P1_BULLET = 720;   // скорость пуль P1, px/s
const DASH_DUR = 0.3;    // длительность дэша, s (400px/s → ~120px)
const SPARK_FAN = 10;    // начальный веер 2 искр, ° (TEAM_DECISION: DESIGN не задаёт)

export class Boss {
  constructor(def, level, rng, uid) {
    this.def = def;
    this.levelRef = level;
    this.rng = rng;
    this.uid = uid || 1;
    this.x = def.x; this.y = def.y;
    this.anchor = { x: def.x, y: def.y };
    this.radius = BOSS.radius;
    this.hp = BOSS.hp;
    this.maxHp = BOSS.hp;
    this.phase = 1;
    this.state = 'orbit';
    this.t = 0;
    this.ct = 0;
    this.cState = 'wait';
    this.coreActive = false;
    this.shielded = false;
    this.invulnerable = false;
    this.dead = false;
    this.deadT = 0;
    this.facing = 1;
    this.facingAngle = Math.PI / 2;
    this.glow = 0;
    // P1
    this.orbitAng = Math.atan2(def.y - level.worldH / 2, def.x - (level.worldW / 2));
    this.orbitR = this.measureOrbitR();
    this.volleyT = 2.5;               // первый залп раньше (паттерн виден сразу)
    this.summonT = 8;                  // первый призыв раньше (12s — дальше цикл)
    this.volleyAim = 0;
    this.portals = [];
    // P2
    this.beamAngle = 0;
    // P3
    this.sparkT = BOSS.p3.sparkEvery;
    this.dashAim = 0;
  }

  solidAt(x, y) {
    const L = this.levelRef;
    if (!L || !L.grid) return false;
    const { solid, w, h } = L.grid;
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= w || ty >= h) return true;
    return !!solid[ty * w + tx];
  }

  // Твёрдый cover блокирует лучи (cover = укрытие; blockMove-прямоугольники).
  coverAt(x, y) {
    const L = this.levelRef;
    if (!L || !L.covers) return false;
    for (const c of L.covers) {
      if (c.blockMove && x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return true;
    }
    return false;
  }

  measureOrbitR() {
    let minD = 999;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      let d = 400;
      for (d = 16; d < 400; d += 16) {
        if (this.solidAt(this.x + Math.cos(a) * d, this.y + Math.sin(a) * d)) break;
      }
      minD = Math.min(minD, d);
    }
    return Math.max(40, Math.min(minD - 16, 240));
  }

  raycast(angle) {
    let len = BOSS.p2.beamLen;
    for (let d = 16; d < BOSS.p2.beamLen; d += 8) {
      if (this.solidAt(this.x + Math.cos(angle) * d, this.y + Math.sin(angle) * d) ||
          this.coverAt(this.x + Math.cos(angle) * d, this.y + Math.sin(angle) * d)) {
        len = Math.max(24, d - 8);
        break;
      }
    }
    return len;
  }

  update(h, level, game) {
    const L = this.levelRef;
    const pl = game.state.run.player;
    if (this.dead) return; // труп 1.5s ведёт level.js (deadT)
    this.glow = this.coreActive ? Math.min(1, this.glow + h * 4) : Math.max(0, this.glow - h * 2);

    // порталы P1 (детерминированные — в рамках тика, без setTimeout)
    for (let i = this.portals.length - 1; i >= 0; i--) {
      const p = this.portals[i];
      p.t -= h;
      if (p.t <= 0) {
        this.portals.splice(i, 1);
        const en = new Enemy({ x: p.x, y: p.y }, 'sentry', L, this.rng, L.uid++);
        en.summoned = true;
        L.enemies.push(en);
        Bus.emit('boss:summoned', { uid: this.uid, x: p.x, y: p.y });
      }
    }

    if (this.phase === 1) this.updateP1(h, L, pl);
    else if (this.phase === 2) this.updateP2(h, L, pl);
    else this.updateP3(h, L, pl);

    // лучи P2 (для level.js: коллизии с игроком + render)
    L.beams = [];
    if (this.phase === 2 && this.state === 'beams') {
      for (let k = 0; k < 4; k++) {
        const a = this.beamAngle + k * 90 * DEG;
        L.beams.push({ x: this.x, y: this.y, angle: a, len: this.raycast(a) });
      }
    }

    this.checkPhase();
  }

  updateP1(h, L, pl) {
    const P1 = BOSS.p1;
    const dist = Math.hypot(pl.x - this.x, pl.y - this.y);
    const angToPl = Math.atan2(pl.y - this.y, pl.x - this.x);
    this.facingAngle = angToPl;
    this.facing = Math.cos(angToPl) < 0 ? -1 : 1;

    // орбита периметра (90px/s касательным движением)
    this.orbitAng += (BOSS.speed.walk / this.orbitR) * h;
    const tx = this.anchor.x + Math.cos(this.orbitAng) * this.orbitR;
    const ty = this.anchor.y + Math.sin(this.orbitAng) * this.orbitR;
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d > 2) {
      const step = Math.min(d, BOSS.speed.walk * h);
      const r = moveCircle({ x: this.x, y: this.y }, this.radius, (dx / d) * step, (dy / d) * step, L.grid, L.covers);
      this.x = r.x; this.y = r.y;
    }

    // залпы: LOS → телеграф 0.8s → 3 пули по 0.2s → пауза до 6s
    this.volleyT -= h;
    if (this.state === 'orbit' && this.volleyT <= 0 &&
        lineOfSight({ x: this.x, y: this.y }, { x: pl.x, y: pl.y }, L.grid, L.covers)) {
      this.state = 'aim';
      this.t = P1.telegraph;
    }
    if (this.state === 'aim') {
      this.volleyAim = angToPl;
      L.effects.push({ kind: 'boss-aim', x: this.x, y: this.y, t: 0, ttl: 0.05, angle: this.volleyAim, dist });
      this.t -= h;
      if (this.t <= 0) { this.state = 'volley'; this.t = 0; this.volleyLeft = P1.volley; }
    } else if (this.state === 'volley') {
      this.t -= h;
      if (this.t <= 0) {
        const spread = (L.rng.next() * 2 - 1) * (P1.spreadDeg / 2) * DEG;
        this.fire(L, this.volleyAim + spread);
        this.volleyLeft--;
        if (this.volleyLeft > 0) this.t = P1.gap;
        else { this.state = 'orbit'; this.volleyT = P1.volleyEvery; }
      }
    }

    // призыв 2 Смотрителя каждые 12s (портал 1.0s, ≤4 живых, ±60° от игрока)
    this.summonT -= h;
    if (this.summonT <= 0) {
      this.summonT = P1.summonEvery;
      const alive = L.enemies.filter((e) => !e.dead && e.summoned).length;
      const n = Math.min(P1.summonCount, P1.summonMax - alive);
      if (n > 0) {
        for (let i = 0; i < n; i++) {
          const a = angToPl + (i % 2 === 0 ? 1 : -1) * P1.summonAngleDeg * DEG;
          const px = this.x + Math.cos(a) * P1.summonDist;
          const py = this.y + Math.sin(a) * P1.summonDist;
          L.effects.push({ kind: 'portal', x: px, y: py, t: 0, ttl: P1.portalTime });
          this.portals.push({ x: px, y: py, t: P1.portalTime });
          Bus.emit('boss:summon', { uid: this.uid, x: px, y: py });
        }
      }
    }
  }

  updateP2(h, L, pl) {
    const P2 = BOSS.p2;
    const cx = L.worldW ? L.worldW / 2 : this.anchor.x;
    const cy = L.worldH ? L.worldH / 2 : this.anchor.y;
    switch (this.state) {
      case 'move-center': {
        const dx = cx - this.x, dy = cy - this.y;
        const d = Math.hypot(dx, dy);
        if (d < 8) { this.state = 'beams'; this.t = P2.active; }
        else {
          const step = Math.min(d, BOSS.speed.walk * h);
          const px = this.x, py = this.y;
          const r = moveCircle({ x: this.x, y: this.y }, this.radius, (dx / d) * step, (dy / d) * step, L.grid, L.covers);
          this.x = r.x; this.y = r.y;
          // Центр арены может перекрываться cover (тестовая арена, ARCH §5.4):
          // если движение блокировано — старт лучей с достигнутой позиции.
          if (Math.hypot(this.x - px, this.y - py) < step * 0.25) {
            this.state = 'beams'; this.t = P2.active;
          }
        }
        break;
      }
      case 'beams': {
        this.beamAngle += P2.beamSpeedDeg * DEG * h;   // 180°/s (360° за 2s, DESIGN)
        this.t -= h;
        if (this.t <= 0) { this.state = 'calm'; this.t = P2.calm; this.coreActive = true; }
        break;
      }
      case 'calm': {
        this.t -= h;
        if (this.t <= 0) { this.state = 'beams'; this.t = P2.active; this.coreActive = false; }
        break;
      }
    }
    const angToPl = Math.atan2(pl.y - this.y, pl.x - this.x);
    this.facingAngle = angToPl;
    this.facing = Math.cos(angToPl) < 0 ? -1 : 1;
  }

  updateP3(h, L, pl) {
    const P3 = BOSS.p3;
    const angToPl = Math.atan2(pl.y - this.y, pl.x - this.x);
    switch (this.state) {
      case 'shield': {
        this.shielded = true; this.invulnerable = true;
        // погоня 140px/s
        const dx = pl.x - this.x, dy = pl.y - this.y;
        const d = Math.hypot(dx, dy);
        if (d > 40) {
          const step = Math.min(d, BOSS.speed.phase3 * h);
          const r = moveCircle({ x: this.x, y: this.y }, this.radius, (dx / d) * step, (dy / d) * step, L.grid, L.covers);
          this.x = r.x; this.y = r.y;
        }
        // гомоинг-искры 2/6s
        this.sparkT -= h;
        if (this.sparkT <= 0) {
          this.sparkT = P3.sparkEvery;
          for (let i = 0; i < P3.sparkCount; i++) {
            const a = angToPl + (i - (P3.sparkCount - 1) / 2) * SPARK_FAN * DEG;
            L.sparks.push({
              x: this.x + Math.cos(a) * (this.radius + 10),
              y: this.y + Math.sin(a) * (this.radius + 10),
              angle: a, speed: P3.sparkSpeed, turn: P3.sparkTurnDeg * DEG,
              life: P3.sparkLife, t: 0
            });
            Bus.emit('boss:spark', { uid: this.uid });
          }
        }
        this.facingAngle = angToPl;
        this.facing = Math.cos(angToPl) < 0 ? -1 : 1;
        this.t -= h;
        if (this.t <= 0) {
          this.state = 'core';
          this.t = P3.core;
          this.shielded = false;
          this.invulnerable = false;
          this.coreActive = true;
          this.cState = 'aim';
          this.ct = P3.dashTelegraph;
        }
        break;
      }
      case 'core': {
        this.shielded = false; this.invulnerable = false; this.coreActive = true;
        this.t -= h; this.ct -= h;
        switch (this.cState) {
          case 'aim': {
            this.facingAngle = angToPl;
            this.facing = Math.cos(angToPl) < 0 ? -1 : 1;
            L.effects.push({ kind: 'boss-aim', x: this.x, y: this.y, t: 0, ttl: 0.05, angle: angToPl, dist: Math.hypot(pl.x - this.x, pl.y - this.y) });
            this.glow = 1;
            if (this.ct <= 0) {
              this.cState = 'dash';
              this.ct = DASH_DUR;
              this.dashAim = angToPl;
              Bus.emit('boss:dash', { uid: this.uid });
            }
            break;
          }
          case 'dash': {
            const prev = { x: this.x, y: this.y };
            const r = moveCircle({ x: this.x, y: this.y }, this.radius, Math.cos(this.dashAim) * P3.dashSpeed * h, Math.sin(this.dashAim) * P3.dashSpeed * h, L.grid, L.covers);
            this.x = r.x; this.y = r.y;
            this.facingAngle = this.dashAim;
            this.facing = Math.cos(this.dashAim) < 0 ? -1 : 1;
            if (segmentCircle(prev, { x: this.x, y: this.y }, { x: pl.x, y: pl.y }, PLAYER.radius) && playerHit(pl, 2, L)) {
              Bus.emit('boss:dash-hit', { uid: this.uid });
            }
            if (this.ct <= 0) { this.cState = 'linger'; this.ct = P3.dashLinger; }
            break;
          }
          case 'linger': {
            if (this.ct <= 0) {
              // ядро 4s: 2 дэша (1.0+0.3+0.5=1.8s × 2)
              if (this.t > 0.2) { this.cState = 'aim'; this.ct = P3.dashTelegraph; }
              else {
                this.state = 'shield';
                this.t = P3.shield;
                this.coreActive = false;
                this.sparkT = P3.sparkEvery;
              }
            }
            break;
          }
        }
        break;
      }
    }
  }

  fire(L, angle) {
    L.bullets.push({
      x: this.x + Math.cos(angle) * (this.radius + 6),
      y: this.y + Math.sin(angle) * (this.radius + 6),
      vx: Math.cos(angle) * P1_BULLET, vy: Math.sin(angle) * P1_BULLET,
      dmg: 1, life: 1.6, owner: this.uid
    });
    L.effects.push({ kind: 'muzzle', x: this.x, y: this.y, angle, t: 0, ttl: 0.06, enemy: true });
  }

  onHit(dmg) {
    if (this.dead) return;
    if (this.invulnerable) { Bus.emit('boss:shield-hit', { uid: this.uid }); return; }
    this.hp -= dmg;
    Bus.emit('boss:hit', { uid: this.uid, hp: this.hp });
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.deadT = 1.5;
      this.coreActive = false;
      this.shielded = false;
      this.invulnerable = false;
      Bus.emit('boss:death', { uid: this.uid });
    }
  }

  checkPhase() {
    if (this.phase === 1 && this.hp <= BOSS.phaseHp[0]) {
      this.phase = 2;
      this.state = 'move-center';
      this.t = 0;
      this.coreActive = false;
      Bus.emit('boss:phase', { uid: this.uid, phase: 2 });
    } else if (this.phase === 2 && this.hp <= BOSS.phaseHp[1]) {
      this.phase = 3;
      this.state = 'shield';
      this.t = BOSS.p3.shield;
      this.shielded = true;
      this.invulnerable = true;
      this.sparkT = BOSS.p3.sparkEvery;
      Bus.emit('boss:phase', { uid: this.uid, phase: 3 });
    }
  }
}
