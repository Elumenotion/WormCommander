import {
  SENSE_MAX_PELLETS,
  SENSE_MAX_SNAKES,
  SENSE_RANGE,
  SENSE_SEGMENTS_PER_SNAKE,
  SNAKE_RADIUS,
  SPEED_PX_PER_SEC,
} from './constants';
import { degWrap180, radToDeg } from './math';
import { targetLength } from './state';
import type {
  WormState,
  WormSenses,
  WormSensesOptions,
  WormSensesPellet,
  WormSensesSnake,
  WormSensesSnakeBodyPoint,
} from './types';

export function headingDeg(state: WormState): number {
  return ((radToDeg(state.angle) % 360) + 360) % 360;
}

export function bearingDegFromHeading(state: WormState, dx: number, dy: number): number {
  const bearing = radToDeg(Math.atan2(dy, dx));
  return degWrap180(bearing - headingDeg(state));
}

export function getWormSenses(state: WormState, options?: WormSensesOptions): WormSenses {
  const opts = options || {};
  const range = typeof opts.range === 'number' ? opts.range : SENSE_RANGE;
  const maxPellets = typeof opts.maxPellets === 'number' ? opts.maxPellets : SENSE_MAX_PELLETS;
  const maxSnakes = typeof opts.maxSnakes === 'number' ? opts.maxSnakes : SENSE_MAX_SNAKES;
  const segmentsPerSnake = typeof opts.segmentsPerSnake === 'number' ? opts.segmentsPerSnake : SENSE_SEGMENTS_PER_SNAKE;

  const head = state.trail[0] || { x: 0, y: 0 };
  const range2 = range * range;

  const pellets = state.foods
    .map((p, idx): WormSensesPellet | null => {
      const dx = p.x - head.x;
      const dy = p.y - head.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > range2) return null;
      const dist = Math.sqrt(d2);
      return {
        id: `p${idx}`,
        dist: Math.round(dist * 10) / 10,
        bearing_deg: Math.round(bearingDegFromHeading(state, dx, dy) * 10) / 10,
        value: 1,
        color_hue: p.hue,
      };
    })
    .filter((x): x is WormSensesPellet => x !== null)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, maxPellets);

  const snakes: WormSensesSnake[] = [];

  for (const npc of state.npcs) {
    if (!npc.trail || npc.trail.length < 2) continue;
    const nHead = npc.trail[0];
    const dx = nHead.x - head.x;
    const dy = nHead.y - head.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > range2) continue;
    const dist = Math.sqrt(d2);
    const bearing = bearingDegFromHeading(state, dx, dy);

    let minBodyDist = Infinity;
    for (let i = 6; i < npc.trail.length; i++) {
      const bp = npc.trail[i];
      const dd = Math.hypot(bp.x - head.x, bp.y - head.y);
      if (dd < minBodyDist) minBodyDist = dd;
    }

    const stride = Math.max(1, Math.floor(npc.trail.length / segmentsPerSnake));
    const body_points_polar: WormSensesSnakeBodyPoint[] = [];
    for (let i = 0; i < npc.trail.length && body_points_polar.length < segmentsPerSnake; i += stride) {
      const bp = npc.trail[i];
      const bdx = bp.x - head.x;
      const bdy = bp.y - head.y;
      const bd2 = bdx * bdx + bdy * bdy;
      if (bd2 > range2) continue;
      const bdist = Math.sqrt(bd2);
      body_points_polar.push({
        dist: Math.round(bdist * 10) / 10,
        bearing_deg: Math.round(bearingDegFromHeading(state, bdx, bdy) * 10) / 10,
      });
    }

    snakes.push({
      id: `npc-${npc.id}`,
      dist: Math.round(dist * 10) / 10,
      bearing_deg: Math.round(bearing * 10) / 10,
      heading_deg: Math.round(degWrap180(radToDeg(npc.angle)) * 10) / 10,
      radius: SNAKE_RADIUS,
      threat: {
        head_dist: Math.round(dist * 10) / 10,
        min_body_dist: Number.isFinite(minBodyDist) ? Math.round(minBodyDist * 10) / 10 : null,
        collision_in_s: null,
      },
      body_points_polar,
    });
  }

  snakes.sort((a, b) => a.dist - b.dist);

  return {
    type: 'worm_senses_v1',
    ts_ms: Date.now(),
    you: {
      pos_world: { x: Math.round(head.x * 10) / 10, y: Math.round(head.y * 10) / 10 },
      heading_deg: Math.round(headingDeg(state) * 10) / 10,
      speed: SPEED_PX_PER_SEC,
      radius: SNAKE_RADIUS,
      length: Math.round(targetLength(state)),
      score: state.score,
    },
    view: {
      range,
      fov_deg: 360,
      max_items: {
        pellets: maxPellets,
        snakes: maxSnakes,
        segments_per_snake: segmentsPerSnake,
      },
    },
    pellets,
    snakes: snakes.slice(0, maxSnakes),
  };
}
