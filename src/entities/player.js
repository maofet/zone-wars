import { PLAYER } from '../config.js';

export class Player {
  constructor(id, color, glow, start) {
    this.id = id;
    this.color = color;
    this.glow = glow;
    this.x = start.x;
    this.y = start.y;
    this.vx = 0;
    this.vy = 0;
    this.radius = PLAYER.radius;
    this.score = 0;
    this.freezeTimer = 0;
    this.cooldownTimer = 0;
    this.pushSlide = null; // {fromX, fromY, toX, toY, elapsed, duration}
  }

  isFrozen() {
    return this.freezeTimer > 0;
  }

  canPush() {
    return this.cooldownTimer <= 0;
  }

  reset(start) {
    this.x = start.x;
    this.y = start.y;
    this.vx = 0;
    this.vy = 0;
    this.score = 0;
    this.freezeTimer = 0;
    this.cooldownTimer = 0;
    this.pushSlide = null;
  }
}
