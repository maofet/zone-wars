import { CANVAS, COLORS, GRID, PLAYER } from './config.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
  }

  clear() {
    this.ctx.fillStyle = COLORS.bg;
    this.ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
  }

  drawGrid() {
    this.ctx.strokeStyle = COLORS.grid;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    for (let x = 0; x <= CANVAS.width; x += GRID.cellSize) {
      this.ctx.moveTo(x + 0.5, 0);
      this.ctx.lineTo(x + 0.5, CANVAS.height);
    }
    for (let y = 0; y <= CANVAS.height; y += GRID.cellSize) {
      this.ctx.moveTo(0, y + 0.5);
      this.ctx.lineTo(CANVAS.width, y + 0.5);
    }
    this.ctx.stroke();
  }

  drawZone(zone) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = zone.color;
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = zone.glow;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = zone.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawBox(box) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = COLORS.boxFill;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.shadowColor = COLORS.boxStroke;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = COLORS.boxStroke;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
    ctx.restore();
  }

  drawPlayer(player) {
    const ctx = this.ctx;
    const frozen = player.isFrozen();
    const pulse = frozen ? 0.6 + 0.4 * Math.sin(performance.now() / 50) : 1;
    ctx.save();
    ctx.shadowColor = player.glow;
    ctx.shadowBlur = 20;
    ctx.fillStyle = player.color;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // inner white ring
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius - 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // cooldown ring (outer arc, fills back over 5s)
    if (player.cooldownTimer > 0) {
      const fraction = 1 - player.cooldownTimer / 5;
      ctx.save();
      ctx.strokeStyle = player.glow;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fraction);
      ctx.stroke();
      ctx.restore();
    }
  }

  spawnPushParticles(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 80;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 0.25,
        maxLife: 0.25,
        color,
      });
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  drawParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawHUD(p1, p2, target) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = COLORS.textBright;
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff3060';
    ctx.shadowBlur = 8;
    ctx.fillText(String(p1.score), CANVAS.width / 2 - 60, 36);
    ctx.shadowColor = '#30b0ff';
    ctx.fillText(String(p2.score), CANVAS.width / 2 + 60, 36);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(`first to ${target}`, CANVAS.width / 2, 56);
    ctx.restore();
  }

  drawCenterText(line1, line2 = null, alpha = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${0.55 * alpha})`;
    ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
    ctx.fillStyle = COLORS.textBright;
    ctx.textAlign = 'center';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText(line1, CANVAS.width / 2, CANVAS.height / 2);
    if (line2) {
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillStyle = COLORS.textDim;
      ctx.fillText(line2, CANVAS.width / 2, CANVAS.height / 2 + 40);
    }
    ctx.restore();
  }
}
