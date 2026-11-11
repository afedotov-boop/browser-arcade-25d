// Тестовая арена (level-0, вне ран-последовательности; ARCH §5.4).
// 32×24 тайла, 1 cover в центре, 1 Смотритель, kill_all, музыка 'menu'.
export default {
  version: 1,
  id: 'dev',
  name: 'ТЕСТОВАЯ АРЕНА',
  music: 'menu',
  size: { w: 32, h: 24 },
  floor: 'chess_mixed',
  tint: null,
  walls: [
    { x: 0, y: 0, w: 32, h: 1 },    // север
    { x: 0, y: 23, w: 32, h: 1 },   // юг
    { x: 0, y: 0, w: 1, h: 24 },    // запад
    { x: 31, y: 0, w: 1, h: 24 }    // восток
  ],
  cover: [
    { id: 'center-block', shape: 'rect', x: 15, y: 11, w: 2, h: 2, front: 24, blockMove: true, blockBullets: true }
  ],
  spawn: { x: 5 * 32, y: 19 * 32 },
  exit: { x: 27 * 32, y: 4 * 32, r: 48, label: 'ВЫХОД' },
  clear: { type: 'kill_all' },
  enemies: [
    { type: 'sentry', x: 16 * 32, y: 6 * 32, patrol: [{ x: 13 * 32, y: 6 * 32 }, { x: 19 * 32, y: 6 * 32 }] }
  ],
  boss: null
};
