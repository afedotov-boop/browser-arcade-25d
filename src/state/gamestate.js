// GameState (ARCH §4.8): ВСЁ игровое состояние в gs.run (I1).
import { PLAYER, TILE } from '../config.js';
import { Level } from '../levels/level.js';
import { getLevelData, levelMeta, RUN_SEQUENCE } from '../levels/data/registry.js';

export function createGameState() {
  return { mode: 'menu', paused: false, run: null, overlay: null, introT: 0, storyT: 0, deathT: 0, victoryT: 0 };
}

export function newRun(gs) {
  gs.run = { levelIndex: 0, completed: [false, false, false] };
}

// ПОЛНАЯ перестройка (I2/I5, §8): run.level строится с нуля из данных + seeded Rng.
export function startLevel(gs, i) {
  const id = RUN_SEQUENCE[i] ?? RUN_SEQUENCE[0];
  const data = getLevelData(id);
  const meta = levelMeta(id);
  const lvl = new Level(data, meta.seed);
  if (!gs.run) newRun(gs);
  const r = gs.run;
  r.levelIndex = i;
  r.player = {
    x: data.spawn.x, y: data.spawn.y,
    hp: PLAYER.hp, ammo: PLAYER.ammo,
    reloading: false, reloadT: 0,
    iframeT: 0, hitFlashT: 0, fireCd: 0,
    aimAngle: 0, facing: 1, moving: false
  };
  r.level = lvl; // Level-инстанс = run.level (I1: единый источник)
  lvl.id = id;
  lvl.name = meta.name;
  lvl.music = meta.music;
  lvl.isDev = meta.isDev;
  lvl.time = 0;
  lvl.killCount = 0;
  lvl.totalEnemies = (data.enemies || []).length;
  lvl.exitArmed = false;
  lvl.forceClear = false;
  lvl.cleared = false;
  lvl.enemies = [];
  lvl.boss = null;
  lvl.sparks = [];
  lvl.beams = [];
  lvl.bullets = [];
  lvl.effects = [];
  lvl.exit = data.exit;
  lvl.clear = data.clear;
  lvl.tint = data.tint;
  lvl.worldW = data.size.w * TILE;
  lvl.worldH = data.size.h * TILE;
  lvl.buildEntities(r);
  // I3: baseline свежестарта (для resetCheck)
  gs.mode = 'level';
  gs.paused = false;
  gs.run._baseline = serializeRun(gs);
  return lvl;
}

export function toMenu(gs) {
  gs.run = null;
  gs.mode = 'menu';
  gs.paused = false;
  gs.overlay = null;
}

// plain-JSON снапшот (dev:state, resetCheck; I3).
export function serializeRun(gs) {
  if (!gs.run) return { mode: gs.mode, paused: gs.paused, run: null };
  const r = gs.run;
  const L = r.level;
  if (!L) {
    // intro: run создан, уровень ещё не построен
    return { mode: gs.mode, paused: gs.paused, levelIndex: r.levelIndex, completed: r.completed.slice(), level: null };
  }
  const rnd = (v) => Math.round(v * 1000) / 1000;
  return {
    mode: gs.mode, paused: gs.paused,
    levelIndex: r.levelIndex,
    completed: r.completed.slice(),
    level: {
      id: L.id,
      time: rnd(L.time),
      killCount: L.killCount,
      totalEnemies: L.totalEnemies,
      exitArmed: L.exitArmed,
      player: {
        x: rnd(r.player.x), y: rnd(r.player.y),
        hp: r.player.hp, ammo: r.player.ammo,
        reloading: r.player.reloading,
        reloadT: rnd(r.player.reloadT),
        iframeT: rnd(r.player.iframeT)
      },
      enemies: L.enemies.map((e) => ({
        uid: e.uid, type: e.type, x: rnd(e.x), y: rnd(e.y),
        hp: e.hp, discovered: e.discovered, dead: e.dead, state: e.behavior?.state ?? null
      })),
      bullets: L.bullets.map((b) => ({ x: rnd(b.x), y: rnd(b.y), owner: b.owner })),
      boss: L.boss ? { x: rnd(L.boss.x), y: rnd(L.boss.y), hp: L.boss.hp, phase: L.boss.phase, state: L.boss.state, dead: L.boss.dead } : null,
      sparks: (L.sparks || []).length,
      beams: (L.beams || []).length,
      effects: L.effects.length
    }
  };
}
