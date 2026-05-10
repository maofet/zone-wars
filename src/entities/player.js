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
    this.score = 0; // stored in tenths: 10 = 1.0 displayed
    this.freezeTimer = 0;
    this.cooldownTimer = 0;
    this.pushSlide = null; // {fromX, fromY, toX, toY, elapsed, duration}
    this.opponentZoneTimer = 0; // seconds the player has been inside opponent's zone
    this.shieldTimer = 0; // seconds remaining of shield power-up
    this.speedTimer = 0; // seconds remaining of speed power-up (2x movement)
    this.teleportPunchReady = false; // single-use: next push teleports target to their own zone
    this.alive = true;
    this.avatar = '★'; // default; assigned at avatar-select step
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
    this.opponentZoneTimer = 0;
    this.shieldTimer = 0;
    this.speedTimer = 0;
    this.teleportPunchReady = false;
    this.alive = true;
  }
}
