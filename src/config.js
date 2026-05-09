export const CANVAS = { width: 960, height: 540 };

export const GRID = { cellSize: 40 };

export const PLAYER = {
  radius: 18,
  speed: 220,
  pushRange: 60,
  pushDistance: 100,
  pushSlideDuration: 0.20,
  freezeDuration: 1.0,
  pushCooldown: 5.0,
};

// Score is stored internally in tenths so we can do integer math.
// zoneScoreTenths = 1 means +0.1 displayed per tick.
// pushHitTenths   = 10 means +1.0 displayed per successful push.
export const SCORING = {
  tickInterval: 1.0,
  defaultTarget: 100,
  zoneScoreTenths: 1,
  pushHitTenths: 10,
};

// Seconds a player can stay in the opponent's zone before being teleported back to their own zone.
export const ZONE_EJECT_TIME = 5.0;

export const COUNTDOWN_SECONDS = 3;

export const ZONES = {
  red: { x: 160, y: 270, radius: 80, color: '#ff3060', glow: '#ff6080' },
  blue: { x: 800, y: 270, radius: 80, color: '#30b0ff', glow: '#60c8ff' },
};

export const STARTS = {
  p1: { x: 480, y: 60 },
  p2: { x: 480, y: 480 },
};

export const BOXES = [
  // Top row: corner posts + center pillar top
  { x: 240, y: 80, w: 40, h: 40 },
  { x: 460, y: 80, w: 40, h: 40 },
  { x: 720, y: 80, w: 40, h: 40 },
  // Center pillar (vertical chain)
  { x: 460, y: 140, w: 40, h: 40 },
  { x: 460, y: 240, w: 40, h: 40 },
  { x: 460, y: 360, w: 40, h: 40 },
  // Mid: cover above and below each zone
  { x: 280, y: 200, w: 40, h: 40 },
  { x: 680, y: 200, w: 40, h: 40 },
  { x: 280, y: 320, w: 40, h: 40 },
  { x: 680, y: 320, w: 40, h: 40 },
  // Bottom row: corner posts + center pillar bottom
  { x: 240, y: 420, w: 40, h: 40 },
  { x: 460, y: 420, w: 40, h: 40 },
  { x: 720, y: 420, w: 40, h: 40 },
];

export const COLORS = {
  bg: '#0a0a18',
  grid: '#1a1a3a',
  boxFill: '#1a1a2a',
  boxStroke: '#a0e0ff',
  textBright: '#ffffff',
  textDim: '#a0a0c0',
};

export const KEYS = {
  p1: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', push: 'ShiftLeft' },
  p2: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', push: 'Enter' },
  pause: 'Space',
};

export const STORAGE_KEY = 'zoneWarsSettings';
