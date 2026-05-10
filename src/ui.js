import { COLORS, SCORING, STORAGE_KEY } from './config.js';

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
    const cw = this.renderer.canvas.width;
    const ch = this.renderer.canvas.height;
    ctx.save();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = COLORS.textBright;
    ctx.textAlign = 'center';
    ctx.font = 'bold 72px system-ui, sans-serif';
    ctx.shadowColor = '#30b0ff';
    ctx.shadowBlur = 24;
    ctx.fillText('ZONE WARS', cw / 2, 140);
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
      ctx.fillText(item, cw / 2, y);
    });
    ctx.restore();
  }

  drawSettings(selectedIndex) {
    const ctx = this.renderer.ctx;
    const cw = this.renderer.canvas.width;
    const ch = this.renderer.canvas.height;
    ctx.save();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = COLORS.textBright;
    ctx.textAlign = 'center';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText('SETTINGS', cw / 2, 100);

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
      ctx.fillText(row, cw / 2, y);
    });
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('Up/Down to navigate, Esc to go back', cw / 2, ch - 40);
    ctx.restore();
  }

  drawHowToPlay() {
    const ctx = this.renderer.ctx;
    const cw = this.renderer.canvas.width;
    const ch = this.renderer.canvas.height;
    ctx.save();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = COLORS.textBright;
    ctx.textAlign = 'center';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText('HOW TO PLAY', cw / 2, 80);
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
      ctx.fillText(line, cw / 2, 140 + i * 30);
    });
    ctx.restore();
  }

  drawGameOver(winnerColor, winnerName, p1Score, p2Score) {
    const ctx = this.renderer.ctx;
    const cw = this.renderer.canvas.width;
    const ch = this.renderer.canvas.height;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = winnerColor;
    ctx.shadowColor = winnerColor;
    ctx.shadowBlur = 20;
    ctx.textAlign = 'center';
    ctx.font = 'bold 72px system-ui, sans-serif';
    ctx.fillText(`${winnerName} WINS!`, cw / 2, ch / 2 - 50);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.textBright;
    ctx.font = '32px system-ui, sans-serif';
    ctx.fillText(`${(p1Score / 10).toFixed(1)} : ${(p2Score / 10).toFixed(1)}`, cw / 2, ch / 2 + 10);
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('Enter = Restart    Esc = Main Menu', cw / 2, ch / 2 + 90);
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

  drawOnlineMenu(selectedIndex) {
    const ctx = this.renderer.ctx;
    const cw = this.renderer.canvas.width;
    const ch = this.renderer.canvas.height;
    ctx.save();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = COLORS.textBright;
    ctx.textAlign = 'center';
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.shadowColor = '#30b0ff';
    ctx.shadowBlur = 18;
    ctx.fillText('ONLINE', cw / 2, 130);
    ctx.shadowBlur = 0;

    const items = ['Host Game', 'Join Game', 'Back'];
    items.forEach((item, i) => {
      const y = 240 + i * 60;
      const selected = i === selectedIndex;
      ctx.font = selected ? 'bold 28px system-ui, sans-serif' : '24px system-ui, sans-serif';
      ctx.fillStyle = selected ? '#ffffff' : COLORS.textDim;
      if (selected) { ctx.shadowColor = '#30b0ff'; ctx.shadowBlur = 12; }
      else { ctx.shadowBlur = 0; }
      ctx.fillText(item, cw / 2, y);
    });
    ctx.restore();
  }

  drawHostSetup(playerCount) {
    const ctx = this.renderer.ctx;
    const cw = this.renderer.canvas.width;
    const ch = this.renderer.canvas.height;
    ctx.save();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = COLORS.textBright;
    ctx.textAlign = 'center';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText('HOST GAME', cw / 2, 120);
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('How many players?', cw / 2, 200);
    ctx.font = 'bold 96px system-ui, sans-serif';
    ctx.shadowColor = '#30b0ff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(playerCount), cw / 2, 320);
    ctx.shadowBlur = 0;
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('Left/Right to change (2-6)', cw / 2, 370);
    ctx.fillText('Enter to create room   |   Esc to go back', cw / 2, 400);
    ctx.restore();
  }

  drawHostLobby(code, connectedCount, targetCount) {
    const ctx = this.renderer.ctx;
    const cw = this.renderer.canvas.width;
    const ch = this.renderer.canvas.height;
    ctx.save();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = COLORS.textBright;
    ctx.textAlign = 'center';
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.fillText('SHARE THIS CODE WITH FRIENDS', cw / 2, 120);
    ctx.font = 'bold 96px monospace';
    ctx.shadowColor = '#30b0ff';
    ctx.shadowBlur = 28;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(code || '------', cw / 2, 240);
    ctx.shadowBlur = 0;
    ctx.font = '24px system-ui, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(`Players: ${connectedCount} / ${targetCount} connected`, cw / 2, 320);
    if (connectedCount >= 2) {
      ctx.fillStyle = '#40d060';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillText('Press Enter to start the match', cw / 2, 380);
    } else {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillText('Waiting for at least 1 friend to join...', cw / 2, 380);
    }
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('Esc to cancel', cw / 2, ch - 40);
    ctx.restore();
  }

  drawJoinInput(code, error) {
    const ctx = this.renderer.ctx;
    const cw = this.renderer.canvas.width;
    const ch = this.renderer.canvas.height;
    ctx.save();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = COLORS.textBright;
    ctx.textAlign = 'center';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText('JOIN GAME', cw / 2, 120);
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('Enter the 6-character room code', cw / 2, 180);
    // Render input: 6 boxes
    const slotW = 56;
    const totalW = slotW * 6 + 8 * 5;
    const baseX = cw / 2 - totalW / 2;
    for (let i = 0; i < 6; i++) {
      const sx = baseX + i * (slotW + 8);
      ctx.strokeStyle = i < code.length ? '#30b0ff' : '#3a3a5a';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, 230, slotW, 64);
      if (i < code.length) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px monospace';
        ctx.fillText(code[i], sx + slotW / 2, 276);
      }
    }
    if (error) {
      ctx.fillStyle = '#ff5070';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText(error, cw / 2, 340);
    }
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('Type letters/digits  |  Backspace to delete  |  Enter to connect  |  Esc to cancel', cw / 2, ch - 40);
    ctx.restore();
  }

  drawJoinWaiting(message) {
    const ctx = this.renderer.ctx;
    const cw = this.renderer.canvas.width;
    const ch = this.renderer.canvas.height;
    ctx.save();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = COLORS.textBright;
    ctx.textAlign = 'center';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText('CONNECTING...', cw / 2, ch / 2);
    if (message) {
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillStyle = COLORS.textDim;
      ctx.fillText(message, cw / 2, ch / 2 + 50);
    }
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('Esc to cancel', cw / 2, ch - 40);
    ctx.restore();
  }
}
