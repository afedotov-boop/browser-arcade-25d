// ЕДИНЫЙ источник чисел (ARCHITECTURE §4.1). Числа транскрипция из docs/DESIGN.md §2.2/2.4/2.5/3.1–3.2.
export const TILE = 32;
export const SIM_STEP = 1 / 60;
export const MAX_STEPS = 5;
export const MAX_DPR = 2;
export const DT_CLAMP = 0.25;
export const VIEWPORT = { w: 960, h: 540 };

export const PLAYER = {
  speed: 260,        // DESIGN 3.1
  hp: 2,             // DESIGN 3.1 (2 попадания; 3-е = смерть)
  radius: 16,
  viewHeight: 64,    // DESIGN 2.5/2.4
  bulletSpeed: 720,
  bulletDmg: 1,
  bulletLife: 1.2,
  fireRate: 5,       // 5/с = cd 0.2s
  spreadDeg: 2,
  reloadTime: 1.1,
  ammo: 8,
  iframe: 1.5,
  muzzleOffset: 30,  // muzzle выше стоп (DESIGN 2.5.8)
  flash: 0.06,       // дульная вспышка 60ms
  tracer: { w: 14, h: 4 },
  blinkOn: 0.05, blinkOff: 0.033 // мигание i-frames (~0.1s × 12)
};

export const ENEMIES = {
  // DESIGN 3.2: обнаружение конус 100°, 260px, delay 0.4s (общее)
  sight: { coneDeg: 100, radius: 260, delay: 0.4 },
  sentry: {
    hp: 2, speed: 110, radius: 16, viewHeight: 60, width: 48,
    volley: 3, spreadDeg: 12, gap: 0.15, bulletSpeed: 720,
    rangeMin: 150, rangeMax: 300,
    aimTelegraph: 0.5,
    meleeRange: 40, meleeWindup: 0.6
  },
  stalker: {
    hp: 1, speed: 270, radius: 14, viewHeight: 52, width: 36,
    wakeRadius: 200, meleeRange: 40, meleeCooldown: 1.2
  },
  gunner: {
    hp: 1, speed: 80, radius: 16, viewHeight: 72, width: 44,
    range: 420, telegraph: 1.0,
    volley: 3, spreadDeg: 8, gap: 0.12, bulletSpeed: 800,
    pauseAfter: 0.8
  }
};

export const BOSS = {
  hp: 30, speed: { walk: 90, phase3: 140 }, radius: 30, viewHeight: 128, width: 96,
  phaseHp: [20, 10],
  p1: { volleyEvery: 6, volley: 3, spreadDeg: 15, gap: 0.2, telegraph: 0.8,
       summonEvery: 12, summonCount: 2, summonMax: 4, portalTime: 1.0,
       summonAngleDeg: 60, summonDist: 120 },
  p2: { beamSpeedDeg: 180, active: 8, calm: 2, beamLen: 4000 },
  p3: { shield: 8, core: 4, sparkSpeed: 180, sparkCount: 2, sparkEvery: 6,
       sparkTurnDeg: 30, sparkLife: 3, dashTelegraph: 1.0, dashSpeed: 400, dashLinger: 0.5 },
  dashLen: 0.3
};

export const PALETTE = {
  cream: '#F2E8CF',
  petrole: '#1E3A4C',
  orange: '#E8622C',
  mustard: '#E8A33C',
  teal: '#2FB8A6',
  night: '#3A2E4F',
  chrome: '#C7CDD6',
  neonPink: '#FF4D88',
  red: '#E03131',
  outline: '#241F2E',
  shadowGray: 'rgba(20,16,28,0.35)',
  wallTop: '#54707F',
  wallFront: '#16303E',
  chromeEdge: '#C7CDD6',
  playerSuit: '#F2E8CF',
  playerVisor: '#E8622C',
  playerBoots: '#1E3A4C',
  playerCase: '#E8A33C',
  sentryBody: '#5A6B7A',
  sentryShield: '#C7CDD6',
  sentryVisor: '#FFB84D',
  stalkerBody: '#2A6B3C',
  stalkerSpark: '#FFD23C',
  gunnerBody: '#5A6B7A',
  gunnerEye: '#FF4D88',
  bossSuit: '#1E3A4C',
  bossTubes: '#FFB84D',
  floors: {
    chess_cream: ['#F2E8CF', '#D8C9A3'],
    chess_teal: ['#F2E8CF', '#2FB8A6'],
    chess_mixed: ['#F2E8CF', '#C9B98F'],
    dev: ['#F2E8CF', '#C9B98F']
  }
};

export const LEVELS = [
  { id: 'l1', name: 'ЛОББИ', music: 'l1', seed: 101 },
  { id: 'l2', name: 'АТРИУМ', music: 'l2', seed: 102 },
  { id: 'l3', name: 'МЕРИДИАН', music: 'l3', seed: 103 }
];

export const DEV_LEVEL = { id: 'dev', name: 'ТЕСТОВАЯ АРЕНА', music: 'menu', seed: 7 };

export const VIEW_HEIGHTS = { player: 64, sentry: 60, stalker: 52, gunner: 72, boss: 128 };

export const SHADOW = { alpha: 0.35, offset: { x: 5, y: 5 }, w: 0.6, h: 0.2 }; // DESIGN 2.5.4

export const COLORS = {
  floor: '#F2E8CF',
  floorAlt: '#D8C9A3',
  gridLine: 'rgba(200,185,143,0.25)',
  wallFront: '#1E3A4C',
  wallTop: '#54707F',
  coverBody: '#C7CDD6',
  coverFront: '#9AA3AE',
  coverEdge: '#E8A33C'
};

// ---- аудио-палитры (DESIGN 5.1) ----
export const AUDIO_TRACKS = {
  menu: { bpm: 85, bars: 4, mood: 'calm' },
  l1: { bpm: 105, bars: 8, mood: 'tense' },
  l2: { bpm: 120, bars: 8, mood: 'playful' },
  l3: { bpm: 70, bars: 8, mood: 'dark' },
  boss: { bpm: 140, bars: 8, mood: 'funk' },
  death: { bpm: 60, bars: 1, mood: 'sting' },
  victory: { bpm: 90, bars: 4, mood: 'warm' }
};
