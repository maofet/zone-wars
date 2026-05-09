export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  // Must be called from a user gesture (e.g. click) due to browser policy.
  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) this.ctx = new Ctx();
  }

  setMuted(value) {
    this.muted = value;
  }

  _tone({ freq, duration = 0.12, type = 'sine', gain = 0.18, attack = 0.005, release = 0.05 }) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.linearRampToValueAtTime(0, t + duration + release);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + duration + release);
  }

  countdownTick() { this._tone({ freq: 440, duration: 0.1 }); }
  countdownGo()   { this._tone({ freq: 880, duration: 0.2, gain: 0.22 }); }
  pushImpact()    { this._tone({ freq: 180, duration: 0.08, type: 'square', gain: 0.16 }); }
  scoreMilestone(){ this._tone({ freq: 720, duration: 0.12, gain: 0.12 }); }

  win() {
    if (!this.ctx || this.muted) return;
    const seq = [523, 659, 784, 1047];
    seq.forEach((f, i) => {
      setTimeout(() => this._tone({ freq: f, duration: 0.18, gain: 0.2 }), i * 140);
    });
  }
}
