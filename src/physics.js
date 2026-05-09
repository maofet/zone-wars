export function clampToBounds(pos, radius, bounds) {
  return {
    x: Math.max(radius, Math.min(bounds.w - radius, pos.x)),
    y: Math.max(radius, Math.min(bounds.h - radius, pos.y)),
  };
}

function circleIntersectsAABB(cx, cy, r, box) {
  const closestX = Math.max(box.x, Math.min(cx, box.x + box.w));
  const closestY = Math.max(box.y, Math.min(cy, box.y + box.h));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < r * r;
}

export function resolveCircleVsBoxes(oldPos, newPos, radius, boxes) {
  let x = newPos.x;
  let y = oldPos.y;
  for (const box of boxes) {
    if (circleIntersectsAABB(x, y, radius, box)) {
      if (newPos.x > oldPos.x) x = box.x - radius;
      else if (newPos.x < oldPos.x) x = box.x + box.w + radius;
    }
  }
  let finalY = newPos.y;
  for (const box of boxes) {
    if (circleIntersectsAABB(x, finalY, radius, box)) {
      if (newPos.y > oldPos.y) finalY = box.y - radius;
      else if (newPos.y < oldPos.y) finalY = box.y + box.h + radius;
    }
  }
  return { x, y: finalY };
}
