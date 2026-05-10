# Zone Wars Online (Phase B) - Design Spec

- **Date:** 2026-05-09
- **Owner:** Artem Merkulov
- **Status:** Approved scope; implementation plan to follow
- **Builds on:** `2026-05-09-zone-wars-design.md` (the original hot-seat game)

## 1. Overview

Add online multiplayer for 2-6 players via PeerJS WebRTC. One player hosts, others join with a 6-character room code. Map size and entity counts scale with the player count. Hosted as static files on GitHub Pages. Existing hot-seat 2-player mode is preserved (just renamed in the menu).

## 2. Goals and non-goals

**Goals:**
- Host a public URL on GitHub Pages.
- Online play for 2-6 players, each on their own browser, no server-side game logic.
- Lobby with 6-char room codes (host shows it, joiner enters it).
- Map and entity scaling that makes 6-player feel different from 2-player without being chaotic.
- Per-player zone with a unique color (red, blue, green, yellow, purple, cyan).
- Disconnect handling (return to menu with notification, no reconnect).

**Non-goals:**
- Reconnect after a disconnect (match ends immediately).
- Chat, voice, or spectators.
- Persistent stats, account system, leaderboards.
- Server-authoritative game state (host PC is the authority).
- Lag compensation beyond simple snapshot-then-render.
- Hot-seat support beyond 2 players (one keyboard physically can't fit more).

## 3. User flow

1. Main menu becomes: `Local 2-Player`, `Online`, `Settings`, `How to Play`.
2. **Online** opens a sub-menu: `Host Game`, `Join Game`, `Back`.
3. **Host Game** -> player count selector (2-6) -> "Hosting" screen with the 6-char code displayed prominently and a list `Players: 1/N` ticking up as joiners connect.
4. **Join Game** -> code input (6 letters/digits) -> "Connecting..." -> when accepted, lobby view shows room code and player count.
5. When all expected players are connected, the host clicks **Start** -> 3-2-1 countdown -> match begins.
6. Match plays normally with all networked players.
7. **End of match:** winner announced, host can choose **Restart** (re-run countdown) or **Main Menu** (closes room for everyone).
8. **Disconnect mid-match:** match ends immediately, all clients return to main menu with a notification "Player disconnected".

## 4. Architecture

### Topology
- Host-authoritative. Host PC runs the entire game loop and physics, just like in hot-seat.
- Joiners send only their input (held keys + push press) and render the state they receive from the host.

### Networking
- PeerJS (browser library) over WebRTC. No game server required.
- Free public PeerJS Cloud signaling is used to bootstrap the connection. After connection, all data flows peer-to-peer.
- Host's PeerJS ID is the room code (6 random uppercase letters/digits).

### Protocol
- **Joiner -> Host**, every frame (~60 Hz): `{type: 'input', heldKeys: [...], pushPressed: bool, pausePressed: bool}`.
- **Host -> Joiner**, ~30 Hz: `{type: 'state', t: matchTime, players: [...], mines: [...], powerUps: [...], boxes: [...], state: 'playing'|'paused'|...}`. Boxes only sent when changed (start of match), not every snapshot.

### Disconnect
- PeerJS fires close/error events. Host or joiner detecting a closed connection ends the match for everyone in that room.

## 5. Game changes for N players

### Players
- Refactor from `this.p1`, `this.p2` to `this.players = [Player, Player, ...]`.
- Each Player has: `slot` (0..5), `color`, `glow`, `zoneIndex` (matches zone array), `start` (assigned at match start).
- Hot-seat keeps slot 0 (P1, WASD+Shift) and slot 1 (P2, Arrows+Enter).
- Online: each browser controls one slot. Local input drives that slot, network drives the others.

### Zones
- N zones, one per player. Color order: red, blue, green, yellow, purple, cyan.
- Positions are evenly distributed around the map. For N players the centers are at the corners of an inscribed regular N-gon, mapped onto the rectangular play area with margin.
- Each player scores by being inside ANY other player's zone (not their own). Zone-eject still applies if a player stays in any other player's zone for 5 seconds.

### Map sizing
The canvas size scales with player count to give everyone room:

| Players | Canvas (px) |
|---|---|
| 2 | 960 x 540 |
| 3 | 1080 x 600 |
| 4 | 1200 x 660 |
| 5 | 1320 x 720 |
| 6 | 1440 x 780 |

Player-position coordinates and zone radii are computed relative to the chosen canvas at match start. Existing physics (clamp, collision, push) already takes bounds as parameters, so it works at any size.

### Entity scaling
| Entity | Scale rule |
|---|---|
| Boxes | base 13, +2 per extra player (15 / 17 / 19 / 21 / 23) |
| Mines per spawn | base 2, +1 per 2 extra players (2 / 2 / 3 / 3 / 4) |
| Mines max on map | base 20, +5 per extra player (25 / 30 / 35 / 40) |
| Power-ups per spawn | 1 always (rare drops feel right) |
| Power-up spawn interval | constant 20s |

### Win/lose conditions
- First player to reach `targetScore` wins.
- A player who falls to `LOSE_SCORE_TENTHS` (-10.0) is eliminated and removed from the match. They go to a "spectator" state on their browser showing the rest of the match.
- Match ends when only one active player remains, or one player wins by score. Last-standing player wins if score race didn't finish.

## 6. UI changes

- Main menu adds `Local 2-Player` and `Online` separation.
- New screens: Online sub-menu, Host lobby, Join code input, Joiner waiting room.
- Lobby shows room code, player count target, current connected players, and a `Start Match` button (host only).
- Connection status overlay during match: small "ping ms" indicator in corner. Skip if it adds too much UI noise; defer.
- Game-over screen lists final scores for all N players.

## 7. Technical scope

### New files
- `src/net.js` - PeerJS wrapper: room code generation, host/join helpers, message send/receive, disconnect events.
- `src/lobby.js` - Lobby screens (host code display, join input, waiting room).

### Major modifications
- `src/game.js` - Replace `p1`/`p2` with `players[]`. Take canvas size as parameter, not hardcoded constant. Take entity counts from match config.
- `src/render.js` - Accept dynamic canvas size; use logical coords. drawHUD shows N scores.
- `src/ui.js` - Add online menus.
- `src/main.js` - Route between hot-seat and online modes.
- `src/config.js` - Add MAP_SIZES, ENTITY_SCALING, ZONE_COLORS arrays.
- `index.html` - Add PeerJS CDN script tag, dynamically size canvas.

### Hosting
- Initialize a GitHub repo (existing local repo at `~/workspace/games/zone-wars/`).
- Push to GitHub via `gh` CLI (install via `brew install gh` if not present).
- Enable GitHub Pages on the `main` branch.
- The game lives at `https://<github-username>.github.io/zone-wars/`.
- Each future commit auto-deploys.

## 8. Out of scope (explicit)

- AI opponents.
- Mobile / touch controls.
- More than 6 players.
- Custom skins or names.
- Tournament / bracket modes.
- Sound chat / video.

## 9. Risks

- **PeerJS Cloud reliability** - if the public signaling server is down, no one can connect. Acceptable for MVP; can self-host later.
- **NAT / firewall traversal** - WebRTC usually traverses NAT but some restrictive firewalls (corporate, hotel) block STUN/TURN. PeerJS Cloud includes a STUN. No private TURN server in MVP, so symmetric-NAT users may fail to connect.
- **Latency** - 30 Hz state snapshots can feel choppy under high latency. If unacceptable, add interpolation later.
- **Cheating** - host has authority. For friendly play this is fine; not for competitive ranked play (out of scope).

## 10. Acceptance for completion of Phase B

- Hosted at a public GitHub Pages URL.
- Two browsers in different networks (e.g. on different Wi-Fi) can connect via room code and play a 2-player match.
- A 4-player match works (4 browsers, 4 zones, scaled map).
- A 6-player match works (6 browsers, 6 zones, fully scaled).
- Disconnect of any player ends the match for everyone with a notification.
- Hot-seat 2-player mode (Local 2-Player) still works exactly as before.
