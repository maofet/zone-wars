export const CANVAS = { width: 960, height: 540 };

// Per-player-count map sizes and entity tuning.
export const MAP_SIZES = {
  2: { width: 960,  height: 540 },
  3: { width: 1080, height: 600 },
  4: { width: 1200, height: 660 },
  5: { width: 1320, height: 720 },
  6: { width: 1440, height: 780 },
};

export const ENTITY_SCALING = {
  2: { boxes: 13, minesPerSpawn: 2, minesMax: 20 },
  3: { boxes: 15, minesPerSpawn: 2, minesMax: 25 },
  4: { boxes: 17, minesPerSpawn: 3, minesMax: 30 },
  5: { boxes: 19, minesPerSpawn: 3, minesMax: 35 },
  6: { boxes: 21, minesPerSpawn: 4, minesMax: 40 },
};

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
// zoneScoreTenths              = 1  means +0.1 displayed per tick.
// pushHitTenthsBase            = 10 means +1.0 base reward per successful push.
// pushHitTenthsPerMinute       = 10 means +1.0 added per elapsed match-minute.
// pushHitTenthsMax             = 30 means push reward capped at +3.0.
// minePenaltyTenthsBase        = 10 means -1.0 base penalty per mine hit.
// minePenaltyTenthsPerMinute   = 5  means -0.5 added per elapsed match-minute.
// minePenaltyTenthsMax         = 50 means mine penalty capped at -5.0.
export const SCORING = {
  tickInterval: 1.0,
  defaultTarget: 100,
  zoneScoreTenths: 1,
  pushHitTenthsBase: 10,
  pushHitTenthsPerMinute: 10,
  pushHitTenthsMax: 30,
  minePenaltyTenthsBase: 10,
  minePenaltyTenthsPerMinute: 5,
  minePenaltyTenthsMax: 50,
};

// Seconds a player can stay in the opponent's zone before being teleported back to their own zone.
export const ZONE_EJECT_TIME = 5.0;

export const MINE = {
  spawnInterval: 5.0,
  perSpawn: 2,
  maxOnMap: 20,
  radius: 8,
  triggerDistance: 30,   // player center within this many px triggers explosion
  lifetime: 30.0,        // seconds before a mine auto-detonates
  explosionRadius: 75,   // 2 cm at ~96 DPI - chains other mines and damages nearby players
};

// Score below this (in tenths) makes the player lose. -100 = -10.0 displayed.
export const LOSE_SCORE_TENTHS = -100;

export const POWERUP = {
  spawnInterval: 20.0,
  radius: 14,
  pickupDistance: 30,
  duration: 3.0, // seconds for shield/speed
  types: ['shield', 'speed', 'teleport'],
};

export const RANDOM_BOXES = {
  count: 13,
  cellSize: 40,
  zonePadding: 20,    // extra px around zones to keep clear
  startPadding: 60,   // extra px around player starts to keep clear
};

export const COUNTDOWN_SECONDS = 3;

export const ZONES = {
  red: { x: 160, y: 270, radius: 80, color: '#ff3060', glow: '#ff6080' },
  blue: { x: 800, y: 270, radius: 80, color: '#30b0ff', glow: '#60c8ff' },
};

export const ZONE_COLORS = [
  { color: '#ff3060', glow: '#ff6080', name: 'red' },
  { color: '#30b0ff', glow: '#60c8ff', name: 'blue' },
  { color: '#40d060', glow: '#70e090', name: 'green' },
  { color: '#ffd040', glow: '#ffe080', name: 'yellow' },
  { color: '#d040ff', glow: '#e080ff', name: 'purple' },
  { color: '#40e0d0', glow: '#80f0e0', name: 'cyan' },
];

// Returns N zone center positions distributed around the play area perimeter.
export function computeZonePositions(playerCount, canvasW, canvasH, zoneRadius) {
  const cx = canvasW / 2;
  const cy = canvasH / 2;
  const rx = canvasW / 2 - zoneRadius - 20;
  const ry = canvasH / 2 - zoneRadius - 20;
  if (playerCount === 2) {
    return [
      { x: cx - rx, y: cy },
      { x: cx + rx, y: cy },
    ];
  }
  const positions = [];
  for (let i = 0; i < playerCount; i++) {
    const angle = -Math.PI / 2 + (i / playerCount) * Math.PI * 2;
    positions.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
  }
  return positions;
}

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
