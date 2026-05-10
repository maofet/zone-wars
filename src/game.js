import {
  ZONES, STARTS, PLAYER, SCORING, COUNTDOWN_SECONDS, KEYS, ZONE_EJECT_TIME,
  MINE, POWERUP, RANDOM_BOXES, LOSE_SCORE_TENTHS, ZONE_COLORS, computeZonePositions,
  MAP_SIZES, ENTITY_SCALING,
} from './config.js';
import { Player } from './entities/player.js';
import { Box } from './entities/box.js';
import { Zone } from './entities/zone.js';
import {
  clampToBounds, resolveCircleVsBoxes, resolveCircleVsCircle,
  detectPushTarget, computePushTarget,
} from './physics.js';
import { hostRoom, joinRoom } from './net.js';

// Provides the Input interface but reads from a per-slot record
// of the last received network input. Used by host for non-local slots.
// pushPressed/pausePressed are one-shot: returning true clears the flag so
// the host triggers the action exactly once per joiner keypress.
class NetworkInput {
  constructor(remoteInputs, slot) {
    this.remote = remoteInputs;
    this.slot = slot;
  }
  _state() {
    return this.remote[this.slot] || { held: new Set(), pushPressed: false, pausePressed: false };
  }
  movement(binding) {
    const r = this._state();
    let dx = 0, dy = 0;
    if (r.held.has(binding.up)) dy -= 1;
    if (r.held.has(binding.down)) dy += 1;
    if (r.held.has(binding.left)) dx -= 1;
    if (r.held.has(binding.right)) dx += 1;
    if (dx !== 0 && dy !== 0) { const inv = 1 / Math.SQRT2; dx *= inv; dy *= inv; }
    return { x: dx, y: dy };
  }
  pushPressed(binding) {
    const r = this._state();
    if (r.pushPressed) { r.pushPressed = false; return true; }
    return false;
  }
  pausePressed() {
    const r = this._state();
    if (r.pausePressed) { r.pausePressed = false; return true; }
    return false;
  }
}

const STATE = {
  MENU: 'menu',
  ONLINE_MENU: 'online_menu',
  ONLINE_HOST_SETUP: 'online_host_setup',
  ONLINE_HOST_LOBBY: 'online_host_lobby',
  ONLINE_JOIN_INPUT: 'online_join_input',
  ONLINE_JOIN_WAITING: 'online_join_waiting',
  SETTINGS: 'settings',
  HOW_TO_PLAY: 'how_to_play',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
};

const MENU_ITEMS = ['Local 2-Player', 'Online', 'Settings', 'How to Play'];

export class Game {
  constructor(renderer, ui, audio, input, playerCount = 2) {
    this.renderer = renderer;
    this.ui = ui;
    this.audio = audio;
    this.input = input;
    this.playerCount = playerCount;
    this.mode = 'local'; // 'local' | 'host' | 'joiner'
    this.room = null; // host room handle or joiner conn handle
    this.localSlot = 0; // which slot this client controls (0 for host or local; assigned by host for joiners)
    this.remoteInputs = []; // for host mode: indexed by slot, each {held: Set, pushPressed: bool, pausePressed: bool}
    this._snapshotTimer = 0;
    this._inputSendTimer = 0;
    this._pendingJoinerPush = false;
    this._pendingJoinerPause = false;
    this.disconnectMessage = null;
    this.canvasSize = MAP_SIZES[playerCount] || MAP_SIZES[2];
    this.entityScaling = ENTITY_SCALING[playerCount] || ENTITY_SCALING[2];
    // Resize the canvas DOM element to match player count
    this.renderer.canvas.width = this.canvasSize.width;
    this.renderer.canvas.height = this.canvasSize.height;

    const zoneRadius = ZONES.red.radius;
    const positions = computeZonePositions(playerCount, this.canvasSize.width, this.canvasSize.height, zoneRadius);
    this.zones = positions.map((pos, i) => new Zone(
      { x: pos.x, y: pos.y, radius: zoneRadius, color: ZONE_COLORS[i].color, glow: ZONE_COLORS[i].glow },
      ZONE_COLORS[i].name,
    ));
    this.players = positions.map((pos, i) => new Player(
      ZONE_COLORS[i].name,
      ZONE_COLORS[i].color,
      ZONE_COLORS[i].glow,
      playerCount === 2 ? (i === 0 ? STARTS.p1 : STARTS.p2) : pos,
    ));
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

  get p1() { return this.players[0]; }
  get p2() { return this.players[1]; }

  start() {
    this.lastTimestamp = performance.now();
    requestAnimationFrame(this._frame);
  }

  _frame = (now) => {
    const dt = Math.min((now - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = now;

    if (this.mode === 'joiner') {
      // Joiner: send local input ~30Hz, animate particles, render last received state.
      // Allow Escape to disconnect and return to menu.
      if (this.input.pressed.has('Escape')) {
        this._endRoomAndReturnToMenu();
      } else {
        // Latch one-shot events every frame so we never miss a press
        // that happens between throttled sends.
        if (this.input.pushPressed(KEYS.p1)) this._pendingJoinerPush = true;
        if (this.input.pausePressed()) this._pendingJoinerPause = true;
        this._inputSendTimer += dt;
        if (this._inputSendTimer >= 1 / 30) {
          this._inputSendTimer = 0;
          this._sendJoinerInput();
        }
        this.renderer.updateParticles(dt);
        this.render();
      }
    } else {
      // Local or host: full update + render.
      this.update(dt);
      // Host broadcasts during any in-match state so joiners see countdown,
      // pause, and game-over screens too.
      const inMatch = (
        this.state === STATE.COUNTDOWN ||
        this.state === STATE.PLAYING ||
        this.state === STATE.PAUSED ||
        this.state === STATE.GAME_OVER
      );
      if (this.mode === 'host' && inMatch) {
        this._snapshotTimer += dt;
        if (this._snapshotTimer >= 1 / 20) {
          this._snapshotTimer = 0;
          if (this.room) this.room.broadcast({ type: 'state', snap: this._serializeState() });
        }
      }
      this.render();
    }

    this.input.endFrame();
    requestAnimationFrame(this._frame);
  };

  _sendJoinerInput() {
    if (!this.room) return;
    this.room.send({
      type: 'input',
      held: [...this.input.held],
      pushPressed: this._pendingJoinerPush,
      pausePressed: this._pendingJoinerPause,
    });
    this._pendingJoinerPush = false;
    this._pendingJoinerPause = false;
  }

  // -------- state transitions --------

  startMatch() {
    this.audio.init();
    for (let i = 0; i < this.players.length; i++) {
      const start = this.playerCount === 2
        ? (i === 0 ? STARTS.p1 : STARTS.p2)
        : { x: this.zones[i].x, y: this.zones[i].y };
      this.players[i].reset(start);
    }
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
    const { cellSize, zonePadding, startPadding } = RANDOM_BOXES;
    const count = this.entityScaling.boxes;
    const cols = Math.floor(this.canvasSize.width / cellSize);
    const rows = Math.floor(this.canvasSize.height / cellSize);
    const startPositions = this.playerCount === 2
      ? [STARTS.p1, STARTS.p2]
      : this.zones.map(z => ({ x: z.x, y: z.y }));
    const candidates = [];
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        const x = cx * cellSize;
        const y = cy * cellSize;
        const centerX = x + cellSize / 2;
        const centerY = y + cellSize / 2;
        let blocked = false;
        for (const z of this.zones) {
          if (Math.hypot(centerX - z.x, centerY - z.y) < z.radius + zonePadding) { blocked = true; break; }
        }
        if (blocked) continue;
        for (const sp of startPositions) {
          if (Math.hypot(centerX - sp.x, centerY - sp.y) < startPadding) { blocked = true; break; }
        }
        if (blocked) continue;
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
      case STATE.MENU:                return this._updateMenu();
      case STATE.ONLINE_MENU:         return this._updateOnlineMenu();
      case STATE.ONLINE_HOST_SETUP:   return this._updateOnlineHostSetup();
      case STATE.ONLINE_HOST_LOBBY:   return this._updateOnlineHostLobby();
      case STATE.ONLINE_JOIN_INPUT:   return this._updateOnlineJoinInput();
      case STATE.ONLINE_JOIN_WAITING: return this._updateOnlineJoinWaiting();
      case STATE.SETTINGS:            return this._updateSettings();
      case STATE.HOW_TO_PLAY:         return this._updateHowToPlay();
      case STATE.COUNTDOWN:           return this._updateCountdown(dt);
      case STATE.PLAYING:             return this._updatePlaying(dt);
      case STATE.PAUSED:              return this._updatePaused();
      case STATE.GAME_OVER:           return this._updateGameOver();
    }
  }

  _updateMenu() {
    if (this.input.pressed.has('ArrowUp')) {
      this.ui.menuSelection = (this.ui.menuSelection - 1 + MENU_ITEMS.length) % MENU_ITEMS.length;
      this.disconnectMessage = null;
    }
    if (this.input.pressed.has('ArrowDown')) {
      this.ui.menuSelection = (this.ui.menuSelection + 1) % MENU_ITEMS.length;
      this.disconnectMessage = null;
    }
    if (this.input.pressed.has('Enter') || this.input.pressed.has('Space')) {
      const choice = MENU_ITEMS[this.ui.menuSelection];
      if (choice === 'Local 2-Player') this.startMatch();
      else if (choice === 'Online') this.state = STATE.ONLINE_MENU;
      else if (choice === 'Settings') this.state = STATE.SETTINGS;
      else if (choice === 'How to Play') this.state = STATE.HOW_TO_PLAY;
    }
  }

  _updateOnlineMenu() {
    const items = ['Host Game', 'Join Game', 'Back'];
    if (!this.ui.onlineMenuSelection) this.ui.onlineMenuSelection = 0;
    if (this.input.pressed.has('ArrowUp')) {
      this.ui.onlineMenuSelection = (this.ui.onlineMenuSelection - 1 + items.length) % items.length;
    }
    if (this.input.pressed.has('ArrowDown')) {
      this.ui.onlineMenuSelection = (this.ui.onlineMenuSelection + 1) % items.length;
    }
    if (this.input.pressed.has('Enter')) {
      const choice = items[this.ui.onlineMenuSelection];
      if (choice === 'Host Game') {
        this.ui.hostPlayerCount = this.ui.hostPlayerCount || 2;
        this.state = STATE.ONLINE_HOST_SETUP;
      } else if (choice === 'Join Game') {
        this.ui.joinCodeInput = '';
        this.ui.joinError = null;
        this.state = STATE.ONLINE_JOIN_INPUT;
      } else if (choice === 'Back') {
        this.state = STATE.MENU;
      }
    }
    if (this.input.pressed.has('Escape')) this.state = STATE.MENU;
  }

  _updateOnlineHostSetup() {
    if (this.input.pressed.has('ArrowLeft')) {
      this.ui.hostPlayerCount = Math.max(2, this.ui.hostPlayerCount - 1);
    }
    if (this.input.pressed.has('ArrowRight')) {
      this.ui.hostPlayerCount = Math.min(6, this.ui.hostPlayerCount + 1);
    }
    if (this.input.pressed.has('Enter')) {
      this.state = STATE.ONLINE_HOST_LOBBY;
      this.ui.hostRoomCode = '...';
      this.ui.hostConnectedCount = 1;
      this._setupHostRoom();
    }
    if (this.input.pressed.has('Escape')) this.state = STATE.ONLINE_MENU;
  }

  async _setupHostRoom() {
    try {
      const room = await hostRoom();
      this.room = room;
      this.mode = 'host';
      this.ui.hostRoomCode = room.code;
      room.onConnection((conn) => {
        const slot = this.room.connections.indexOf(conn) + 1; // host=0, joiners=1..N
        if (slot >= this.ui.hostPlayerCount) {
          conn.close();
          return;
        }
        this.ui.hostConnectedCount = 1 + this.room.connections.length;
        // Send welcome with slot and player count
        conn.send(JSON.stringify({
          type: 'welcome',
          slot,
          playerCount: this.ui.hostPlayerCount,
        }));
        conn.on('data', (raw) => {
          try {
            const msg = JSON.parse(raw);
            if (msg.type === 'input') {
              this.remoteInputs[slot] = {
                held: new Set(msg.held),
                pushPressed: msg.pushPressed,
                pausePressed: msg.pausePressed,
              };
            }
          } catch (e) { console.warn('bad msg', e); }
        });
      });
      room.onClose((conn) => {
        // A joiner disconnected
        this.ui.hostConnectedCount = Math.max(1, 1 + this.room.connections.length);
        if (this.state === STATE.PLAYING) {
          this.disconnectMessage = 'A player disconnected';
          this._endRoomAndReturnToMenu();
        }
      });
    } catch (e) {
      this.ui.hostRoomCode = null;
      this.disconnectMessage = 'Failed to host: ' + e.message;
      this.state = STATE.ONLINE_MENU;
    }
  }

  _endRoomAndReturnToMenu() {
    if (this.room) {
      try { this.room.close(); } catch {}
      this.room = null;
    }
    this.mode = 'local';
    this.localSlot = 0;
    this.ui.hostRoomCode = null;
    this.ui.joinWaitingMessage = null;
    this.state = STATE.MENU;
  }

  _updateOnlineHostLobby() {
    if (this.input.pressed.has('Enter') && this.ui.hostConnectedCount >= 2) {
      this._startOnlineHostMatch();
    }
    if (this.input.pressed.has('Escape')) {
      this._endRoomAndReturnToMenu();
    }
  }

  _startOnlineHostMatch() {
    // Reconfigure for hostPlayerCount before startMatch
    this._reinitForPlayerCount(this.ui.hostPlayerCount);
    this.startMatch();
    // Send start message + boxes to joiners
    if (this.room) {
      this.room.broadcast({
        type: 'start',
        playerCount: this.ui.hostPlayerCount,
        boxes: this._serializeBoxes(),
      });
    }
  }

  _reinitForPlayerCount(n) {
    this.playerCount = n;
    this.canvasSize = MAP_SIZES[n] || MAP_SIZES[2];
    this.entityScaling = ENTITY_SCALING[n] || ENTITY_SCALING[2];
    this.renderer.canvas.width = this.canvasSize.width;
    this.renderer.canvas.height = this.canvasSize.height;
    const zoneRadius = ZONES.red.radius;
    const positions = computeZonePositions(n, this.canvasSize.width, this.canvasSize.height, zoneRadius);
    this.zones = positions.map((pos, i) => new Zone(
      { x: pos.x, y: pos.y, radius: zoneRadius, color: ZONE_COLORS[i].color, glow: ZONE_COLORS[i].glow },
      ZONE_COLORS[i].name,
    ));
    this.players = positions.map((pos, i) => new Player(
      ZONE_COLORS[i].name,
      ZONE_COLORS[i].color,
      ZONE_COLORS[i].glow,
      pos,
    ));
    this.remoteInputs = [];
    for (let i = 0; i < n; i++) {
      this.remoteInputs[i] = { held: new Set(), pushPressed: false, pausePressed: false };
    }
  }

  _updateOnlineJoinInput() {
    for (const code of this.input.pressed) {
      if (code === 'Backspace') {
        this.ui.joinCodeInput = this.ui.joinCodeInput.slice(0, -1);
      } else if (code === 'Enter') {
        if (this.ui.joinCodeInput.length === 6) {
          this.ui.joinError = null;
          this.state = STATE.ONLINE_JOIN_WAITING;
          this._connectAsJoiner(this.ui.joinCodeInput);
        }
      } else if (code === 'Escape') {
        this.state = STATE.ONLINE_MENU;
      } else if (this.ui.joinCodeInput.length < 6) {
        let ch = null;
        if (code.startsWith('Key')) ch = code.slice(3);
        else if (code.startsWith('Digit')) ch = code.slice(5);
        if (ch && /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]$/.test(ch)) {
          this.ui.joinCodeInput += ch;
        }
      }
    }
  }

  _updateOnlineJoinWaiting() {
    if (this.input.pressed.has('Escape')) {
      this._endRoomAndReturnToMenu();
    }
  }

  async _connectAsJoiner(code) {
    try {
      const handle = await joinRoom(code);
      this.room = handle;
      this.mode = 'joiner';
      handle.onMessage((msg) => {
        if (msg.type === 'welcome') {
          this.localSlot = msg.slot;
          this._reinitForPlayerCount(msg.playerCount);
          this.ui.joinWaitingMessage = `Connected as player ${msg.slot + 1}. Waiting for host to start...`;
        } else if (msg.type === 'start') {
          this._reinitForPlayerCount(msg.playerCount);
          this._applyBoxes(msg.boxes);
          this.state = STATE.COUNTDOWN; // host's snapshot will overwrite shortly
        } else if (msg.type === 'state') {
          this._applyState(msg.snap);
        }
      });
      handle.onClose(() => {
        this.disconnectMessage = 'Host disconnected';
        this._endRoomAndReturnToMenu();
      });
    } catch (e) {
      this.ui.joinError = e.message || 'Failed to connect';
      this.state = STATE.ONLINE_JOIN_INPUT;
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
    if (this.mode !== 'joiner' && this.input.pausePressed()) {
      this.state = STATE.PAUSED;
      return;
    }

    for (let i = 0; i < this.players.length; i++) {
      if (!this.players[i].alive) continue;
      const others = [];
      for (let j = 0; j < this.players.length; j++) {
        if (j !== i && this.players[j].alive) others.push(this.players[j]);
      }
      this._updatePlayer(i, this.players[i], others, dt);
    }

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

  _inputForSlot(slot) {
    if (this.mode === 'local') {
      // Slot 0 uses p1 binding via local input; slot 1 uses p2 binding via local input.
      return slot < 2 ? this.input : null;
    }
    if (this.mode === 'host') {
      if (slot === this.localSlot) return this.input;
      return new NetworkInput(this.remoteInputs, slot);
    }
    return null; // joiner doesn't compute movement, host does
  }

  _bindingForSlot(slot) {
    if (this.mode === 'local') {
      if (slot === 0) return KEYS.p1;
      if (slot === 1) return KEYS.p2;
      return null;
    }
    // online: every player uses the P1 binding (their local WASD/Shift)
    // because their browser is theirs alone; the host then uses NetworkInput
    // which reads slot's "held" set verbatim.
    return KEYS.p1;
  }

  _updatePlayer(slot, player, others, dt) {
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
      next = clampToBounds(next, player.radius, { w: this.canvasSize.width, h: this.canvasSize.height });
      for (const o of others) next = resolveCircleVsCircle(old, next, player.radius, o, o.radius);
      player.x = next.x;
      player.y = next.y;
      if (t >= 1) player.pushSlide = null;
      return;
    }

    if (player.isFrozen()) return;

    const inputSrc = this._inputForSlot(slot);
    const binding = this._bindingForSlot(slot);
    if (!inputSrc || !binding) return;

    const v = inputSrc.movement(binding);
    const old = { x: player.x, y: player.y };
    const speedMul = player.speedTimer > 0 ? 2 : 1;
    const desired = {
      x: player.x + v.x * PLAYER.speed * speedMul * dt,
      y: player.y + v.y * PLAYER.speed * speedMul * dt,
    };
    let next = resolveCircleVsBoxes(old, desired, player.radius, this.boxes);
    next = clampToBounds(next, player.radius, { w: this.canvasSize.width, h: this.canvasSize.height });
    for (const o of others) next = resolveCircleVsCircle(old, next, player.radius, o, o.radius);
    player.x = next.x;
    player.y = next.y;
  }

  _resolvePushes() {
    // snapshot positions so simultaneous pushes use start-of-frame state
    const positions = this.players.map(p => ({ x: p.x, y: p.y }));
    for (let i = 0; i < this.players.length; i++) {
      const attacker = this.players[i];
      if (!attacker.alive) continue;
      const inputSrc = this._inputForSlot(i);
      const binding = this._bindingForSlot(i);
      if (!inputSrc || !binding) continue;
      if (!inputSrc.pushPressed(binding)) continue;
      if (!attacker.canPush() || attacker.isFrozen()) continue;
      let bestJ = -1, bestDist = PLAYER.pushRange;
      for (let j = 0; j < this.players.length; j++) {
        if (j === i || !this.players[j].alive) continue;
        const d = Math.hypot(positions[j].x - positions[i].x, positions[j].y - positions[i].y);
        if (d < bestDist) { bestDist = d; bestJ = j; }
      }
      if (bestJ < 0) {
        attacker.cooldownTimer = PLAYER.pushCooldown; // whiff still costs
        continue;
      }
      this._applyPush(attacker, this.players[bestJ], positions[i], positions[bestJ]);
    }
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
      const targetIdx = this.players.indexOf(target);
      const ownZone = this.zones[targetIdx];
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
      const x = radius + Math.random() * (this.canvasSize.width - radius * 2);
      const y = radius + Math.random() * (this.canvasSize.height - radius * 2);
      let onBox = false;
      for (const box of this.boxes) {
        if (x + radius > box.x && x - radius < box.x + box.w &&
            y + radius > box.y && y - radius < box.y + box.h) {
          onBox = true; break;
        }
      }
      if (onBox) continue;
      let nearPlayer = false;
      for (const p of this.players) {
        if (!p.alive) continue;
        if (Math.hypot(x - p.x, y - p.y) < minPlayerDistance) { nearPlayer = true; break; }
      }
      if (nearPlayer) continue;
      if (avoidZones) {
        let nearZone = false;
        for (const z of this.zones) {
          if (Math.hypot(x - z.x, y - z.y) < z.radius + radius) { nearZone = true; break; }
        }
        if (nearZone) continue;
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
      const slots = Math.max(0, this.entityScaling.minesMax - this.mines.length);
      const toSpawn = Math.min(this.entityScaling.minesPerSpawn, slots);
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
      for (const p of this.players) {
        if (!p.alive || p.shieldTimer > 0) continue;
        if (Math.hypot(p.x - m.x, p.y - m.y) < MINE.triggerDistance) { triggered = true; break; }
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
    for (const p of this.players) {
      if (!p.alive || p.shieldTimer > 0) continue;
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
      for (const p of this.players) {
        if (!p.alive) continue;
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

  _serializeState() {
    return {
      t: this.matchTime,
      s: this.state,
      cdr: this.countdownRemaining,
      players: this.players.map(p => ({
        x: p.x, y: p.y, score: p.score, alive: p.alive,
        ft: p.freezeTimer, ct: p.cooldownTimer, st: p.shieldTimer,
        sp: p.speedTimer, tp: p.teleportPunchReady,
        psl: p.pushSlide ? {
          fx: p.pushSlide.fromX, fy: p.pushSlide.fromY,
          tx: p.pushSlide.toX, ty: p.pushSlide.toY,
          e: p.pushSlide.elapsed, d: p.pushSlide.duration,
        } : null,
      })),
      mines: this.mines.map(m => ({ x: m.x, y: m.y, age: m.age })),
      powerUps: this.powerUps.map(pu => ({ x: pu.x, y: pu.y, type: pu.type })),
      pushBonus: this._currentPushBonus(),
      minePenalty: this._currentMinePenalty(),
      target: this.ui.settings.targetScore,
      matchDuration: this.ui.settings.matchDuration ?? 5,
      winnerSlot: this.winner ? this.players.indexOf(this.winner) : -1,
    };
  }

  _serializeBoxes() {
    return this.boxes.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
  }

  _applyState(snap) {
    this.matchTime = snap.t;
    this.state = snap.s;
    this.countdownRemaining = snap.cdr;
    for (let i = 0; i < snap.players.length; i++) {
      const sp = snap.players[i];
      const p = this.players[i];
      if (!p) continue;
      p.x = sp.x; p.y = sp.y; p.score = sp.score; p.alive = sp.alive;
      p.freezeTimer = sp.ft; p.cooldownTimer = sp.ct; p.shieldTimer = sp.st;
      p.speedTimer = sp.sp; p.teleportPunchReady = sp.tp;
      p.pushSlide = sp.psl ? {
        fromX: sp.psl.fx, fromY: sp.psl.fy,
        toX: sp.psl.tx, toY: sp.psl.ty,
        elapsed: sp.psl.e, duration: sp.psl.d,
      } : null;
    }
    this.mines = snap.mines;
    this.powerUps = snap.powerUps;
    this._lastPushBonus = snap.pushBonus;
    this._lastMinePenalty = snap.minePenalty;
    this.winner = (typeof snap.winnerSlot === 'number' && snap.winnerSlot >= 0)
      ? this.players[snap.winnerSlot]
      : null;
  }

  _applyBoxes(boxData) {
    this.boxes = boxData.map(b => new Box(b));
  }

  _tickScoring(dt) {
    this.scoreAccumulator += dt;
    while (this.scoreAccumulator >= SCORING.tickInterval) {
      this.scoreAccumulator -= SCORING.tickInterval;
      for (let pi = 0; pi < this.players.length; pi++) {
        const p = this.players[pi];
        if (!p.alive) continue;
        for (let zi = 0; zi < this.zones.length; zi++) {
          if (zi === pi) continue;
          if (this.zones[zi].contains(p)) {
            this._addZoneScore(p);
            break;
          }
        }
      }
    }
  }

  _addZoneScore(player) {
    const oldInt = Math.floor(player.score / 10);
    player.score += SCORING.zoneScoreTenths;
    const newInt = Math.floor(player.score / 10);
    if (newInt > oldInt) this.audio.scoreMilestone();
  }

  _checkZoneEjection(dt) {
    for (let pi = 0; pi < this.players.length; pi++) {
      const p = this.players[pi];
      if (!p.alive) continue;
      let inForeign = false;
      for (let zi = 0; zi < this.zones.length; zi++) {
        if (zi === pi) continue;
        if (this.zones[zi].contains(p)) { inForeign = true; break; }
      }
      if (inForeign) {
        p.opponentZoneTimer += dt;
        if (p.opponentZoneTimer >= ZONE_EJECT_TIME) {
          p.opponentZoneTimer = 0;
          const ownZone = this.zones[pi];
          p.x = ownZone.x;
          p.y = ownZone.y;
          p.pushSlide = null;
          p.freezeTimer = 0;
          this.renderer.spawnPushParticles(ownZone.x, ownZone.y, p.color);
        }
      } else {
        p.opponentZoneTimer = 0;
      }
    }
  }

  _checkWin() {
    const targetTenths = this.ui.settings.targetScore * 10;
    // Eliminate players below threshold
    for (const p of this.players) {
      if (p.alive && p.score <= LOSE_SCORE_TENTHS) p.alive = false;
    }
    // Score-based win
    for (const p of this.players) {
      if (p.alive && p.score >= targetTenths) { this._endMatch(p); return; }
    }
    // Last-standing win
    const alive = this.players.filter(p => p.alive);
    if (alive.length === 1 && this.players.length > 1) { this._endMatch(alive[0]); return; }
    // Timer-based win: if match duration is set and elapsed, highest score among alive wins
    const durationMin = this.ui.settings.matchDuration ?? 5;
    if (durationMin > 0 && this.matchTime >= durationMin * 60) {
      const candidates = alive.length > 0 ? alive : this.players;
      let best = candidates[0];
      for (const p of candidates) if (p.score > best.score) best = p;
      this._endMatch(best);
    }
  }

  _endMatch(winner) {
    this.winner = winner;
    this.state = STATE.GAME_OVER;
    this.audio.win();
    // Push a final snapshot immediately so joiners see the result without
    // waiting for the next throttled tick (which may not fire if state is
    // not PLAYING anymore in some race).
    if (this.mode === 'host' && this.room) {
      try { this.room.broadcast({ type: 'state', snap: this._serializeState() }); } catch {}
    }
  }

  _updatePaused() {
    if (this.input.pausePressed()) this.state = STATE.PLAYING;
  }

  _updateGameOver() {
    if (this.input.pressed.has('Enter')) {
      if (this.mode === 'host') {
        this._startOnlineHostMatch();
      } else if (this.mode === 'joiner') {
        // Joiner cannot restart - only host can initiate a new match.
        // Do nothing on Enter; Esc still returns to menu.
      } else {
        this.startMatch();
      }
    } else if (this.input.pressed.has('Escape')) {
      if (this.mode !== 'local') {
        this._endRoomAndReturnToMenu();
      } else {
        this.state = STATE.MENU;
      }
    }
  }

  // -------- render --------

  render() {
    this.renderer.clear();
    const inMatch = (
      this.state === STATE.COUNTDOWN ||
      this.state === STATE.PLAYING ||
      this.state === STATE.PAUSED ||
      this.state === STATE.GAME_OVER
    );
    if (inMatch) {
      this.ui.showHUD();
      this.ui.updateHUD(
        this.players, this.ui.settings.targetScore,
        this.matchTime, this._currentPushBonus(), this._currentMinePenalty(),
        this.ui.settings.matchDuration ?? 5,
      );
    } else {
      this.ui.hideHUD();
    }
    if (this.state === STATE.MENU)                return this.ui.drawMenu(MENU_ITEMS, this.ui.menuSelection, this.disconnectMessage);
    if (this.state === STATE.ONLINE_MENU)         return this.ui.drawOnlineMenu(this.ui.onlineMenuSelection || 0);
    if (this.state === STATE.ONLINE_HOST_SETUP)   return this.ui.drawHostSetup(this.ui.hostPlayerCount || 2);
    if (this.state === STATE.ONLINE_HOST_LOBBY)   return this.ui.drawHostLobby(this.ui.hostRoomCode, this.ui.hostConnectedCount, this.ui.hostPlayerCount);
    if (this.state === STATE.ONLINE_JOIN_INPUT)   return this.ui.drawJoinInput(this.ui.joinCodeInput, this.ui.joinError);
    if (this.state === STATE.ONLINE_JOIN_WAITING) return this.ui.drawJoinWaiting(this.ui.joinWaitingMessage);
    if (this.state === STATE.SETTINGS)            return this.ui.drawSettings(this.ui.settingsSelection);
    if (this.state === STATE.HOW_TO_PLAY)         return this.ui.drawHowToPlay();

    this.renderer.drawGrid();
    for (const z of this.zones) this.renderer.drawZone(z);
    for (const b of this.boxes) this.renderer.drawBox(b);
    for (const m of this.mines) this.renderer.drawMine(m);
    for (const pu of this.powerUps) this.renderer.drawPowerUp(pu);
    for (const p of this.players) if (p.alive) this.renderer.drawPlayer(p);
    this.renderer.drawParticles();

    if (this.state === STATE.COUNTDOWN) {
      const n = Math.ceil(this.countdownRemaining);
      this.renderer.drawCenterText(n > 0 ? String(n) : 'GO!');
    } else if (this.state === STATE.PAUSED) {
      this.ui.drawPaused();
    } else if (this.state === STATE.GAME_OVER) {
      this.ui.drawGameOver(this.winner, this.players);
    }
  }
}
