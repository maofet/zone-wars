# Zone Wars

Local 2-player browser game. Two heroes on one keyboard battle for zone control.

## Run

The game uses ES modules, which Chrome blocks when opened directly via `file://`. Serve over HTTP instead:

```
npm run serve
```

Then open http://localhost:8000 in any modern browser.

(Safari and Firefox can also open `index.html` directly via file://, but Chrome cannot.)

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
