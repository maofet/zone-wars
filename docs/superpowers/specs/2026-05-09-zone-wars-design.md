# Zone Wars - Design Spec

- **Date:** 2026-05-09
- **Owner:** Artem Merkulov
- **Project root:** `~/workspace/games/zone-wars/`
- **Type:** 2D top-down browser game, local 2-player on one keyboard
- **Status:** Approved for implementation planning

## 1. Overview

Zone Wars is a small browser game where two players, sharing one keyboard, compete to score points by occupying each other's zone on a top-down arena. Players can push each other to interrupt scoring. The game is intentionally minimal in scope: one map, two players, one game mode.

The product is a single static folder that runs by opening `index.html` in any modern browser. No build step, no server, no dependencies.

## 2. Goals and non-goals

**Goals (MVP):**
- Local hot-seat multiplayer for exactly two players on one keyboard.
- Smooth continuous movement with collision against obstacles and arena borders.
- Working push mechanic with cooldown, freeze, and visual feedback.
- Real-time scoring while in opponent's zone.
- Match start countdown, pause, and end-of-match flow.
- Neon-arcade visual style with simple sound effects.
- Settings persisted across sessions (target score).

**Non-goals (out of scope):**
- Online multiplayer or networking.
- AI opponents or single-player mode.
- More than one map, theme, or game mode.
- Mobile / touch controls.
- Custom key rebinding UI.
- Account system, leaderboards, persistent stats.
- Asset pipelines, sprite sheets, or animation rigs - everything is drawn programmatically on Canvas.

## 3. Player-facing experience

### 3.1 Game flow

1. **Main Menu** - 3 buttons: `Start Game`, `Settings`, `How to Play`.
2. **Settings** - target score selector (50 / 100 / 200, default 100). Saved to localStorage.
3. **How to Play** - static screen with control diagram and rules summary.
4. **Countdown** - arena visible, players visible at start positions, large `3 -> 2 -> 1 -> GO!` text in center, beep on each tick.
5. **Match** - players move and push, scores accumulate, HUD always visible.
6. **Pause** - Space at any time during match: dim overlay with `PAUSED`. Space again resumes.
7. **Game Over** - first player to target score triggers end. Dim overlay with winner text and final score, fanfare sound, `[Restart]` and `[Main Menu]` buttons.

### 3.2 Controls

| Action | Player 1 (red) | Player 2 (blue) |
|---|---|---|
| Move | W A S D | Arrow keys |
| Push | Left Shift | Enter |
| Pause / resume | Space (shared) | Space (shared) |

Multiple keys held simultaneously combine (e.g. W + D = move up-right). All inputs polled every frame.

### 3.3 HUD layout

- **Top center:** scoreboard `RED 27 : 14 BLUE / 100`. Numbers grow slightly on each point tick.
- **Around each player's avatar:** a thin ring (cooldown indicator). Empty after a push, fills back over 5 seconds. When full, the player can push again.
- **Frozen state:** the affected player's circle desaturates and pulses for 1 second.

### 3.4 Visual style: Neon arcade

- Dark blue-black background (`#0a0a18`).
- Faint grid (cells outlined in `#1a1a3a`) covering the play area.
- Red zone: filled with `rgba(255, 32, 80, 0.15)`, outline `#ff3060` plus a soft outer glow via `shadowBlur`.
- Blue zone: filled with `rgba(32, 160, 255, 0.15)`, outline `#30b0ff` plus glow.
- Boxes: dark interior `#1a1a2a`, neon cyan outline `#a0e0ff`.
- Players: solid bright fill (`#ff3060` for P1, `#30b0ff` for P2), white inner border, outer glow.
- Push impact: short particle burst (8-12 small circles, ~250ms, fading).
- All glow effects use Canvas `shadowColor` + `shadowBlur` (no external libs).

## 4. World and geometry

- **Canvas size:** 960 x 540 pixels (16:9), centered horizontally on the page with a 1:1 internal coordinate system.
- **Internal grid (logical only, for placement):** 24 columns x 13.5 rows, cell size 40 px. Used as a placement reference; movement is continuous (subpixel coordinates).
- **Arena borders:** the full canvas. Players cannot leave the rectangle.
- **Layout (variant B - "Corridor"):**
  - Red zone: circle, center (160, 270), radius 80.
  - Blue zone: circle, center (800, 270), radius 80.
  - 6 wooden boxes (40 x 40 each), forming a vertical chain that splits the middle. Approximate placement (top-left corner of each box):
    - (460, 80), (460, 160) - upper pair
    - (340, 250), (580, 250) - middle pair (left and right of center)
    - (460, 360), (460, 440) - lower pair
  - Player 1 (red) start: (480, 60).
  - Player 2 (blue) start: (480, 480).
  - All exact coordinates are tunable in `config.js` after first playtest.

## 5. Mechanics

### 5.1 Movement

- Continuous, axis-aligned input. Each player has a velocity vector derived from currently held keys.
- Constant move speed: 220 px/sec. Diagonal speed normalized so the player isn't faster diagonally.
- Player hitbox: circle, radius 18 px.

### 5.2 Collisions

- **Player vs arena border:** the player's center is clamped so the circle stays fully inside the canvas.
- **Player vs box:** circle-vs-AABB resolution. The player slides along the box edge if they push into it (no bouncing).
- **Player vs player:** they cannot overlap. If a move would cause overlap, the moving player is stopped at the contact distance.
- **Player vs zone:** zones are non-blocking visual regions. Membership test is `distance(player_center, zone_center) <= zone_radius`.

### 5.3 Push

- **Trigger:** attacker presses their push key. Push key only fires when attacker's cooldown is 0.
- **Range and target selection:** attacker checks if the *other* player's center is within 50 px of attacker's center. If yes, that player is the target.
- **Effect on target:**
  - Target enters frozen state for 1.0 second. During freeze: target ignores all movement input (input is dropped, not buffered).
  - Target's position is shifted by 40 px in the direction `from attacker to target` (vector normalized x 40). The shift is done as a continuous slide over ~120ms, not a teleport, and is clamped by collisions: if a wall or box blocks the slide, the target stops at the contact point but still freezes for the full 1 second.
- **Effect on attacker:**
  - Attacker enters cooldown state for 5.0 seconds. During cooldown: push key presses are ignored.
- **Simultaneous pushes:** if both players are in range of each other and both press push in the same frame, both pushes resolve independently. Both are frozen, both go on cooldown. The shifts are computed using positions at the start of the frame (no order-of-operations advantage).
- **No target in range:** push key press still puts the attacker on cooldown (slight cost for whiffed pushes - keeps gameplay tight). Visual: a tiny "miss" flash on the attacker.

### 5.4 Scoring

- Score is integer for each player.
- Once per second of game time, for each player, if that player's center is inside the *opposing* zone, that player gains 1 point. Tick is on a fixed 1.0-second cadence aligned to match start; pause time is excluded.
- Visual: number on HUD increments with brief scale-up; on every 10 points, a soft "score milestone" sound plays.
- Win condition: first player to reach the target score wins. The target is read from settings at match start.

### 5.5 Game state machine

States: `MENU`, `SETTINGS`, `HOW_TO_PLAY`, `COUNTDOWN`, `PLAYING`, `PAUSED`, `GAME_OVER`.

Transitions:
- `MENU` -> `COUNTDOWN` (on Start Game)
- `MENU` -> `SETTINGS` / `HOW_TO_PLAY` (and back via Back button)
- `COUNTDOWN` -> `PLAYING` (after 3 seconds)
- `PLAYING` -> `PAUSED` (on Space) -> `PLAYING` (on Space again)
- `PLAYING` -> `GAME_OVER` (when target score reached)
- `GAME_OVER` -> `COUNTDOWN` (on Restart) or `MENU` (on Main Menu)

## 6. Audio

Web Audio API, 4 sound effects shipped as small files in `assets/sounds/`:

| Event | Sound |
|---|---|
| Countdown tick (3, 2, 1) | short beep |
| Countdown go | higher beep |
| Push impact | short thump |
| Score milestone (every 10 pts) | soft chime |
| Win | 1-2 second fanfare |

All sounds short (< 1 second each). Volume normalized. Single shared mute toggle in Settings (boolean, persisted).

## 7. Settings and persistence

Stored in `localStorage` under key `zoneWarsSettings`:

```json
{
  "targetScore": 100,
  "muted": false
}
```

Loaded on app start; defaults applied if missing or corrupt.

## 8. Tech stack

- **Runtime:** any modern browser (Chrome, Safari, Firefox latest).
- **Language:** JavaScript ES2022 modules.
- **Rendering:** HTML5 Canvas 2D.
- **Audio:** Web Audio API.
- **No external libraries, no build step, no transpilation.**
- **No backend.** Pure static files.

## 9. File structure

```
zone-wars/
  index.html
  styles.css
  src/
    main.js          entry, bootstraps Game
    game.js          Game class, state machine, top-level loop
    config.js        all tunable constants
    entities/
      player.js
      box.js
      zone.js
    physics.js       collisions, push resolution, border clamp
    input.js         keyboard handler, action mapping
    render.js        canvas drawing with neon style
    audio.js         SFX player wrapping Web Audio API
    ui.js            menus, HUD, overlays
  assets/
    sounds/          *.wav or *.mp3
  docs/superpowers/specs/2026-05-09-zone-wars-design.md
  README.md
```

Each file targets < 200 lines. If a file grows beyond that during implementation, split it.

## 10. Main loop

Standard `requestAnimationFrame` loop with delta time:

1. Read input (keyboard state).
2. Update game state (depends on current state - menu vs playing vs paused etc.).
3. In `PLAYING`: advance physics by `dt`, run scoring tick if 1.0s has accumulated, check win condition, update timers (freezes, cooldowns).
4. Render: clear canvas, draw zones, draw boxes, draw players (with effects), draw particles, draw HUD overlay.

Time accounting uses `performance.now()`. The 1-second scoring tick uses an accumulator, not wall clock, so pause cleanly excludes paused time.

## 11. Edge cases handled

- Both players in same zone simultaneously: each player only scores in the *opposing* zone, so being in your own zone gives nothing. Both players in red zone -> only blue scores.
- Player gets pushed exactly onto a zone edge: standard distance check next tick decides.
- Player tries to move into a corner formed by box and border: slide resolution stops cleanly without penetrating.
- Window loses focus mid-match: auto-pause (treat as Space). Resume requires Space.
- Browser tab throttled in background: delta time clamped to <= 100ms per frame so physics doesn't jump.
- Player presses push immediately after being unfrozen: works normally if their cooldown is 0 (cooldown is independent of freeze).
- Both players try to occupy the same point: collision-resolution code already prevents overlap; in degenerate case (start positions overlap due to misconfig), positions are nudged apart at match start.

## 12. Testing approach

This is a tiny self-contained game. Testing:

- **Manual smoke test checklist** in README, exercised on each change: each control works, push freezes, cooldown shows, scoring ticks, win triggers, restart works, pause works.
- **Headless physics tests** for `physics.js` (collision resolution, push slide) using simple `node --test` style or a small inline runner that the user can run from the terminal. Covers: circle-AABB slide, border clamp, push direction calculation, simultaneous push.
- **No UI/visual regression tests** in MVP. The neon style is mature enough that visual issues are obvious during smoke tests.

## 13. Risks and tradeoffs

- **Continuous movement + circle-AABB collision** is more code than a grid-based approach but matches the Brawl Stars feel that was requested. Expected ~50-80 lines in `physics.js` for the resolution logic.
- **Web Audio init** requires a user gesture in some browsers. Sound system initializes on first click in main menu, not on page load.
- **Performance** is not a concern: ~10 entities, ~60 fps trivially achievable on any device.
- **Sound assets** need to be sourced (CC0 / freesound or generated). If sourcing is slow, fallback to programmatically generated tones via OscillatorNode for first iteration.

## 14. Future extensions (not MVP)

Listed for context only:
- More maps, map selector.
- Power-ups (speed boost, longer push, shield).
- Online play.
- Touch / gamepad controls.
- Stats tracking across matches.

These are explicitly out of scope and are not designed against here.
