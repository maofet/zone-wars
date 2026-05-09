import { KEYS } from './config.js';

export class Input {
  constructor() {
    this.held = new Set();
    this.pressed = new Set();
    this.handlers = {};
    const SCROLL_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
    this._onKeyDown = (e) => {
      if (SCROLL_KEYS.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.held.add(e.code);
      this.pressed.add(e.code);
    };
    this._onKeyUp = (e) => {
      this.held.delete(e.code);
    };
    this._onBlur = () => {
      this.held.clear();
      this.pressed.clear();
      console.log('[zone-wars] window blur (auto-pause if playing)');
      if (this.handlers.blur) this.handlers.blur();
    };
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
  }

  on(event, fn) {
    this.handlers[event] = fn;
  }

  // Returns velocity vector (-1..1, normalized) for a player's binding.
  movement(binding) {
    let dx = 0, dy = 0;
    if (this.held.has(binding.up)) dy -= 1;
    if (this.held.has(binding.down)) dy += 1;
    if (this.held.has(binding.left)) dx -= 1;
    if (this.held.has(binding.right)) dx += 1;
    if (dx !== 0 && dy !== 0) {
      const inv = 1 / Math.SQRT2;
      dx *= inv;
      dy *= inv;
    }
    return { x: dx, y: dy };
  }

  // True only on the frame the push key was first pressed.
  pushPressed(binding) {
    return this.pressed.has(binding.push);
  }

  pausePressed() {
    return this.pressed.has(KEYS.pause);
  }

  // Call at end of each frame after game logic reads `pressed`.
  endFrame() {
    this.pressed.clear();
  }
}
