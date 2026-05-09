export class Zone {
  constructor({ x, y, radius, color, glow }, ownerId) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.color = color;
    this.glow = glow;
    this.ownerId = ownerId;
  }

  contains(point) {
    const dx = point.x - this.x;
    const dy = point.y - this.y;
    return dx * dx + dy * dy <= this.radius * this.radius;
  }
}
