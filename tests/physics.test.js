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
