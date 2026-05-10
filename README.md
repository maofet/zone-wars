# Zone Wars

Browser game for 2-6 players - local or online. Heroes battle for zone control.

## Play online

The game is hosted at **https://maofet.github.io/zone-wars/**

1. Open the URL above.
2. Click **Online** -> **Host Game** -> pick player count (2-6) -> share the 6-character room code with friends (Telegram, WhatsApp, etc).
3. Friends open the same URL, click **Online** -> **Join Game** -> enter the code.
4. When everyone is connected, host presses **Enter** to start the match.
5. Each player uses **WASD** to move, **Left Shift** to push (in their own browser).
6. Disconnect = match ends for everyone.

Up to **6 players** per room. The arena and entity counts scale with player count.

## Run locally (for development)

The game uses ES modules - serve over HTTP:

```
npm run serve
```

Then open http://localhost:8000 in any modern browser.

## Controls

| Action | Player 1 (red) | Player 2 (blue) |
|---|---|---|
| Move | WASD | Arrow keys |
| Push | Left Shift | Enter |
| Pause | Space | Space |

## Tests

Physics tests run via Node 20+:

```
npm test
```

## Manual smoke test checklist

After any change, verify:
- [ ] Main menu shows Start / Settings / How to Play
- [ ] Settings persists target score after reload
- [ ] Countdown plays before match
- [ ] Both players move with their keys
- [ ] Players collide with boxes and arena edges
- [ ] Push freezes target for 1s, shifts them ~1 cell, animates briefly
- [ ] Cooldown ring under attacker fills back over 5s
- [ ] Whiff push (no target in range) still triggers cooldown
- [ ] Score ticks once per second while inside opponent's zone
- [ ] Reaching target score ends match with winner overlay
- [ ] Pause / resume on Space, alt-tab auto-pauses
- [ ] Restart and Main Menu buttons work
