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

    // cooldown ring (outer arc, fills back over PLAYER.pushCooldown seconds)
    if (player.cooldownTimer > 0) {
      const fraction = 1 - player.cooldownTimer / PLAYER.pushCooldown;
      ctx.save();
      ctx.strokeStyle = player.glow;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fraction);
      ctx.stroke();
      ctx.restore();
    }

    // shield indicator: cyan ring
    if (player.shieldTimer > 0) {
      ctx.save();
      ctx.shadowColor = '#40e0ff';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = '#40e0ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // speed indicator: yellow halo
    if (player.speedTimer > 0) {
      ctx.save();
      ctx.shadowColor = '#ffd040';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = '#ffd040';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // teleport-ready indicator: dashed magenta ring
    if (player.teleportPunchReady) {
      ctx.save();
      ctx.shadowColor = '#d040ff';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#d040ff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawMine(mine) {
    const ctx = this.ctx;
    const t = performance.now() / 100;
    const pulse = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(t));
    ctx.save();
    ctx.shadowColor = '#ff4040';
    ctx.shadowBlur = 10 + 6 * pulse;
    ctx.fillStyle = '#ff3030';
    ctx.beginPath();
    ctx.arc(mine.x, mine.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = '#1a0608';
    ctx.beginPath();
    ctx.arc(mine.x, mine.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawPowerUp(pu) {
    const ctx = this.ctx;
    const t = performance.now() / 200;
    const bob = Math.sin(t) * 3;
    const styles = {
      shield:   { fill: '#40e0ff', glow: '#80f0ff', label: 'S' },
      speed:    { fill: '#ffd040', glow: '#ffe080', label: '→' }, // right arrow
      teleport: { fill: '#d040ff', glow: '#e080ff', label: 'T' },
    };
    const s = styles[pu.type] || styles.shield;
    ctx.save();
    ctx.shadowColor = s.glow;
    ctx.shadowBlur = 18;
    ctx.fillStyle = s.fill;
    ctx.beginPath();
    ctx.arc(pu.x, pu.y + bob, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = '#0a0a18';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.label, pu.x, pu.y + bob);
    ctx.restore();
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

  drawHUD(players, target, matchTime = 0, pushBonusTenths = 10, minePenaltyTenths = 10) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const n = players.length;
    const spacing = Math.min(120, (CANVAS.width - 120) / n);
    const startX = CANVAS.width / 2 - ((n - 1) * spacing) / 2;
    for (let i = 0; i < n; i++) {
      const p = players[i];
      ctx.shadowColor = p.glow;
      ctx.shadowBlur = 8;
      ctx.fillStyle = p.alive ? '#ffffff' : '#666688';
      ctx.fillText((p.score / 10).toFixed(1), startX + i * spacing, 36);
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(`first to ${target}`, CANVAS.width / 2, 56);
    const min = Math.floor(matchTime / 60);
    const sec = Math.floor(matchTime % 60);
    const timer = `${min}:${String(sec).padStart(2, '0')}`;
    const push = (pushBonusTenths / 10).toFixed(1);
    const mine = (minePenaltyTenths / 10).toFixed(1);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`${timer}   push +${push}   mine -${mine}`, CANVAS.width / 2, 74);
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
