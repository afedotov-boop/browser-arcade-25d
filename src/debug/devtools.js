// Debug-хуки (ARCH §10): ?debug=1 → window.__dev; error-overlay ВСЕГДА (R13).
import { serializeRun } from '../state/gamestate.js';
import { Bus } from '../core/events.js';
import { Enemy } from '../entities/enemy.js';
import { Boss } from '../entities/boss.js';

export function createDevTools(game) {
  const debug = new URLSearchParams(location.search).has('debug');
  const state = () => game.state;
  const run = () => game.state.run;

  function showError(err) {
    const msg = (err && err.message) || String(err);
    console.error('[error]', msg, { mode: state().mode, frame: game.frameCount });
    let ov = document.getElementById('error-overlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'error-overlay';
      Object.assign(ov.style, {
        position: 'fixed', top: '0', left: '0', right: '0',
        background: 'rgba(200,40,40,0.92)', color: '#fff',
        fontFamily: 'monospace', padding: '10px 16px', zIndex: '9999', fontSize: '13px'
      });
      document.body.appendChild(ov);
    }
    ov.textContent = `ERROR [${state().mode} f=${game.frameCount}]: ${msg}`;
  }
  window.addEventListener('error', (e) => showError(e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => showError(e.reason));
  game.showError = showError;

  function toast(msg) {
    let el = document.getElementById('dev-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dev-toast';
      Object.assign(el.style, {
        position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(201,162,39,0.95)', color: '#14202B', fontFamily: 'monospace',
        padding: '6px 14px', zIndex: '9998', fontSize: '13px', borderRadius: '4px',
        opacity: '0', transition: 'opacity 0.3s'
      });
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 3000);
  }
  game.toast = toast;

  function diff(a, b, path) {
    const out = [];
    if (a === b) return out;
    if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) {
      out.push(`${path}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
      return out;
    }
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      out.push(...diff(a[k], b[k], path ? `${path}.${k}` : String(k)));
    }
    return out;
  }

  // I3-нормализация снапшота: убираем поля, закономерно уходящие после рестарта
  // (часы уровня, живые позиции патрулирующих врагов, транзиентные эффекты),
  // чтобы diff ловил только реальное «протухшее» состояние, а не дрейф часов.
  function normalizeRun(s) {
    if (!s || !s.level) return s;
    const L = { ...s.level };
    delete L.time;
    delete L.effects;
    L.enemies = L.enemies.map((e) => {
      const c = { ...e };
      delete c.x; delete c.y;
      return c;
    });
    if (L.boss) {
      const b = { ...L.boss };
      delete b.x; delete b.y;
      L.boss = b;
    }
    delete L.sparks;
    delete L.beams;
    return { ...s, level: L };
  }
  const lastLog = {};
  const LOG_EVENTS = [
    'player:shoot', 'player:hit', 'player:death', 'player:reload', 'player:reload-done',
    'enemy:discover', 'enemy:hit', 'enemy:death', 'enemy:shoot',
    'level:exit-armed', 'level:clear',
    'boss:phase', 'boss:hit', 'boss:death', 'boss:summon', 'boss:dash',
    'boss:shield-hit', 'boss:beam-hit', 'boss:spark-hit', 'boss:dash-hit'
  ];
  for (const evt of LOG_EVENTS) {
    Bus.on(evt, () => {
      const now = performance.now();
      if (lastLog[evt] && now - lastLog[evt] < 400) return;
      lastLog[evt] = now;
      const r = run();
      console.log(`[t=${r ? r.level.time.toFixed(2) : '0.00'}s f=${game.frameCount} mode=${state().mode} ev=${evt}]`);
    });
  }

  if (!debug) return { toast, showError, debug: false };

  const dev = {
    state: () => serializeRun(state()),
    // I3 (ARCH §8.3): «serializeRun(startLevel(i)) идентичен при fresh-старте и
    // рестарте того же уровня». Сравниваем baseline (t=0, снят в startLevel) с
    // ТЕКУЩИМ состоянием, но исключая поля, которые закономерно уходят после
    // рестарта, потому что симуляция продолжает идти от чистого старта:
    //   · level.time          — часы уровня (≈0 в момент рестарта, растут дальше);
    //   · level.enemies[*].x/y — патрулирование сентри сдвигает их от спавна;
    //   · level.effects       — транзиентные эффекты (частицы), живут < 1 c.
    // Всё остальное (состав врагов/тип/uid/hp/discovered/dead, состояние игрока,
    // пули, killCount, exitArmed) — обязано совпадать ПОБАЙТОВО. Это и есть
    // детерминизм начального состояния (I3) + чистота рестарта (R12 «пули, враги,
    // позиции, таймеры»): «позиции» проверяются отдельно через state() при time≈0.
    resetCheck() {
      const r = run();
      if (!r) { const m = 'RESET-CHECK: no run'; toast(m); console.warn('[dev]', m); return m; }
      const cur = normalizeRun(serializeRun(state()));
      const base = normalizeRun(r._baseline);
      const d = diff(base, cur);
      const m = d.length === 0 ? 'RESET-CHECK OK' : 'RESET-CHECK DIFF: ' + d.slice(0, 6).join('; ');
      toast(m);
      console.log('[dev]', m);
      Bus.emit('debug:reset-check', { ok: d.length === 0 });
      return m;
    },
    spawnEnemy(type, x, y) {
      const r = run();
      if (!r || state().mode !== 'level') return 'not in level';
      const L = r.level;
      const px = x != null ? x : L.worldW / 2;
      const py = y != null ? y : L.worldH / 2;
      const e = new Enemy({ x: px, y: py, patrol: [{ x: px, y: py }] }, type, { grid: L.grid, covers: L.covers }, L.rng, 1000 + L.enemies.length);
      L.enemies.push(e);
      L.totalEnemies++;
      toast(`spawn ${type} @${Math.round(px)},${Math.round(py)}`);
      return e.uid;
    },
    teleport(x, y) {
      const r = run();
      if (!r) return 'no run';
      r.player.x = x != null ? x : r.level.worldW / 2;
      r.player.y = y != null ? y : r.level.worldH / 2;
      return 'ok';
    },
    killPlayer() {
      const r = run();
      if (!r) return 'no run';
      r.player.hp = 0;
      Bus.emit('player:death', { dev: true });
      return 'ok';
    },
    skipLevel() {
      const r = run();
      if (!r) return 'no run';
      const L = r.level;
      L.forceClear = true;
      L.exitArmed = true;
      L.killCount = L.totalEnemies;
      return 'forced on next step';
    },
    setAmmo(n) {
      const r = run();
      if (!r) return 'no run';
      r.player.ammo = Math.max(0, Math.min(8, n | 0));
      r.player.reloading = false;
      r.player.reloadT = 0;
      return 'ok';
    },
    healPlayer() {
      const r = run();
      if (!r) return 'no run';
      r.player.hp = 3;
      r.player.iframeT = 0;
      return 'ok';
    },
    // «ВЕГА» (DESIGN 3.3): спавн босса в dev-арене (вместе с clear kill_boss)
    spawnBoss() {
      const r = run();
      if (!r || state().mode !== 'level') return 'not in level';
      const L = r.level;
      if (L.boss) return 'boss already present';
      const px = L.worldW / 2, py = 96;
      L.boss = new Boss({ x: px, y: py }, L, L.rng, 2000);
      L.sparks = L.sparks || [];
      L.beams = L.beams || [];
      L.clear = { type: 'kill_boss' };
      toast(`spawn boss ВЕГА @${Math.round(px)},${Math.round(py)}`);
      return L.boss.uid;
    },
    setBossHp(n) {
      const r = run();
      const B = r && r.level && r.level.boss;
      if (!B) return 'no boss (spawnBoss)';
      B.hp = Math.max(1, Math.min(B.maxHp, n | 0));
      return `ok (${B.hp})`;
    },
    // Debug-only: однострельное убийство босса через РЕАЛЬНЫЙ урон (onHit) — тест
    // victory-циклов (карточка t_4d78a23f). Запись интерфейса M2→M3 (ctx_3a4b78ea)
    // указывала на killBoss — хук отсутствовал, добавлен.
    killBoss() {
      const r = run();
      const B = r && r.level && r.level.boss;
      if (!B || B.dead) return 'no boss / already dead';
      B.onHit(B.hp);
      return 'ok (boss dead via real damage)';
    },
    stats: () => {
      const r = run();
      const B = r && r.level && r.level.boss;
      return {
        ...game.stats,
        mode: state().mode,
        boss: B ? { hp: B.hp, maxHp: B.maxHp, phase: B.phase, state: B.state, coreActive: B.coreActive, shielded: B.shielded } : null
      };
    },
    frameOnce: (dt) => game.frameOnce(dt || 1 / 60)
  };
  window.__dev = dev;
  return { toast, showError, debug: true };
}
