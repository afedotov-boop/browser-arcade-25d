// L2 «Атриум» (DESIGN 3.4, уровень 2): оранжерея под стеклянным куполом — овальный сад
// с круглой центральной площадью, 2-полосными дорожками и топиарными «островками».
// TEAM_DECISION: «~70×50» из DESIGN превышает жёсткий лимит валидатора 64×48 (ARCH §5.3),
// поэтому сад сжат до 64×48; форма сохранена: купол = граница 2 тайла + срезанные углы
// 12×12 (октагон-«овал»), центр — круглая площадь с фонтанами.
// 16 врагов: смотритель ×6 (по 1 у каждой живой изгороди, стреляют из укрытий),
// стартап ×8 (4 пары по периметру, патруль вдоль кольца сада), регистратор ×2
// (углы купола СВ/ЮЗ, бьют по длинным осям). Старт — центральная площадь
// (безопасная зона 5s); выход — грузовой лифт на севере, появляется после зачистки (kill_all).
// Проходимость: патрульные линии и прямые линии преследования к центру не пересекают
// фонтаны/изгороди — проверено кодом.
const T = 32; // tile
export default {
  version: 1, id: 'l2', name: 'АТРИУМ', music: 'l2',
  size: { w: 64, h: 48 },
  floor: 'chess_teal', // кремовая база + бирюзовые квадраты (DESIGN 2.3: тёплая зелень)
  tint: { color: '#3FA34D', amount: 0.08 }, // зелёный +8%
  walls: [
    // Купол: непреодолимая граница 2 тайла (DESIGN 3.4: «стены = купол»)
    { x: 0, y: 0, w: 64, h: 2 },   // север
    { x: 0, y: 46, w: 64, h: 2 },  // юг
    { x: 0, y: 2, w: 2, h: 44 },   // запад
    { x: 62, y: 2, w: 2, h: 44 },  // восток
    // «Овал»: срезанные углы 12×12
    { x: 2, y: 2, w: 12, h: 12 },  // СЗ
    { x: 50, y: 2, w: 12, h: 12 }, // СВ
    { x: 2, y: 34, w: 12, h: 12 }, // ЮЗ
    { x: 50, y: 34, w: 12, h: 12 } // ЮВ
  ],
  cover: [
    // Фонтаны (2×2): блокируют движение, НЕ блокируют пули (DESIGN 3.4) — центральная площадь
    { id: 'f1', shape: 'rect', x: 28, y: 20, w: 2, h: 2, front: 24, blockMove: true, blockBullets: false },
    { id: 'f2', shape: 'rect', x: 34, y: 20, w: 2, h: 2, front: 24, blockMove: true, blockBullets: false },
    { id: 'f3', shape: 'rect', x: 28, y: 28, w: 2, h: 2, front: 24, blockMove: true, blockBullets: false },
    { id: 'f4', shape: 'rect', x: 34, y: 28, w: 2, h: 2, front: 24, blockMove: true, blockBullets: false },
    { id: 'f5', shape: 'rect', x: 31, y: 11, w: 2, h: 2, front: 24, blockMove: true, blockBullets: false },
    { id: 'f6', shape: 'rect', x: 31, y: 35, w: 2, h: 2, front: 24, blockMove: true, blockBullets: false },
    // Живые изгороди (блокируют и пули, и движение) — «островки» смотрителей
    { id: 'h1', shape: 'rect', x: 18, y: 14, w: 3, h: 1, front: 24, blockMove: true, blockBullets: true },
    { id: 'h2', shape: 'rect', x: 43, y: 14, w: 3, h: 1, front: 24, blockMove: true, blockBullets: true },
    { id: 'h3', shape: 'rect', x: 11, y: 22, w: 1, h: 3, front: 24, blockMove: true, blockBullets: true },
    { id: 'h4', shape: 'rect', x: 52, y: 22, w: 1, h: 3, front: 24, blockMove: true, blockBullets: true },
    { id: 'h5', shape: 'rect', x: 18, y: 33, w: 3, h: 1, front: 24, blockMove: true, blockBullets: true },
    { id: 'h6', shape: 'rect', x: 43, y: 33, w: 3, h: 1, front: 24, blockMove: true, blockBullets: true }
  ],
  spawn: { x: 32 * T, y: 24 * T }, // центральная площадь (безопасная зона 5s)
  exit: { x: 32 * T, y: 2 * T, r: 48, label: 'ЛИФТ' }, // север — грузовой лифт (появляется после зачистки)
  clear: { type: 'kill_all' },
  enemies: [
    // Смотрители ×6 — в живых изгородях: патруль за изгородью, стреляют из укрытий
    { type: 'sentry', x: 20 * T, y: 16 * T, patrol: [{ x: 20 * T, y: 16 * T }, { x: 20 * T, y: 18 * T }] },
    { type: 'sentry', x: 44 * T, y: 16 * T, patrol: [{ x: 44 * T, y: 16 * T }, { x: 44 * T, y: 18 * T }] },
    { type: 'sentry', x: 13 * T, y: 23 * T, patrol: [{ x: 13 * T, y: 23 * T }, { x: 15 * T, y: 23 * T }] },
    { type: 'sentry', x: 50 * T, y: 23 * T, patrol: [{ x: 50 * T, y: 23 * T }, { x: 48 * T, y: 23 * T }] },
    { type: 'sentry', x: 20 * T, y: 31 * T, patrol: [{ x: 20 * T, y: 31 * T }, { x: 20 * T, y: 29 * T }] },
    { type: 'sentry', x: 44 * T, y: 31 * T, patrol: [{ x: 44 * T, y: 31 * T }, { x: 44 * T, y: 29 * T }] },
    // Стартапы ×8 — парами по периметру (4 пары), «бегут» по кругу, давят с тыла
    { type: 'stalker', x: 24 * T, y: 4 * T, patrol: [{ x: 22 * T, y: 4 * T }, { x: 42 * T, y: 4 * T }] },
    { type: 'stalker', x: 40 * T, y: 4 * T, patrol: [{ x: 22 * T, y: 4 * T }, { x: 42 * T, y: 4 * T }] },
    { type: 'stalker', x: 24 * T, y: 44 * T, patrol: [{ x: 22 * T, y: 44 * T }, { x: 42 * T, y: 44 * T }] },
    { type: 'stalker', x: 40 * T, y: 44 * T, patrol: [{ x: 22 * T, y: 44 * T }, { x: 42 * T, y: 44 * T }] },
    { type: 'stalker', x: 4 * T, y: 20 * T, patrol: [{ x: 4 * T, y: 18 * T }, { x: 4 * T, y: 30 * T }] },
    { type: 'stalker', x: 4 * T, y: 28 * T, patrol: [{ x: 4 * T, y: 18 * T }, { x: 4 * T, y: 30 * T }] },
    { type: 'stalker', x: 60 * T, y: 20 * T, patrol: [{ x: 60 * T, y: 18 * T }, { x: 60 * T, y: 30 * T }] },
    { type: 'stalker', x: 60 * T, y: 28 * T, patrol: [{ x: 60 * T, y: 18 * T }, { x: 60 * T, y: 30 * T }] },
    // Регистраторы ×2 — в углах купола (СВ, ЮЗ), бьют по длинным осям
    { type: 'gunner', x: 49 * T, y: 14 * T, post: { x: 49 * T, y: 14 * T } },
    { type: 'gunner', x: 14 * T, y: 34 * T, post: { x: 14 * T, y: 34 * T } }
  ],
  boss: null
};
