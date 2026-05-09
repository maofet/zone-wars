export function clampToBounds(pos, radius, bounds) {
  return {
    x: Math.max(radius, Math.min(bounds.w - radius, pos.x)),
    y: Math.max(radius, Math.min(bounds.h - radius, pos.y)),
  };
}
