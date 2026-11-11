// L1 «Лобби» (DESIGN 3.4, уровень 1): главный зал 52×40 + крылья С/СВ/СЗ/В (крест).
// Финальные координаты (TEAM_DECISION, уточнение раскладки DESIGN 3.4; 64×48 — верхний
// лимит валидатора ARCH §5.1). 12 врагов: смотритель ×10 (по 2 в каждом крыле + 2 в зале у
// колонн) и регистратор ×2 (длинная ось зала). Проходимость раскладки (патрульные линии
// без перекрытий, спавн/выход не в покрытии) проверена кодом.
// Старт — южное крыло (безопасная зона 5s, DESIGN 3.4); выход — северный лифт,
// открывается после зачистки (kill_all).
const T = 32; // tile
export default {
  version: 1, id: 'l1', name: 'ЛОББИ', music: 'l1',
  size: { w: 64, h: 48 },
  floor: 'chess_cream', // кремово-бежевый пол (DESIGN 4.3)
  tint: { color: '#E8622C', amount: 0.05 }, // тёплый оранжевый +5%
  walls: [
    // Крест: углы 24×4 и полосы 6×12 между залом и крыльями
    { x: 0, y: 0, w: 24, h: 4 },    // СЗ
    { x: 40, y: 0, w: 24, h: 4 },   // СВ
    { x: 0, y: 44, w: 24, h: 4 },   // ЮЗ
    { x: 40, y: 44, w: 24, h: 4 },  // ЮВ
    { x: 0, y: 4, w: 6, h: 12 },    // западная полоса северная
    { x: 0, y: 32, w: 6, h: 12 },   // западная полоса южная
    { x: 58, y: 4, w: 6, h: 12 },   // восточная полоса северная
    { x: 58, y: 32, w: 6, h: 12 },  // восточная полоса южная
  ],
  cover: [
    // 8 колонн (2×2) вокруг ресепшн-стойки: блок + укрытия
    { id: 'col1', shape: 'rect', x: 24, y: 19, w: 2, h: 2, front: 24, blockMove: true, blockBullets: true },
    { id: 'col2', shape: 'rect', x: 29, y: 19, w: 2, h: 2, front: 24, blockMove: true, blockBullets: true },
    { id: 'col3', shape: 'rect', x: 34, y: 19, w: 2, h: 2, front: 24, blockMove: true, blockBullets: true },
    { id: 'col4', shape: 'rect', x: 39, y: 19, w: 2, h: 2, front: 24, blockMove: true, blockBullets: true },
    { id: 'col5', shape: 'rect', x: 24, y: 28, w: 2, h: 2, front: 24, blockMove: true, blockBullets: true },
    { id: 'col6', shape: 'rect', x: 29, y: 28, w: 2, h: 2, front: 24, blockMove: true, blockBullets: true },
    { id: 'col7', shape: 'rect', x: 34, y: 28, w: 2, h: 2, front: 24, blockMove: true, blockBullets: true },
    { id: 'col8', shape: 'rect', x: 39, y: 28, w: 2, h: 2, front: 24, blockMove: true, blockBullets: true },
    // Ресепшн-стойка по центру зала (DESIGN 3.4: «ресепшн-стойка»)
    { id: 'reception', shape: 'rect', x: 29, y: 23, w: 6, h: 2, front: 24, blockMove: true, blockBullets: true },
  ],
  spawn: { x: 32 * T, y: 46 * T }, // южное крыло, центр (безопасная зона)
  exit: { x: 32 * T, y: 1 * T, r: 48, label: 'ЛИФТ' }, // северное крыло — лифт
  clear: { type: 'kill_all' },
  enemies: [
    // Северное крыло (охрана лифта)
    { type: 'sentry', x: 864, y: 32, patrol: [{ x: 864, y: 32 }, { x: 1056, y: 32 }] },
    { type: 'sentry', x: 1184, y: 32, patrol: [{ x: 1184, y: 32 }, { x: 992, y: 32 }] },
    // Южное крыло (у старта)
    { type: 'sentry', x: 864, y: 1472, patrol: [{ x: 864, y: 1472 }, { x: 1056, y: 1472 }] },
    { type: 'sentry', x: 1184, y: 1472, patrol: [{ x: 1184, y: 1472 }, { x: 992, y: 1472 }] },
    // Западное крыло
    { type: 'sentry', x: 64, y: 576, patrol: [{ x: 64, y: 576 }, { x: 64, y: 832 }] },
    { type: 'sentry', x: 128, y: 608, patrol: [{ x: 128, y: 608 }, { x: 128, y: 896 }] },
    // Восточное крыло
    { type: 'sentry', x: 1984, y: 576, patrol: [{ x: 1984, y: 576 }, { x: 1984, y: 832 }] },
    { type: 'sentry', x: 1920, y: 608, patrol: [{ x: 1920, y: 608 }, { x: 1920, y: 896 }] },
    // Главный зал, у колонн
    { type: 'sentry', x: 992, y: 704, patrol: [{ x: 992, y: 704 }, { x: 1056, y: 704 }] },
    { type: 'sentry', x: 1056, y: 832, patrol: [{ x: 1056, y: 832 }, { x: 992, y: 832 }] },
    // Регистраторы ×2 по длинной оси зала (север-юг), бьют по прямым
    { type: 'gunner', x: 1024, y: 256, post: { x: 1024, y: 256 } },
    { type: 'gunner', x: 1024, y: 1248, post: { x: 1024, y: 1248 } },
  ],
  boss: null,
};
