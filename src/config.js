export const CANVAS = { width: 960, height: 540 };

export const GRID = { cellSize: 40 };

export const PLAYER = {
  radius: 18,
  speed: 220,
  pushRange: 50,
  pushDistance: 40,
  pushSlideDuration: 0.12,
  freezeDuration: 1.0,
  pushCooldown: 5.0,
};

export const SCORING = {
  tickInterval: 1.0,
  defaultTarget: 100,
  milestoneInterval: 10,
};

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
  { x: 460, y: 80, w: 40, h: 40 },
  { x: 460, y: 160, w: 40, h: 40 },
  { x: 340, y: 250, w: 40, h: 40 },
  { x: 580, y: 250, w: 40, h: 40 },
  { x: 460, y: 360, w: 40, h: 40 },
  { x: 460, y: 440, w: 40, h: 40 },
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
