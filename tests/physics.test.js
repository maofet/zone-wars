import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampToBounds } from '../src/physics.js';

test('clampToBounds: pulls circle inside left edge', () => {
  const result = clampToBounds({ x: -5, y: 50 }, 18, { w: 960, h: 540 });
  assert.equal(result.x, 18);
  assert.equal(result.y, 50);
});

test('clampToBounds: pulls circle inside right edge', () => {
  const result = clampToBounds({ x: 1000, y: 100 }, 18, { w: 960, h: 540 });
  assert.equal(result.x, 942);
  assert.equal(result.y, 100);
});

test('clampToBounds: pulls circle inside top and bottom', () => {
  const top = clampToBounds({ x: 100, y: -10 }, 18, { w: 960, h: 540 });
  assert.equal(top.y, 18);
  const bot = clampToBounds({ x: 100, y: 600 }, 18, { w: 960, h: 540 });
  assert.equal(bot.y, 522);
});

test('clampToBounds: leaves interior point unchanged', () => {
  const r = clampToBounds({ x: 480, y: 270 }, 18, { w: 960, h: 540 });
  assert.deepEqual(r, { x: 480, y: 270 });
});

import { resolveCircleVsBoxes } from '../src/physics.js';

test('resolveCircleVsBoxes: stops circle moving into box from left', () => {
  const boxes = [{ x: 100, y: 100, w: 40, h: 40 }];
  const result = resolveCircleVsBoxes({ x: 50, y: 120 }, { x: 95, y: 120 }, 18, boxes);
  assert.ok(result.x <= 100 - 18 + 0.01, `expected x clamped to 82-ish, got ${result.x}`);
  assert.equal(result.y, 120);
});

test('resolveCircleVsBoxes: stops circle moving into box from right', () => {
  const boxes = [{ x: 100, y: 100, w: 40, h: 40 }];
  const result = resolveCircleVsBoxes({ x: 200, y: 120 }, { x: 145, y: 120 }, 18, boxes);
  assert.ok(result.x >= 140 + 18 - 0.01);
  assert.equal(result.y, 120);
});

test('resolveCircleVsBoxes: slides along box edge when pushing diagonally into side', () => {
  const boxes = [{ x: 100, y: 100, w: 40, h: 40 }];
  const result = resolveCircleVsBoxes({ x: 50, y: 130 }, { x: 95, y: 135 }, 18, boxes);
  assert.ok(result.x <= 100 - 18 + 0.01, 'x should be clamped against left edge');
  assert.equal(result.y, 135, 'y should still advance freely');
});

test('resolveCircleVsBoxes: free movement when no box in path', () => {
  const boxes = [{ x: 500, y: 500, w: 40, h: 40 }];
  const result = resolveCircleVsBoxes({ x: 50, y: 50 }, { x: 100, y: 80 }, 18, boxes);
  assert.deepEqual(result, { x: 100, y: 80 });
});

test('resolveCircleVsBoxes: handles multiple boxes', () => {
  const boxes = [
    { x: 100, y: 100, w: 40, h: 40 },
    { x: 200, y: 100, w: 40, h: 40 },
  ];
  const result = resolveCircleVsBoxes({ x: 250, y: 120 }, { x: 245, y: 120 }, 18, boxes);
  assert.ok(result.x >= 240 + 18 - 0.01);
});

test('resolveCircleVsBoxes: stops circle moving into box from top', () => {
  const boxes = [{ x: 100, y: 100, w: 40, h: 40 }];
  const result = resolveCircleVsBoxes({ x: 120, y: 50 }, { x: 120, y: 95 }, 18, boxes);
  assert.ok(result.y <= 100 - 18 + 0.01);
  assert.equal(result.x, 120);
});

test('resolveCircleVsBoxes: stops circle moving into box from bottom', () => {
  const boxes = [{ x: 100, y: 100, w: 40, h: 40 }];
  const result = resolveCircleVsBoxes({ x: 120, y: 200 }, { x: 120, y: 145 }, 18, boxes);
  assert.ok(result.y >= 140 + 18 - 0.01);
  assert.equal(result.x, 120);
});

import { resolveCircleVsCircle } from '../src/physics.js';

test('resolveCircleVsCircle: pushes mover out when overlap occurs after move', () => {
  const other = { x: 100, y: 100 };
  const result = resolveCircleVsCircle({ x: 50, y: 100 }, { x: 80, y: 100 }, 18, other, 18);
  const dx = result.x - other.x;
  const dy = result.y - other.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  assert.ok(dist >= 36 - 0.01, `expected dist >= 36, got ${dist}`);
});

test('resolveCircleVsCircle: leaves mover unchanged when no overlap', () => {
  const result = resolveCircleVsCircle(
    { x: 50, y: 100 },
    { x: 60, y: 100 },
    18,
    { x: 200, y: 200 },
    18,
  );
  assert.deepEqual(result, { x: 60, y: 100 });
});

test('resolveCircleVsCircle: zero-distance fallback pushes right by minDist', () => {
  const other = { x: 100, y: 100 };
  const result = resolveCircleVsCircle({ x: 100, y: 100 }, { x: 100, y: 100 }, 18, other, 18);
  assert.equal(result.x, 136); // 100 + 18 + 18
  assert.equal(result.y, 100);
});

import { detectPushTarget, computePushTarget } from '../src/physics.js';

test('detectPushTarget: returns target when within range', () => {
  const attacker = { x: 100, y: 100 };
  const target = { x: 130, y: 100 };
  assert.equal(detectPushTarget(attacker, target, 50), true);
});

test('detectPushTarget: returns false when out of range', () => {
  const attacker = { x: 100, y: 100 };
  const target = { x: 200, y: 100 };
  assert.equal(detectPushTarget(attacker, target, 50), false);
});

test('computePushTarget: shifts target away from attacker by pushDistance', () => {
  const attacker = { x: 100, y: 100 };
  const target = { x: 130, y: 100 };
  const r = computePushTarget(attacker, target, 40);
  assert.equal(r.x, 170);
  assert.equal(r.y, 100);
});

test('computePushTarget: handles diagonal push', () => {
  const attacker = { x: 0, y: 0 };
  const target = { x: 30, y: 40 };
  const r = computePushTarget(attacker, target, 50);
  // direction is (3/5, 4/5), shift adds 50 in that direction -> (60, 80)
  assert.ok(Math.abs(r.x - 60) < 0.001);
  assert.ok(Math.abs(r.y - 80) < 0.001);
});

test('computePushTarget: zero distance falls back to no shift (degenerate)', () => {
  const attacker = { x: 100, y: 100 };
  const target = { x: 100, y: 100 };
  const r = computePushTarget(attacker, target, 40);
  assert.deepEqual(r, { x: 100, y: 100 });
});
