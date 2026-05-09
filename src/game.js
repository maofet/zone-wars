import {
  CANVAS, ZONES, BOXES, STARTS, PLAYER, SCORING, COUNTDOWN_SECONDS, KEYS,
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

    this.boxes = BOXES.map(b => new Box(b));
    this.zones = {
      red: new Zone(ZONES.red, 'red'),
      blue: new Zone(ZONES.blue, 'blue'),
    };
    this.p1 = new Player('red', ZONES.red.color, ZONES.red.glow, STARTS.p1);
    this.p2 = new Player('blue', ZONES.blue.color, ZONES.blue.glow, STARTS.p2);

    this.state = STATE.MENU;
    this.scoreAccumulator = 0;
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
    this.scoreAccumulator = 0;
    this.countdownRemaining = COUNTDOWN_SECONDS;
    this.lastCountdownInt = COUNTDOWN_SECONDS + 1;
    this.winner = null;
    this.state = STATE.COUNTDOWN;
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
    const items = 3; // target, sound, back
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
    if (this.ui.settingsSelection === 2 && this.input.pressed.has('Enter')) {
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

    this.renderer.updateParticles(dt);

    this._tickScoring(dt);

    this._checkWin();
  }

  _updatePlayer(player, binding, opponent, dt) {
    // tick timers
    if (player.freezeTimer > 0) player.freezeTimer = Math.max(0, player.freezeTimer - dt);
    if (player.cooldownTimer > 0) player.cooldownTimer = Math.max(0, player.cooldownTimer - dt);

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
    const desired = {
      x: player.x + v.x * PLAYER.speed * dt,
      y: player.y + v.y * PLAYER.speed * dt,
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
    target.freezeTimer = PLAYER.freezeDuration;
    const to = computePushTarget(attackerPos, targetPos, PLAYER.pushDistance);
    target.pushSlide = {
      fromX: target.x,
      fromY: target.y,
      toX: to.x,
      toY: to.y,
      elapsed: 0,
      duration: PLAYER.pushSlideDuration,
    };
    this.audio.pushImpact();
    const midX = (attackerPos.x + targetPos.x) / 2;
    const midY = (attackerPos.y + targetPos.y) / 2;
    this.renderer.spawnPushParticles(midX, midY, target.color);
  }

  _tickScoring(dt) {
    this.scoreAccumulator += dt;
    while (this.scoreAccumulator >= SCORING.tickInterval) {
      this.scoreAccumulator -= SCORING.tickInterval;
      if (this.zones.blue.contains(this.p1)) this._addScore(this.p1);
      if (this.zones.red.contains(this.p2))  this._addScore(this.p2);
    }
  }

  _addScore(player) {
    player.score += 1;
    if (player.score % SCORING.milestoneInterval === 0) this.audio.scoreMilestone();
  }

  _checkWin() {
    const target = this.ui.settings.targetScore;
    if (this.p1.score >= target)      this._endMatch(this.p1);
    else if (this.p2.score >= target) this._endMatch(this.p2);
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
    this.renderer.drawPlayer(this.p1);
    this.renderer.drawPlayer(this.p2);
    this.renderer.drawParticles();
    this.renderer.drawHUD(this.p1, this.p2, this.ui.settings.targetScore);

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
