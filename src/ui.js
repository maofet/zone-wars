import { CANVAS, COLORS, SCORING, STORAGE_KEY } from './config.js';

const TARGET_OPTIONS = [50, 100, 200];
const PUSH_MAX_OPTIONS = [3, 5, 7, 10];
const MINE_MAX_OPTIONS = [3, 5, 7, 10];
const DEFAULT_PUSH_MAX = 5;
const DEFAULT_MINE_MAX = 5;

export class UI {
  constructor(renderer) {
    this.renderer = renderer;
    this.settings = this._loadSettings();
    this.menuSelection = 0;
    this.settingsSelection = 0;
  }

  _loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) throw new Error('no settings');
      const obj = JSON.parse(raw);
      return {
        targetScore: TARGET_OPTIONS.includes(obj.targetScore) ? obj.targetScore : SCORING.defaultTarget,
        muted: !!obj.muted,
        pushMax: PUSH_MAX_OPTIONS.includes(obj.pushMax) ? obj.pushMax : DEFAULT_PUSH_MAX,
        mineMax: MINE_MAX_OPTIONS.includes(obj.mineMax) ? obj.mineMax : DEFAULT_MINE_MAX,
      };
    } catch {
      return {
        targetScore: SCORING.defaultTarget,
        muted: false,
        pushMax: DEFAULT_PUSH_MAX,
        mineMax: DEFAULT_MINE_MAX,
      };
    }
  }

  saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
  }

  drawMenu(items, selectedIndex) {
    const ctx = this.renderer.ctx;
    ctx.save();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
    ctx.fillStyle = COLORS.textBright;
    ctx.textAlign = 'center';
    ctx.font = 'bold 72px system-ui, sans-serif';
    ctx.shadowColor = '#30b0ff';
    ctx.shadowBlur = 24;
    ctx.fillText('ZONE WARS', CANVAS.width / 2, 140);
    ctx.shadowBlur = 0;

    items.forEach((item, i) => {
      const y = 260 + i * 60;
      const selected = i === selectedIndex;
      ctx.font = selected ? 'bold 28px system-ui, sans-serif' : '24px system-ui, sans-serif';
      ctx.fillStyle = selected ? '#ffffff' : COLORS.textDim;
      if (selected) {
        ctx.shadowColor = '#30b0ff';
        ctx.shadowBlur = 12;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fillText(item, CANVAS.width / 2, y);
    });
    ctx.restore();
  }

  drawSettings(selectedIndex) {
    const ctx = this.renderer.ctx;
    ctx.save();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
    ctx.fillStyle = COLORS.textBright;
    ctx.textAlign = 'center';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText('SETTINGS', CANVAS.width / 2, 100);

    const rows = [
      `Target score: ${this.settings.targetScore}  (Left/Right to change)`,
      `Sound: ${this.settings.muted ? 'OFF' : 'ON'}  (Enter to toggle)`,
      `Push max: +${this.settings.pushMax}.0  (Left/Right to change)`,
      `Mine max: -${this.settings.mineMax}.0  (Left/Right to change)`,
      'Back',
    ];
    rows.forEach((row, i) => {
      const y = 200 + i * 50;
      const selected = i === selectedIndex;
      ctx.font = selected ? 'bold 22px system-ui, sans-serif' : '20px system-ui, sans-serif';
      ctx.fillStyle = selected ? '#ffffff' : COLORS.textDim;
      ctx.fillText(row, CANVAS.width / 2, y);
    });
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('Up/Down to navigate, Esc to go back', CANVAS.width / 2, CANVAS.height - 40);
    ctx.restore();
  }

  drawHowToPlay() {
    const ctx = this.renderer.ctx;
    ctx.save();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
    ctx.fillStyle = COLORS.textBright;
    ctx.textAlign = 'center';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText('HOW TO PLAY', CANVAS.width / 2, 80);
    ctx.font = '18px system-ui, sans-serif';
    const lines = [
      'Two players share one keyboard.',
      '',
      'Player 1 (red):  WASD to move, Left Shift to push',
      'Player 2 (blue): Arrow keys to move, Enter to push',
      'Pause: Space   |   Menu confirm: Enter',
      '',
      'Scoring: +0.1 per second in opponent\'s zone, +1 per successful push.',
      'Stay 5+ seconds in opponent\'s zone and you teleport home.',
      '',
      'Hazards: red mines spawn every 5s. Touch one and lose 1 point + knockback.',
      'Power-ups (every 20s): S = shield (3s), -> = 2x speed (3s), T = teleport-punch.',
      '',
      'Push cooldown: 5s. Push range: 60 px. Boxes randomized each match.',
      '',
      'Press any key to go back.',
    ];
    lines.forEach((line, i) => {
      ctx.fillStyle = i === lines.length - 1 ? COLORS.textDim : COLORS.textBright;
      ctx.fillText(line, CANVAS.width / 2, 140 + i * 30);
    });
    ctx.restore();
  }

  drawGameOver(winnerColor, winnerName, p1Score, p2Score) {
    const ctx = this.renderer.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
    ctx.fillStyle = winnerColor;
    ctx.shadowColor = winnerColor;
    ctx.shadowBlur = 20;
    ctx.textAlign = 'center';
    ctx.font = 'bold 72px system-ui, sans-serif';
    ctx.fillText(`${winnerName} WINS!`, CANVAS.width / 2, 220);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.textBright;
    ctx.font = '32px system-ui, sans-serif';
    ctx.fillText(`${(p1Score / 10).toFixed(1)} : ${(p2Score / 10).toFixed(1)}`, CANVAS.width / 2, 280);
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('Enter = Restart    Esc = Main Menu', CANVAS.width / 2, 360);
    ctx.restore();
  }

  drawPaused() {
    this.renderer.drawCenterText('PAUSED', 'Space to resume');
  }

  cycleTarget(dir) {
    const idx = TARGET_OPTIONS.indexOf(this.settings.targetScore);
    const next = (idx + dir + TARGET_OPTIONS.length) % TARGET_OPTIONS.length;
    this.settings.targetScore = TARGET_OPTIONS[next];
    this.saveSettings();
  }

  cyclePushMax(dir) {
    const idx = PUSH_MAX_OPTIONS.indexOf(this.settings.pushMax);
    const next = (idx + dir + PUSH_MAX_OPTIONS.length) % PUSH_MAX_OPTIONS.length;
    this.settings.pushMax = PUSH_MAX_OPTIONS[next];
    this.saveSettings();
  }

  cycleMineMax(dir) {
    const idx = MINE_MAX_OPTIONS.indexOf(this.settings.mineMax);
    const next = (idx + dir + MINE_MAX_OPTIONS.length) % MINE_MAX_OPTIONS.length;
    this.settings.mineMax = MINE_MAX_OPTIONS[next];
    this.saveSettings();
  }

  toggleMuted() {
    this.settings.muted = !this.settings.muted;
    this.saveSettings();
  }
}
