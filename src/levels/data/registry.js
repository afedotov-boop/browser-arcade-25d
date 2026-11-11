// Реестр данных уровней (ARCH §4.12: ES-модули JS).
// M2 «Три уровня и сюжет»: полная игра L1 → L2 → L3 (DESIGN 3.4, R07 — ровно три уровня);
// dev-арена остаётся в LEVEL_DATA для debug-хуков (ARCH §10), но в ран-поток не входит.
import dev from './dev.js';
import l1 from './l1.js';
import l2 from './l2.js';
import l3 from './l3.js';
import { LEVELS, DEV_LEVEL } from '../../config.js';

export const LEVEL_DATA = { dev, l1, l2, l3 };

// Ран-последовательность (DESIGN 3.4, R07: ровно 3 уровня):
// «НОВАЯ СМЕНА» → L1; L3 (clear kill_boss) → VICTORY (FSM onLevelClear).
export const RUN_SEQUENCE = ['l1', 'l2', 'l3'];

export function getLevelData(id) {
  const d = LEVEL_DATA[id];
  if (!d) throw new Error('unknown level: ' + id);
  return d;
}

export function levelMeta(id) {
  if (id === 'dev') return { seed: DEV_LEVEL.seed, name: DEV_LEVEL.name, music: 'menu', isDev: true };
  const i = LEVELS.findIndex((l) => l.id === id);
  if (i < 0) return { seed: 1, name: id, music: 'menu', isDev: false };
  return { seed: LEVELS[i].seed, name: `СМЕНА ${i + 1}/3 · ${LEVELS[i].name}`, music: LEVELS[i].music, isDev: false };
}
