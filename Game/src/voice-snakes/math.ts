import type { Vec2 } from './types';

export function dist2(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function normalizeAngle(rad: number): number {
  const twoPi = Math.PI * 2;
  const wrapped = rad % twoPi;
  return wrapped < 0 ? wrapped + twoPi : wrapped;
}

export function signedAngleDelta(fromRad: number, toRad: number): number {
  // Return delta in [-pi, +pi]
  const twoPi = Math.PI * 2;
  let d = (toRad - fromRad) % twoPi;
  if (d > Math.PI) d -= twoPi;
  if (d < -Math.PI) d += twoPi;
  return d;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function degWrap180(deg: number): number {
  // Wrap to [-180, 180)
  return ((deg + 180) % 360 + 360) % 360 - 180;
}
