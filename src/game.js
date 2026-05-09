import {
  CANVAS, ZONES, STARTS, PLAYER, SCORING, COUNTDOWN_SECONDS, KEYS, ZONE_EJECT_TIME,
  MINE, POWERUP, RANDOM_BOXES, LOSE_SCORE_TENTHS,
} from './config.js';
import { Player } from './entities/player.js';
import { Box } from './entities/box.js';
import { Zone } from './entities/zone.js';
import {
  clampToBounds, resolveCircleVsBoxes, resolveCircleVsCircle,
  detectPushTarget, computePushTarget,
} from './physics.js';

const STATE = {
  MENU: 'menu',
  SETTINGS: 'settings',
  HOW_TO_PLAY: 'how_to_play',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
};

const MENU_ITEMS = ['Start Game', 'Settings', 'How to Play'];

export class Game {
  constructor(renderer, ui, audio, input) {
    this.renderer = renderer;
    this.ui = ui;
    this.audio = audio;
    this.input = input;

    this.zones = {
      red: new Zone(ZONES.red, 'red'),
      blue: new Zone(ZONES.blue, 'blue'),
    };
    this.p1 = new Player('red', ZONES.red.color, ZONES.red.glow, STARTS.p1);
    this.p2 = new Player('blue', ZONES.blue.color, ZONES.blue.glow, STARTS.p2);
    this.boxes = this._generateRandomBoxes();

    this.mines = [];
    this.mineSpawnTimer = 0;
    this.powerUps = [];
    this.powerUpSpawnTimer = 0;

    this.state = STATE.MENU;
    this.scoreAccumulator = 0;
    this.matchTime = 0;
    this.countdownRemaining = COUNTDOWN_SECONDS;
    this.lastCountdownInt = COUNTDOWN_SECONDS + 1;
    this.winner = null;
    this.lastTimestamp = null;

    this.input.on('blur', () => {
      if (this.state === STATE.PLAYING) this.state = STATE.PAUSED;
    });
  }

  start() {
    this.lastTimestamp = performance.now();
    requestAnimationFrame(this._frame);
  }

  _frame = (now) => {
    const dt = Math.min((now - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = now;
    this.update(dt);
    this.render();
    this.input.endFrame();
    requestAnimationFrame(this._frame);
  };

  // -------- state transitions --------

  startMatch() {
    this.audio.init();
    this.p1.reset(STARTS.p1);
    this.p2.reset(STARTS.p2);
    this.boxes = this._generateRandomBoxes();
    this.mines = [];
    this.mineSpawnTimer = 0;
    this.powerUps = [];
    this.powerUpSpawnTimer = 0;
    this.scoreAccumulator = 0;
    this.matchTime = 0;
    this.countdownRemaining = COUNTDOWN_SECONDS;
    this.lastCountdownInt = COUNTDOWN_SECONDS + 1;
    this.winner = null;
    this.state = STATE.COUNTDOWN;
  }

  _minuteIndex() {
    return Math.floor(this.matchTime / 60);
  }

  _currentPushBonus() {
    const raw = SCORING.pushHitTenthsBase + this._minuteIndex() * SCORING.pushHitTenthsPerMinute;
    const cap = (this.ui.settings.pushMax ?? 5) * 10;
    return Math.min(cap, raw);
  }

  _currentMinePenalty() {
    const raw = SCORING.minePenaltyTenthsBase + this._minuteIndex() * SCORING.minePenaltyTenthsPerMinute;
    const cap = (this.ui.settings.mineMax ?? 5) * 10;
    return Math.min(cap, raw);
  }

  _generateRandomBoxes() {
    const { cellSize, count, zonePadding, startPadding } = RANDOM_BOXES;
    const cols = Math.floor(CANVAS.width / cellSize);
    const rows = Math.floor(CANVAS.height / cellSize);
    const candidates = [];
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        const x = cx * cellSize;
        const y = cy * cellSize;
        const centerX = x + cellSize / 2;
        const centerY = y + cellSize / 2;
        const distRed = Math.hypot(centerX - ZONES.red.x, centerY - ZONES.red.y);
        const distBlue = Math.hypot(centerX - ZONES.blue.x, centerY - ZONES.blue.y);
        if (distRed < ZONES.red.radius + zonePadding) continue;
        if (distBlue < ZONES.blue.radius + zonePadding) continue;
        const distP1 = Math.hypot(centerX - STARTS.p1.x, centerY - STARTS.p1.y);
        const distP2 = Math.hypot(centerX - STARTS.p2.x, centerY - STARTS.p2.y);
        if (distP1 < startPadding) continue;
        if (distP2 < startPadding) continue;
        candidates.push({ x, y, w: cellSize, h: cellSize });
      }
    }
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    return candidates.slice(0, count).map(b => new Box(b));
  }

  // -------- update --------

  update(dt) {
    switch (this.state) {
      case STATE.MENU:        return this._updateMenu();
      case STATE.SETTINGS:    return this._updateSettings();
      case STATE.HOW_TO_PLAY: return this._updateHowToPlay();
      case STATE.COUNTDOWN:   return this._updateCountdown(dt);
      case STATE.PLAYING:     return this._updatePlaying(dt);
      case STATE.PAUSED:      return this._updatePaused();
      case STATE.GAME_OVER:   return this._updateGameOver();
    }
  }

  _updateMenu() {
    if (this.input.pressed.has('ArrowUp')) {
      this.ui.menuSelection = (this.ui.menuSelection - 1 + MENU_ITEMS.length) % MENU_ITEMS.length;
    }
    if (this.input.pressed.has('ArrowDown')) {
      this.ui.menuSelection = (this.ui.menuSelection + 1) % MENU_ITEMS.length;
    }
    if (this.input.pressed.has('Enter') || this.input.pressed.has('Space')) {
      const choice = MENU_ITEMS[this.ui.menuSelection];
      if (choice === 'Start Game') this.startMatch();
      else if (choice === 'Settings') this.state = STATE.SETTINGS;
      else if (choice === 'How to Play') this.state = STATE.HOW_TO_PLAY;
    }
  }

  _updateSettings() {
    const items = 5; // target, sound, push max, mine max, back
    if (this.input.pressed.has('ArrowUp'))   this.ui.settingsSelection = (this.ui.settingsSelection - 1 + items) % items;
    if (this.input.pressed.has('ArrowDown')) this.ui.settingsSelection = (this.ui.settingsSelection + 1) % items;
    if (this.ui.settingsSelection === 0) {
      if (this.input.pressed.has('ArrowLeft'))  this.ui.cycleTarget(-1);
      if (this.input.pressed.has('ArrowRight')) this.ui.cycleTarget(+1);
    }
    if (this.ui.settingsSelection === 1 && this.input.pressed.has('Enter')) {
      this.ui.toggleMuted();
      this.audio.setMuted(this.ui.settings.muted);
    }
    if (this.ui.settingsSelection === 2) {
      if (this.input.pressed.has('ArrowLeft'))  this.ui.cyclePushMax(-1);
      if (this.input.pressed.has('ArrowRight')) this.ui.cyclePushMax(+1);
    }
    if (this.ui.settingsSelection === 3) {
      if (this.input.pressed.has('ArrowLeft'))  this.ui.cycleMineMax(-1);
      if (this.input.pressed.has('ArrowRight')) this.ui.cycleMineMax(+1);
    }
    if (this.ui.settingsSelection === 4 && this.input.pressed.has('Enter')) {
      this.state = STATE.MENU;
    }
    if (this.input.pressed.has('Escape')) this.state = STATE.MENU;
  }

  _updateHowToPlay() {
    if (this.input.pressed.size > 0) this.state = STATE.MENU;
  }

  _updateCountdown(dt) {
    this.countdownRemaining -= dt;
    const intRemaining = Math.ceil(this.countdownRemaining);
    if (intRemaining < this.lastCountdownInt && intRemaining >= 1) {
      this.audio.countdownTick();
    }
    this.lastCountdownInt = intRemaining;
    if (this.countdownRemaining <= 0) {
      this.audio.countdownGo();
      this.state = STATE.PLAYING;
    }
  }

  _updatePlaying(dt) {
    if (this.input.pausePressed()) {
      this.state = STATE.PAUSED;
      return;
    }

    this._updatePlayer(this.p1, KEYS.p1, this.p2, dt);
    this._updatePlayer(this.p2, KEYS.p2, this.p1, dt);

    this._resolvePushes();

    this._tickMines(dt);
    this._tickPowerUps(dt);
    this._checkMineCollisions();
    this._checkPowerUpCollisions();

    this.renderer.updateParticles(dt);

    this._tickScoring(dt);

    this._checkZoneEjection(dt);

    this.matchTime += dt;

    this._checkWin();
  }

  _updatePlayer(player, binding, opponent, dt) {
    // tick timers
    if (player.freezeTimer > 0) player.freezeTimer = Math.max(0, player.freezeTimer - dt);
    if (player.cooldownTimer > 0) player.cooldownTimer = Math.max(0, player.cooldownTimer - dt);
    if (player.shieldTimer > 0) player.shieldTimer = Math.max(0, player.shieldTimer - dt);
    if (player.speedTimer > 0) player.speedTimer = Math.max(0, player.speedTimer - dt);

    // push slide animation overrides input movement
    if (player.pushSlide) {
      const s = player.pushSlide;
      s.elapsed += dt;
      const t = Math.min(1, s.elapsed / s.duration);
      const tx = s.fromX + (s.toX - s.fromX) * t;
      const ty = s.fromY + (s.toY - s.fromY) * t;
      const old = { x: player.x, y: player.y };
      let next = resolveCircleVsBoxes(old, { x: tx, y: ty }, player.radius, this.boxes);
      next = clampToBounds(next, player.radius, { w: CANVAS.width, h: CANVAS.height });
      next = resolveCircleVsCircle(old, next, player.radius, opponent, opponent.radius);
      player.x = next.x;
      player.y = next.y;
      if (t >= 1) player.pushSlide = null;
      return;
    }

    if (player.isFrozen()) return;

    const v = this.input.movement(binding);
    const old = { x: player.x, y: player.y };
    const speedMul = player.speedTimer > 0 ? 2 : 1;
    const desired = {
      x: player.x + v.x * PLAYER.speed * speedMul * dt,
      y: player.y + v.y * PLAYER.speed * speedMul * dt,
    };
    let next = resolveCircleVsBoxes(old, desired, player.radius, this.boxes);
    next = clampToBounds(next, player.radius, { w: CANVAS.width, h: CANVAS.height });
    next = resolveCircleVsCircle(old, next, player.radius, opponent, opponent.radius);
    player.x = next.x;
    player.y = next.y;
  }

  _resolvePushes() {
    // snapshot positions so simultaneous pushes use start-of-frame state
    const p1Pos = { x: this.p1.x, y: this.p1.y };
    const p2Pos = { x: this.p2.x, y: this.p2.y };
    const p1Push = this.input.pushPressed(KEYS.p1) && this.p1.canPush() && !this.p1.isFrozen();
    const p2Push = this.input.pushPressed(KEYS.p2) && this.p2.canPush() && !this.p2.isFrozen();

    if (p1Push) this._applyPush(this.p1, this.p2, p1Pos, p2Pos);
    if (p2Push) this._applyPush(this.p2, this.p1, p2Pos, p1Pos);
  }

  _applyPush(attacker, target, attackerPos, targetPos) {
    attacker.cooldownTimer = PLAYER.pushCooldown;
    if (!detectPushTarget(attackerPos, targetPos, PLAYER.pushRange)) return;

    // Shield blocks the attack entirely. Attacker still pays cooldown but gets no score.
    if (target.shieldTimer > 0) {
      this.audio.pushImpact();
      this.renderer.spawnPushParticles(target.x, target.y, '#ffffff');
      return;
    }

    target.freezeTimer = PLAYER.freezeDuration;
    this.audio.pushImpact();
    attacker.score += this._currentPushBonus();

    if (attacker.teleportPunchReady) {
      attacker.teleportPunchReady = false;
      const ownZone = target.id === 'red' ? this.zones.red : this.zones.blue;
      target.x = ownZone.x;
      target.y = ownZone.y;
      target.pushSlide = null;
      this.renderer.spawnPushParticles(ownZone.x, ownZone.y, target.color);
    } else {
      const to = computePushTarget(attackerPos, targetPos, PLAYER.pushDistance);
      target.pushSlide = {
        fromX: target.x,
        fromY: target.y,
        toX: to.x,
        toY: to.y,
        elapsed: 0,
        duration: PLAYER.pushSlideDuration,
      };
      const midX = (attackerPos.x + targetPos.x) / 2;
      const midY = (attackerPos.y + targetPos.y) / 2;
      this.renderer.spawnPushParticles(midX, midY, target.color);
    }
  }

  _findOpenPosition(radius, minPlayerDistance, avoidZones = false) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const x = radius + Math.random() * (CANVAS.width - radius * 2);
      const y = radius + Math.random() * (CANVAS.height - radius * 2);
      let onBox = false;
      for (const box of this.boxes) {
        if (x + radius > box.x && x - radius < box.x + box.w &&
            y + radius > box.y && y - radius < box.y + box.h) {
          onBox = true; break;
        }
      }
      if (onBox) continue;
      const d1 = Math.hypot(x - this.p1.x, y - this.p1.y);
      const d2 = Math.hypot(x - this.p2.x, y - this.p2.y);
      if (d1 < minPlayerDistance || d2 < minPlayerDistance) continue;
      if (avoidZones) {
        const dRed = Math.hypot(x - this.zones.red.x, y - this.zones.red.y);
        const dBlue = Math.hypot(x - this.zones.blue.x, y - this.zones.blue.y);
        if (dRed < this.zones.red.radius + radius) continue;
        if (dBlue < this.zones.blue.radius + radius) continue;
      }
      return { x, y };
    }
    return null;
  }

  _tickMines(dt) {
    // age existing mines; auto-detonate at lifetime
    for (let i = this.mines.length - 1; i >= 0; i--) {
      this.mines[i].age = (this.mines[i].age || 0) + dt;
      if (this.mines[i].age >= MINE.lifetime) {
        const m = this.mines[i];
        this.mines.splice(i, 1);
        this._processMineExplosion(m);
      }
    }
    // spawn new mines
    this.mineSpawnTimer += dt;
    if (this.mineSpawnTimer >= MINE.spawnInterval) {
      this.mineSpawnTimer -= MINE.spawnInterval;
      const slots = Math.max(0, MINE.maxOnMap - this.mines.length);
      const toSpawn = Math.min(MINE.perSpawn, slots);
      for (let i = 0; i < toSpawn; i++) {
        const pos = this._findOpenPosition(MINE.radius, 60, true);
        if (pos) this.mines.push({ x: pos.x, y: pos.y, age: 0 });
      }
    }
  }

  _checkMineCollisions() {
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i];
      let triggered = false;
      for (const p of [this.p1, this.p2]) {
        if (p.shieldTimer > 0) continue;
        const d = Math.hypot(p.x - m.x, p.y - m.y);
        if (d < MINE.triggerDistance) {
          triggered = true;
          break;
        }
      }
      if (triggered) {
        this.mines.splice(i, 1);
        this._processMineExplosion(m);
      }
    }
  }

  _processMineExplosion(mine) {
    this.audio.pushImpact();
    this.renderer.spawnPushParticles(mine.x, mine.y, '#ff6040');
    // Damage players in explosion radius
    for (const p of [this.p1, this.p2]) {
      if (p.shieldTimer > 0) continue;
      const d = Math.hypot(p.x - mine.x, p.y - mine.y);
      if (d < MINE.explosionRadius) {
        this._applyMineEffects(p, mine);
      }
    }
    // Chain reaction: detonate other mines within explosion radius
    const chained = [];
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const om = this.mines[i];
      const d = Math.hypot(om.x - mine.x, om.y - mine.y);
      if (d < MINE.explosionRadius) {
        chained.push(om);
        this.mines.splice(i, 1);
      }
    }
    for (const cm of chained) this._processMineExplosion(cm);
  }

  _applyMineEffects(player, mine) {
    player.score -= this._currentMinePenalty();
    player.freezeTimer = PLAYER.freezeDuration;
    player.cooldownTimer = PLAYER.pushCooldown;
    const dx = player.x - mine.x;
    const dy = player.y - mine.y;
    const d = Math.hypot(dx, dy);
    let dirX = 0, dirY = -1;
    if (d > 0.001) { dirX = dx / d; dirY = dy / d; }
    player.pushSlide = {
      fromX: player.x, fromY: player.y,
      toX: player.x + dirX * PLAYER.pushDistance,
      toY: player.y + dirY * PLAYER.pushDistance,
      elapsed: 0, duration: PLAYER.pushSlideDuration,
    };
  }

  _tickPowerUps(dt) {
    this.powerUpSpawnTimer += dt;
    if (this.powerUpSpawnTimer >= POWERUP.spawnInterval) {
      this.powerUpSpawnTimer -= POWERUP.spawnInterval;
      const pos = this._findOpenPosition(POWERUP.radius, 80);
      if (pos) {
        const type = POWERUP.types[Math.floor(Math.random() * POWERUP.types.length)];
        this.powerUps.push({ x: pos.x, y: pos.y, type });
      }
    }
  }

  _checkPowerUpCollisions() {
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const pu = this.powerUps[i];
      for (const p of [this.p1, this.p2]) {
        const d = Math.hypot(p.x - pu.x, p.y - pu.y);
        if (d < POWERUP.pickupDistance) {
          this._applyPowerUp(p, pu);
          this.powerUps.splice(i, 1);
          break;
        }
      }
    }
  }

  _applyPowerUp(player, pu) {
    if (pu.type === 'shield') player.shieldTimer = POWERUP.duration;
    else if (pu.type === 'speed') player.speedTimer = POWERUP.duration;
    else if (pu.type === 'teleport') player.teleportPunchReady = true;
    this.audio.scoreMilestone();
    this.renderer.spawnPushParticles(pu.x, pu.y, player.color);
  }

  _tickScoring(dt) {
    this.scoreAccumulator += dt;
    while (this.scoreAccumulator >= SCORING.tickInterval) {
      this.scoreAccumulator -= SCORING.tickInterval;
      if (this.zones.blue.contains(this.p1)) this._addZoneScore(this.p1);
      if (this.zones.red.contains(this.p2))  this._addZoneScore(this.p2);
    }
  }

  _addZoneScore(player) {
    const oldInt = Math.floor(player.score / 10);
    player.score += SCORING.zoneScoreTenths;
    const newInt = Math.floor(player.score / 10);
    if (newInt > oldInt) this.audio.scoreMilestone();
  }

  _checkZoneEjection(dt) {
    this._tickZoneEjection(this.p1, this.zones.blue, this.zones.red, dt);
    this._tickZoneEjection(this.p2, this.zones.red, this.zones.blue, dt);
  }

  _tickZoneEjection(player, opponentZone, ownZone, dt) {
    if (opponentZone.contains(player)) {
      player.opponentZoneTimer += dt;
      if (player.opponentZoneTimer >= ZONE_EJECT_TIME) {
        player.opponentZoneTimer = 0;
        player.x = ownZone.x;
        player.y = ownZone.y;
        player.pushSlide = null;
        player.freezeTimer = 0;
        this.renderer.spawnPushParticles(ownZone.x, ownZone.y, player.color);
      }
    } else {
      player.opponentZoneTimer = 0;
    }
  }

  _checkWin() {
    const targetTenths = this.ui.settings.targetScore * 10;
    if (this.p1.score >= targetTenths)      this._endMatch(this.p1);
    else if (this.p2.score >= targetTenths) this._endMatch(this.p2);
    else if (this.p1.score <= LOSE_SCORE_TENTHS) this._endMatch(this.p2);
    else if (this.p2.score <= LOSE_SCORE_TENTHS) this._endMatch(this.p1);
  }

  _endMatch(winner) {
    this.winner = winner;
    this.state = STATE.GAME_OVER;
    this.audio.win();
  }

  _updatePaused() {
    if (this.input.pausePressed()) this.state = STATE.PLAYING;
  }

  _updateGameOver() {
    if (this.input.pressed.has('Enter')) this.startMatch();
    else if (this.input.pressed.has('Escape')) this.state = STATE.MENU;
  }

  // -------- render --------

  render() {
    this.renderer.clear();
    if (this.state === STATE.MENU)        return this.ui.drawMenu(MENU_ITEMS, this.ui.menuSelection);
    if (this.state === STATE.SETTINGS)    return this.ui.drawSettings(this.ui.settingsSelection);
    if (this.state === STATE.HOW_TO_PLAY) return this.ui.drawHowToPlay();

    this.renderer.drawGrid();
    this.renderer.drawZone(this.zones.red);
    this.renderer.drawZone(this.zones.blue);
    for (const b of this.boxes) this.renderer.drawBox(b);
    for (const m of this.mines) this.renderer.drawMine(m);
    for (const pu of this.powerUps) this.renderer.drawPowerUp(pu);
    this.renderer.drawPlayer(this.p1);
    this.renderer.drawPlayer(this.p2);
    this.renderer.drawParticles();
    this.renderer.drawHUD(
      this.p1, this.p2, this.ui.settings.targetScore,
      this.matchTime, this._currentPushBonus(), this._currentMinePenalty(),
    );

    if (this.state === STATE.COUNTDOWN) {
      const n = Math.ceil(this.countdownRemaining);
      this.renderer.drawCenterText(n > 0 ? String(n) : 'GO!');
    } else if (this.state === STATE.PAUSED) {
      this.ui.drawPaused();
    } else if (this.state === STATE.GAME_OVER) {
      const w = this.winner;
      const name = w.id === 'red' ? 'RED' : 'BLUE';
      this.ui.drawGameOver(w.color, name, this.p1.score, this.p2.score);
    }
  }
}
