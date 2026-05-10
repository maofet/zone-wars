# Zone Wars Online (Phase B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add online multiplayer for 2-6 players via PeerJS WebRTC, scale map and entities by player count, deploy to GitHub Pages. Hot-seat 2-player mode preserved.

**Architecture:** Host-authoritative WebRTC peer-to-peer via PeerJS. Host runs full game loop, joiners send input + render state snapshots. No backend server. Map/zone/entity scaling is parametric (driven by player count chosen at room creation). Static files hosted on GitHub Pages.

**Tech Stack:** PeerJS via CDN, vanilla JS ES modules, HTML5 Canvas, GitHub Pages static hosting, gh CLI for repo creation.

**Spec:** `docs/superpowers/specs/2026-05-09-zone-wars-online-design.md`

**Existing code state:** Hot-seat 2-player game complete and committed at `~/workspace/games/zone-wars/`. 19 physics tests pass.

---

## Task 1: GitHub Pages setup and initial deploy

**Files:**
- Create: GitHub repo (via `gh repo create`)
- Modify: `~/workspace/games/zone-wars/.git/config` (remote)

- [ ] **Step 1: Authenticate gh CLI**

```bash
gh auth status || gh auth login
```

If not authed, walk the user through interactive auth (GitHub.com, HTTPS, web browser). Stop the agent, ask the user, resume after auth.

- [ ] **Step 2: Create the GitHub repo**

```bash
cd ~/workspace/games/zone-wars
gh repo create zone-wars --public --source=. --remote=origin --description="Local + online 2-6 player zone-control game" --push
```

This creates the repo, sets origin, and pushes main.

- [ ] **Step 3: Enable GitHub Pages on main / root**

```bash
gh api -X POST "repos/{owner}/zone-wars/pages" -f "source[branch]=main" -f "source[path]=/" 2>&1 || echo "may need to enable via UI"
```

If gh API fails (newer GH may not allow), open `https://github.com/<user>/zone-wars/settings/pages` and pick branch=main, folder=/.

- [ ] **Step 4: Verify the URL**

After 1-2 minutes the site is live at `https://<github-username>.github.io/zone-wars/`. Open it. Should see the existing Zone Wars game running.

- [ ] **Step 5: Commit and verify**

No code changes; existing main is already live. Document the URL in `README.md`:

```bash
# Add a "Play online" line to README pointing to the GitHub Pages URL.
```

```bash
git add README.md
git commit -m "docs: add public play URL"
git push
```

---

## Task 2: Refactor entities to players[] array

**Files:**
- Modify: `src/game.js` - replace `this.p1`/`this.p2` with `this.players[]`

- [ ] **Step 1: Refactor constructor**

Replace:
```javascript
this.p1 = new Player('red', ZONES.red.color, ZONES.red.glow, STARTS.p1);
this.p2 = new Player('blue', ZONES.blue.color, ZONES.blue.glow, STARTS.p2);
```

With:
```javascript
this.players = [
  new Player('red', ZONES.red.color, ZONES.red.glow, STARTS.p1),
  new Player('blue', ZONES.blue.color, ZONES.blue.glow, STARTS.p2),
];
```

Keep `this.p1`/`this.p2` as getters for backward compatibility during refactor:
```javascript
get p1() { return this.players[0]; }
get p2() { return this.players[1]; }
```

This way other methods keep working. We'll remove p1/p2 references in subsequent tasks.

- [ ] **Step 2: Update startMatch and reset**

```javascript
startMatch() {
  this.audio.init();
  for (const p of this.players) p.reset(p.id === 'red' ? STARTS.p1 : STARTS.p2);
  ...
}
```

- [ ] **Step 3: Run tests**

```bash
npm test
```
Expected: 19/19 pass. Game still runs identically.

- [ ] **Step 4: Smoke test in browser**

Open the game, play a quick round, verify no behavior changes.

- [ ] **Step 5: Commit**

```bash
git add src/game.js
git commit -m "refactor(game): players[] array (back-compat getters for p1/p2)"
git push
```

---

## Task 3: Refactor zones to zones[] array with multi-color support

**Files:**
- Modify: `src/config.js` - add `ZONE_COLORS` array (6 colors)
- Modify: `src/game.js` - `this.zones[]` array, scoring loops over players

- [ ] **Step 1: Add ZONE_COLORS in config**

```javascript
export const ZONE_COLORS = [
  { color: '#ff3060', glow: '#ff6080', name: 'red' },
  { color: '#30b0ff', glow: '#60c8ff', name: 'blue' },
  { color: '#40d060', glow: '#70e090', name: 'green' },
  { color: '#ffd040', glow: '#ffe080', name: 'yellow' },
  { color: '#d040ff', glow: '#e080ff', name: 'purple' },
  { color: '#40e0d0', glow: '#80f0e0', name: 'cyan' },
];
```

- [ ] **Step 2: Add a zone-position helper**

In `src/config.js`:

```javascript
// Returns N zone center positions distributed around the play area perimeter.
// Strategy: place on an inscribed ellipse, then snap into the canvas with margin.
export function computeZonePositions(playerCount, canvasW, canvasH, zoneRadius) {
  const cx = canvasW / 2;
  const cy = canvasH / 2;
  const rx = canvasW / 2 - zoneRadius - 20;
  const ry = canvasH / 2 - zoneRadius - 20;
  const positions = [];
  // For 2 players: place horizontally (left/right), keep classic feel.
  if (playerCount === 2) {
    return [
      { x: cx - rx, y: cy },
      { x: cx + rx, y: cy },
    ];
  }
  // Otherwise: spread evenly around the ellipse, starting at the top.
  for (let i = 0; i < playerCount; i++) {
    const angle = -Math.PI / 2 + (i / playerCount) * Math.PI * 2;
    positions.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
  }
  return positions;
}
```

- [ ] **Step 3: Refactor Game constructor**

Replace zones object with array. Take `playerCount` parameter (default 2 for back-compat):

```javascript
constructor(renderer, ui, audio, input, playerCount = 2) {
  ...
  this.playerCount = playerCount;
  const zoneRadius = ZONES.red.radius; // keep 80 for now
  const positions = computeZonePositions(playerCount, CANVAS.width, CANVAS.height, zoneRadius);
  this.zones = positions.map((pos, i) => new Zone(
    { x: pos.x, y: pos.y, radius: zoneRadius, ...ZONE_COLORS[i] },
    ZONE_COLORS[i].name,
  ));
  this.players = positions.map((pos, i) => new Player(
    ZONE_COLORS[i].name,
    ZONE_COLORS[i].color,
    ZONE_COLORS[i].glow,
    pos,  // start at own zone
  ));
  ...
}
```

- [ ] **Step 4: Rework scoring**

Replace `_tickScoring` to loop over all players. A player scores by being in any zone owned by a different player:

```javascript
_tickScoring(dt) {
  this.scoreAccumulator += dt;
  while (this.scoreAccumulator >= SCORING.tickInterval) {
    this.scoreAccumulator -= SCORING.tickInterval;
    for (let pi = 0; pi < this.players.length; pi++) {
      const p = this.players[pi];
      if (!p.alive) continue;
      for (let zi = 0; zi < this.zones.length; zi++) {
        if (zi === pi) continue; // own zone: no points
        if (this.zones[zi].contains(p)) {
          this._addZoneScore(p);
          break;
        }
      }
    }
  }
}
```

- [ ] **Step 5: Rework zone-eject**

```javascript
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
```

- [ ] **Step 6: Rework movement and pushes for N players**

Movement loop:
```javascript
for (let i = 0; i < this.players.length; i++) {
  // collect other players for collision-vs-circle resolution
  const others = this.players.filter((_, j) => j !== i);
  this._updatePlayer(this.players[i], this._bindingFor(i), others, dt);
}
```

Update `_updatePlayer` signature to take `others[]` instead of single opponent. In the function, check collisions against each `others[k]`.

Push: only player slot 0 (P1) and slot 1 (P2) have local push keys in hot-seat. In online, each browser has only one local slot. For now, define `_bindingFor(slot)` that returns `KEYS.p1` for 0, `KEYS.p2` for 1, `null` for 2-5. Networked players get push input through the network layer (later task).

For each pair (i, j), check if i pushed and j is the closest in range. Or simpler: each player who pressed push targets the nearest other player in range.

```javascript
_resolvePushes() {
  const positions = this.players.map(p => ({ x: p.x, y: p.y }));
  for (let i = 0; i < this.players.length; i++) {
    const attacker = this.players[i];
    if (!attacker.alive) continue;
    const binding = this._bindingFor(i);
    if (!binding) continue;
    if (!this.input.pushPressed(binding)) continue;
    if (!attacker.canPush() || attacker.isFrozen()) continue;
    // find nearest other in range
    let bestJ = -1, bestDist = PLAYER.pushRange;
    for (let j = 0; j < this.players.length; j++) {
      if (j === i || !this.players[j].alive) continue;
      const d = Math.hypot(positions[j].x - positions[i].x, positions[j].y - positions[i].y);
      if (d < bestDist) { bestDist = d; bestJ = j; }
    }
    if (bestJ < 0) {
      attacker.cooldownTimer = PLAYER.pushCooldown; // whiff
      continue;
    }
    this._applyPush(attacker, this.players[bestJ], positions[i], positions[bestJ]);
  }
}
```

- [ ] **Step 7: Mine collision over all players**

```javascript
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
```

Same for `_processMineExplosion` (loop over all players for damage).

- [ ] **Step 8: Power-up pickup over all players**

```javascript
for (const p of this.players) {
  if (!p.alive) continue;
  if (Math.hypot(p.x - pu.x, p.y - pu.y) < POWERUP.pickupDistance) {
    this._applyPowerUp(p, pu);
    ...
  }
}
```

- [ ] **Step 9: Win and lose conditions for N players**

```javascript
_checkWin() {
  const targetTenths = this.ui.settings.targetScore * 10;
  // Score-based win
  for (const p of this.players) {
    if (p.alive && p.score >= targetTenths) { this._endMatch(p); return; }
  }
  // Eliminations
  for (const p of this.players) {
    if (p.alive && p.score <= LOSE_SCORE_TENTHS) p.alive = false;
  }
  const alive = this.players.filter(p => p.alive);
  if (alive.length === 1) this._endMatch(alive[0]);
}
```

Add `alive: true` field to Player. Reset to true on Player.reset.

- [ ] **Step 10: Render N players + N zones**

In game.js render():
```javascript
for (const z of this.zones) this.renderer.drawZone(z);
for (const b of this.boxes) this.renderer.drawBox(b);
for (const m of this.mines) this.renderer.drawMine(m);
for (const pu of this.powerUps) this.renderer.drawPowerUp(pu);
for (const p of this.players) if (p.alive) this.renderer.drawPlayer(p);
```

- [ ] **Step 11: Update HUD for N players**

Update `Renderer.drawHUD` to take `players[]` instead of p1/p2 individually:

```javascript
drawHUD(players, target, matchTime, pushBonus, minePenalty) {
  // Show all alive scores horizontally across the top.
  ...
}
```

For 2 players keep current style (left/right). For 3+ stack them: e.g., 3 players → label colors in a row.

- [ ] **Step 12: Run tests and smoke**

Tests should pass. Browser smoke: open game, play 2-player local. Should look identical to before.

- [ ] **Step 13: Commit**

```bash
git add src/game.js src/config.js src/render.js
git commit -m "refactor(game): N-player support, multi-zone, eliminate p1/p2 hardcoding"
git push
```

---

## Task 4: Map and entity scaling

**Files:**
- Modify: `src/config.js` - add MAP_SIZES, ENTITY_SCALING tables
- Modify: `src/game.js` - read scaling from playerCount
- Modify: `index.html` - canvas size set dynamically by main.js
- Modify: `src/main.js` - configure canvas before constructing Game

- [ ] **Step 1: Add scaling tables**

```javascript
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
```

- [ ] **Step 2: Game uses scaling**

In Game constructor, take `playerCount`:
```javascript
const map = MAP_SIZES[playerCount] || MAP_SIZES[2];
const scaling = ENTITY_SCALING[playerCount] || ENTITY_SCALING[2];
this.canvasSize = map;
this.entityScaling = scaling;
```

Use `this.canvasSize.width / .height` in physics calls (replace `CANVAS.width/height`).

`_generateRandomBoxes` reads `this.entityScaling.boxes` instead of `RANDOM_BOXES.count`.

`_tickMines` uses `this.entityScaling.minesPerSpawn` and `this.entityScaling.minesMax`.

- [ ] **Step 3: Renderer accepts dynamic canvas size**

Pass `canvasSize` to Renderer or make Renderer read from `canvas.width / canvas.height`. Simpler: Renderer always uses `this.canvas.width` and `this.canvas.height`.

Replace `CANVAS.width` with `this.canvas.width` etc. in render.js.

- [ ] **Step 4: main.js sets canvas size before Game**

```javascript
import { MAP_SIZES } from './config.js';

const canvas = document.getElementById('game');
// default to 2 players for hot-seat menu; will be re-sized at match start
const initialSize = MAP_SIZES[2];
canvas.width = initialSize.width;
canvas.height = initialSize.height;
const renderer = new Renderer(canvas);
...
const game = new Game(renderer, ui, audio, input, 2);
```

When startMatch is called for N players (later), resize canvas.

- [ ] **Step 5: Run tests and smoke**

Tests still pass. Browser still works for 2 players.

- [ ] **Step 6: Commit**

```bash
git add src/game.js src/config.js src/render.js src/main.js
git commit -m "feat(game): map size and entity counts scale with player count"
git push
```

---

## Task 5: PeerJS integration and room codes

**Files:**
- Modify: `index.html` - add PeerJS CDN script
- Create: `src/net.js` - PeerJS wrapper

- [ ] **Step 1: Add PeerJS via CDN**

In `index.html`, before the main module script:
```html
<script src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js"></script>
```

This exposes a global `Peer` constructor.

- [ ] **Step 2: Create src/net.js**

```javascript
// Thin wrapper over PeerJS. Generates room codes, hosts/joins rooms,
// exposes a simple message API.

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit ambiguous chars

export function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

// Host: returns a Promise that resolves to {peer, code, onConnection}
// onConnection is a callback registered via host.onConnection(fn)
export async function hostRoom() {
  const code = generateRoomCode();
  return new Promise((resolve, reject) => {
    const peer = new Peer('zonewars-' + code);
    const conns = [];
    let onConn = null;
    peer.on('open', () => {
      resolve({
        code,
        peer,
        connections: conns,
        onConnection(cb) { onConn = cb; conns.forEach(c => cb(c)); },
        broadcast(msg) {
          const data = JSON.stringify(msg);
          for (const c of conns) if (c.open) c.send(data);
        },
        close() { peer.destroy(); },
      });
    });
    peer.on('connection', (conn) => {
      conn.on('open', () => {
        conns.push(conn);
        if (onConn) onConn(conn);
      });
    });
    peer.on('error', (err) => reject(err));
  });
}

// Joiner: connects to a room by code. Returns {peer, conn, send, onMessage, close}
export async function joinRoom(code) {
  return new Promise((resolve, reject) => {
    const peer = new Peer();
    peer.on('open', () => {
      const conn = peer.connect('zonewars-' + code, { reliable: true });
      let messageHandler = null;
      conn.on('open', () => {
        resolve({
          peer, conn,
          send(msg) { if (conn.open) conn.send(JSON.stringify(msg)); },
          onMessage(cb) { messageHandler = cb; },
          onClose(cb) { conn.on('close', cb); peer.on('disconnected', cb); },
          close() { peer.destroy(); },
        });
      });
      conn.on('data', (raw) => {
        if (messageHandler) {
          try { messageHandler(JSON.parse(raw)); }
          catch (e) { console.warn('bad message', e); }
        }
      });
      conn.on('error', (err) => reject(err));
    });
    peer.on('error', (err) => reject(err));
    setTimeout(() => reject(new Error('connection timeout')), 10000);
  });
}
```

- [ ] **Step 3: Quick manual test**

Open two browser tabs. In tab 1, run in console:
```javascript
const m = await import('/src/net.js');
const room = await m.hostRoom();
console.log('code:', room.code);
room.onConnection(c => { console.log('joined!', c.peer); c.on('data', d => console.log('got:', d)); });
```

In tab 2:
```javascript
const m = await import('/src/net.js');
const r = await m.joinRoom('ABC123'); // use code from tab 1
r.send({hi: 'there'});
```

Expected: tab 1 logs "joined!" then "got: {"hi":"there"}".

If this works, networking primitive is solid.

- [ ] **Step 4: Commit**

```bash
git add index.html src/net.js
git commit -m "feat(net): PeerJS integration with room codes and connect/send/recv"
git push
```

---

## Task 6: Online lobby UI

**Files:**
- Modify: `src/ui.js` - online sub-menu, host lobby, join input, waiting room
- Modify: `src/game.js` - add states ONLINE_MENU, ONLINE_HOST_SETUP, ONLINE_HOST_LOBBY, ONLINE_JOIN_INPUT, ONLINE_JOIN_WAITING

- [ ] **Step 1: Add new states in game.js**

```javascript
const STATE = {
  MENU: 'menu',
  ONLINE_MENU: 'online_menu',
  ONLINE_HOST_SETUP: 'online_host_setup',  // pick player count
  ONLINE_HOST_LOBBY: 'online_host_lobby',  // wait for joiners
  ONLINE_JOIN_INPUT: 'online_join_input',  // enter code
  ONLINE_JOIN_WAITING: 'online_join_waiting', // connecting...
  SETTINGS: 'settings',
  HOW_TO_PLAY: 'how_to_play',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
};
```

Update MAIN MENU items:
```javascript
const MENU_ITEMS = ['Local 2-Player', 'Online', 'Settings', 'How to Play'];
```

- [ ] **Step 2: Add UI draw methods**

In `ui.js`, add:

- `drawOnlineMenu(selectedIndex)` - shows `Host Game / Join Game / Back`.
- `drawHostSetup(playerCount)` - "How many players?" with 2/3/4/5/6 selector and `Start Hosting` button.
- `drawHostLobby(code, connectedCount, targetCount)` - shows room code huge, "Players: 2/4 connected. Press Enter to start when ready."
- `drawJoinInput(code, error)` - "Enter room code" with input (use canvas text input simulation: show typed chars).
- `drawJoinWaiting(message)` - "Connecting..." or error text.

- [ ] **Step 3: Wire state machine in game.js**

Add `_updateOnlineMenu()`, `_updateOnlineHostSetup()`, etc. with input handling.

For text input on join: use `keydown` events through input.pressed. A-Z keys (KeyA..KeyZ), 0-9 (Digit0..Digit9). Limit to 6 chars. Backspace removes last.

- [ ] **Step 4: Wire render**

```javascript
if (this.state === STATE.ONLINE_MENU) return this.ui.drawOnlineMenu(...);
// etc.
```

- [ ] **Step 5: No actual networking yet**

Lobby is UI-only at this point. Press Start Hosting -> generates a fake "ABC123" code, doesn't actually create a peer yet. Press Join with code -> "connecting..." pseudo. Will hook up real peers in next task.

- [ ] **Step 6: Smoke test**

Open game. Navigate Local 2-Player (still works). Navigate Online → see lobby flows. Verify all menus render correctly.

- [ ] **Step 7: Commit**

```bash
git add src/game.js src/ui.js
git commit -m "feat(ui): online lobby screens (host setup, lobby, join input)"
git push
```

---

## Task 7: Network game protocol

**Files:**
- Modify: `src/game.js` - serialize/deserialize state, apply remote input
- Modify: `src/net.js` - message types, optional helpers

- [ ] **Step 1: Define snapshot serializer (host)**

In `game.js`:

```javascript
_serializeState() {
  return {
    t: this.matchTime,
    state: this.state,
    players: this.players.map(p => ({
      x: p.x, y: p.y, score: p.score, alive: p.alive,
      ft: p.freezeTimer, ct: p.cooldownTimer, st: p.shieldTimer,
      sp: p.speedTimer, tp: p.teleportPunchReady,
      psl: p.pushSlide ? { fx: p.pushSlide.fromX, fy: p.pushSlide.fromY,
                            tx: p.pushSlide.toX, ty: p.pushSlide.toY,
                            e: p.pushSlide.elapsed, d: p.pushSlide.duration } : null,
    })),
    mines: this.mines.map(m => ({ x: m.x, y: m.y, age: m.age })),
    powerUps: this.powerUps.map(pu => ({ x: pu.x, y: pu.y, type: pu.type })),
    countdownRemaining: this.countdownRemaining,
  };
}
```

Boxes are sent ONCE on match start (same for all snapshots), then omitted.

```javascript
_serializeBoxes() {
  return this.boxes.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
}
```

- [ ] **Step 2: Define applier (joiner)**

```javascript
_applyState(snapshot) {
  this.matchTime = snapshot.t;
  this.state = snapshot.state;
  this.countdownRemaining = snapshot.countdownRemaining;
  // overwrite player positions/timers
  for (let i = 0; i < snapshot.players.length; i++) {
    const sp = snapshot.players[i];
    const p = this.players[i];
    Object.assign(p, { x: sp.x, y: sp.y, score: sp.score, alive: sp.alive,
      freezeTimer: sp.ft, cooldownTimer: sp.ct, shieldTimer: sp.st,
      speedTimer: sp.sp, teleportPunchReady: sp.tp,
      pushSlide: sp.psl ? { fromX: sp.psl.fx, fromY: sp.psl.fy,
        toX: sp.psl.tx, toY: sp.psl.ty,
        elapsed: sp.psl.e, duration: sp.psl.d } : null });
  }
  this.mines = snapshot.mines;
  this.powerUps = snapshot.powerUps;
}

_applyBoxes(boxData) {
  this.boxes = boxData.map(b => new Box(b));
}
```

- [ ] **Step 3: Define input snapshot (joiner -> host)**

Joiner sends each frame:
```javascript
{ type: 'input', slot: mySlot, held: [...keyCodes], push: bool, pause: bool }
```

Host stores per-slot input state in a map `this.remoteInputs[slot] = {held: Set, pushPressed: bool, pausePressed: bool}`. When `_resolvePushes` and movement run, the input source is the local Input for slot 0 (host) and `remoteInputs[slot]` for others.

Add a `NetworkInput` class that mimics Input's interface but reads from `remoteInputs`:

```javascript
class NetworkInput {
  constructor(remoteInputs, slot) { this.remote = remoteInputs; this.slot = slot; }
  movement(binding) {
    const r = this.remote[this.slot];
    if (!r) return { x: 0, y: 0 };
    let dx = 0, dy = 0;
    if (r.held.has(binding.up)) dy -= 1;
    if (r.held.has(binding.down)) dy += 1;
    if (r.held.has(binding.left)) dx -= 1;
    if (r.held.has(binding.right)) dx += 1;
    if (dx !== 0 && dy !== 0) { const inv = 1 / Math.SQRT2; dx *= inv; dy *= inv; }
    return { x: dx, y: dy };
  }
  pushPressed(binding) {
    const r = this.remote[this.slot];
    return !!(r && r.pushPressed);
  }
}
```

`_resolvePushes` and movement update functions iterate per-slot, picking the right input source.

- [ ] **Step 4: Adjust _resolvePushes / movement to use per-slot inputs**

Add `_inputForSlot(slot)`:
- If slot is local (slot === this.localSlot): return this.input
- Else: return new NetworkInput(this.remoteInputs, slot)

Cache the network inputs to avoid re-allocating each frame.

In `_resolvePushes`, use the per-slot input.

- [ ] **Step 5: Test serialization round-trip**

Create a small test in `tests/protocol.test.js`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
// Construct a fake state, serialize, deserialize, assert equal.
```

Skip if too much wiring. Manual smoke is OK.

- [ ] **Step 6: Commit**

```bash
git add src/game.js src/net.js tests/
git commit -m "feat(net): state snapshot serialization, network input source"
git push
```

---

## Task 8: Online game flow integration

**Files:**
- Modify: `src/main.js` - mode router (hot-seat vs host vs joiner)
- Modify: `src/game.js` - host loop sends state, joiner loop renders state, disconnect handling
- Create: `src/online-host.js`, `src/online-client.js` (optional split for clarity)

- [ ] **Step 1: Define Game modes**

Add `this.mode` to Game: `'local' | 'host' | 'joiner'`.

In `_frame`:
```javascript
if (this.mode === 'joiner') {
  // joiner: send local input, then render whatever state we last received
  if (this.room) {
    this.room.send({
      type: 'input',
      slot: this.localSlot,
      held: [...this.input.held],
      pushPressed: this.input.pushPressed(KEYS.p1),
      pausePressed: this.input.pausePressed(),
    });
  }
  // do not run physics; rendering uses applied state
  this.render();
  this.input.endFrame();
  requestAnimationFrame(this._frame);
  return;
}
// host or local: full update
this.update(dt);
if (this.mode === 'host' && this.state === STATE.PLAYING) {
  this._snapshotTimer = (this._snapshotTimer || 0) + dt;
  if (this._snapshotTimer >= 1 / 30) {
    this._snapshotTimer = 0;
    this.room.broadcast({ type: 'state', snapshot: this._serializeState() });
  }
}
this.render();
this.input.endFrame();
requestAnimationFrame(this._frame);
```

Actually, joiners must call `update(dt)` only for cosmetic things like particles. Easier: in joiner mode, just animate particles via `renderer.updateParticles(dt)` and skip physics.

- [ ] **Step 2: Host accepts joiners and assigns slots**

When a connection arrives:
```javascript
room.onConnection((conn) => {
  if (this.assignedSlots >= this.playerCount - 1) {
    conn.close();
    return;
  }
  this.assignedSlots++;
  const slot = this.assignedSlots; // 0 is host, joiners get 1..N-1
  conn.on('data', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.type === 'input') {
      this.remoteInputs[slot] = {
        held: new Set(msg.held),
        pushPressed: msg.pushPressed,
        pausePressed: msg.pausePressed,
      };
    }
  });
  conn.on('close', () => { this._endMatchOnDisconnect(slot); });
  // Send welcome with slot, player count, boxes
  conn.send(JSON.stringify({
    type: 'welcome',
    slot,
    playerCount: this.playerCount,
    boxes: this._serializeBoxes(),
  }));
});
```

- [ ] **Step 3: Joiner receives welcome and snapshots**

In joiner code:
```javascript
room.onMessage((msg) => {
  if (msg.type === 'welcome') {
    this.localSlot = msg.slot;
    this.playerCount = msg.playerCount;
    this._setupForPlayerCount(this.playerCount);
    this._applyBoxes(msg.boxes);
  } else if (msg.type === 'state') {
    this._applyState(msg.snapshot);
  }
});
```

- [ ] **Step 4: Disconnect handling**

```javascript
_endMatchOnDisconnect(slot) {
  this.disconnectMessage = `Player in slot ${slot + 1} disconnected`;
  this.state = STATE.GAME_OVER;
  // After short pause (or on Enter) return to menu
}
```

Joiner side: `room.onClose(() => { this.disconnectMessage = 'Host disconnected'; this.state = STATE.MENU; })`.

- [ ] **Step 5: Connect lobby to game**

When host clicks Start in lobby:
- Call `startMatch(this.playerCount)` which does the usual match setup AND broadcasts a `start` message to joiners.

When joiner receives `start`:
- Switch state to COUNTDOWN.

- [ ] **Step 6: Browser smoke test (2-player online)**

Open two browser windows (different profiles or incognito) at the GitHub Pages URL.
Window 1: Host -> player count 2 -> get code.
Window 2: Join -> enter code -> connects.
Window 1: Start match.
Both: see countdown, then play. P1 (window 1) uses WASD+Shift. P2 (window 2) uses... well, P2 in window 2 should also use WASD+Shift since it's the only local player. Adjust binding logic so each window's local player uses P1 controls regardless of slot.

- [ ] **Step 7: Commit**

```bash
git add src/main.js src/game.js
git commit -m "feat(net): host/joiner game modes, snapshot broadcast, disconnect"
git push
```

---

## Task 9: 6-player polish, game-over for N players, and final deploy

**Files:**
- Modify: `src/ui.js` - drawGameOver lists N final scores
- Modify: `src/render.js` - drawHUD for N players
- Final commit and verify deploy

- [ ] **Step 1: Game-over screen for N players**

```javascript
drawGameOver(winner, players) {
  // Show winner banner, then list all players' final scores sorted descending.
}
```

- [ ] **Step 2: HUD for N players**

3+ players: show scores in a horizontal row across the top, color-coded.

- [ ] **Step 3: 6-player smoke test**

Open 6 browser windows. Host -> 6 players. 5 join. Start. Verify match runs without errors.

- [ ] **Step 4: Tune entity counts if 6-player feels chaotic**

If too many mines/powerups, reduce in `ENTITY_SCALING`. Commit any tuning.

- [ ] **Step 5: Final commit and verify GitHub Pages deploy**

```bash
git add -A
git commit -m "feat(net): 6-player polish, multi-player game-over, final tuning"
git push
```

Wait 1 minute, refresh the GitHub Pages URL. Verify everything works.

- [ ] **Step 6: Update README with online instructions**

Add section in README:
```markdown
## Play online
1. Open the live URL: https://<github-username>.github.io/zone-wars/
2. Click Online -> Host Game -> pick player count -> share the 6-character room code with friends.
3. Friends open the same URL, click Online -> Join Game -> enter the code.
4. When everyone is connected, host clicks Start.
```

```bash
git add README.md
git commit -m "docs: online play instructions"
git push
```

---

## Done

Game is hosted online. 2-6 players can join from anywhere via room codes. Hot-seat 2-player still works. Matches end on win, elimination, or disconnect.
