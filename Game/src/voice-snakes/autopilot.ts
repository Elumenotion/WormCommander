import {
  AUTOPILOT_DECISION_MS,
  AUTOPILOT_DANGER_DECISION_MS,
  SELF_CLEARANCE_BUFFER_PX,
  SELF_CLEARANCE_LOOKAHEAD_PX,
  SELF_CLEARANCE_STEP_PX,
  SNAKE_RADIUS,
  TURN_DEG,
} from './constants';
import { degWrap180, normalizeAngle } from './math';
import type { AutopilotCommand, WormState, WormSenses } from './types';
import { getWormSenses, headingDeg } from './senses';

function rayClearanceToSelf(state: WormState, relativeBearingDeg: number): number {
  const head = state.trail[0];
  if (!head) return SELF_CLEARANCE_LOOKAHEAD_PX;

  const ang = normalizeAngle(state.angle + (relativeBearingDeg * Math.PI) / 180);
  const vx = Math.cos(ang);
  const vy = Math.sin(ang);
  const hitR = SNAKE_RADIUS + SELF_CLEARANCE_BUFFER_PX;
  const hitR2 = hitR * hitR;

  const skip = Math.min(state.trail.length, 40);
  for (let d = SELF_CLEARANCE_STEP_PX; d <= SELF_CLEARANCE_LOOKAHEAD_PX; d += SELF_CLEARANCE_STEP_PX) {
    const px = head.x + vx * d;
    const py = head.y + vy * d;

    for (let i = skip; i < state.trail.length; i++) {
      const bp = state.trail[i];
      const dx = bp.x - px;
      const dy = bp.y - py;
      if (dx * dx + dy * dy <= hitR2) {
        return d;
      }
    }
  }

  return SELF_CLEARANCE_LOOKAHEAD_PX;
}

function pickTargetBearing(
  intent: string,
  target: AutopilotCommand['target'],
  senses: WormSenses
): number {
  const t = target || { type: 'none' };
  if (t.type === 'bearing' && typeof (t as { bearing_deg?: number }).bearing_deg === 'number') {
    return (t as { bearing_deg: number }).bearing_deg;
  }

  if (t.type === 'nearest_food') {
    const p = senses?.pellets?.[0];
    if (p && typeof p.bearing_deg === 'number') return p.bearing_deg;
  }

  if (t.type === 'food_id' && typeof (t as { id?: string }).id === 'string') {
    const id = (t as { id: string }).id;
    const p = (senses?.pellets || []).find((x) => x?.id === id);
    if (p && typeof p.bearing_deg === 'number') return p.bearing_deg;
  }

  if (t.type === 'snake_id' && typeof (t as { id?: string }).id === 'string') {
    const id = (t as { id: string }).id;
    const s = (senses?.snakes || []).find((x) => x?.id === id);
    if (s && typeof s.bearing_deg === 'number') return s.bearing_deg;
  }

  if (intent === 'eat') {
    const p = senses?.pellets?.[0];
    if (p && typeof p.bearing_deg === 'number') return p.bearing_deg;
  }
  if (intent === 'hunt' || intent === 'intercept') {
    const s = senses?.snakes?.[0];
    if (s && typeof s.bearing_deg === 'number') return s.bearing_deg;
  }
  return 0;
}

function selectFoodTarget(senses: WormSenses): { id: string; bearing_deg: number } | null {
  let best: { id: string; bearing_deg: number } | null = null;
  let bestScore = -Infinity;
  for (const p of senses?.pellets || []) {
    const b = Number(p.bearing_deg);
    const d = Number(p.dist);
    if (!Number.isFinite(b) || !Number.isFinite(d) || d <= 0) continue;
    const forward = Math.cos((b * Math.PI) / 180);
    const score = (1 / d) * 1000 + forward * 0.25;
    if (score > bestScore) {
      bestScore = score;
      best = { id: p.id, bearing_deg: p.bearing_deg };
    }
  }
  return best;
}

export function applyAutopilot(state: WormState, dt: number): void {
  const cmd = state.autopilot;
  if (!cmd) return;
  if (!state.autopilotEnabled) return;
  const now = state.renderNow;
  if (now >= cmd.until_ms) {
    state.autopilot = null;
    return;
  }

  const straightSelfClear = rayClearanceToSelf(state, 0);
  const decisionEveryMs = straightSelfClear < 420 ? AUTOPILOT_DANGER_DECISION_MS : AUTOPILOT_DECISION_MS;
  if (now - state.autopilotLastDecisionAt < decisionEveryMs) return;
  const deltaMs = state.autopilotLastDecisionAt > 0 ? (now - state.autopilotLastDecisionAt) : null;
  state.autopilotLastDecisionAt = now;
  state.autopilotEvalCount += 1;
  console.log('[WormCommander] autopilot eval', {
    count: state.autopilotEvalCount,
    now_ms: Math.round(now),
    dt_ms: Math.round(dt * 1000),
    delta_ms: deltaMs !== null ? Math.round(deltaMs) : null,
    intent: cmd.intent,
    ttl_remaining_ms: Math.max(0, Math.round(cmd.until_ms - now)),
  });

  const senses = getWormSenses(state);

  let targetBearingDeg: number | null = null;
  let targetInfo: Record<string, unknown> | null = null;

  const intent = String(cmd.intent || 'survive').toLowerCase();
  const isEat = intent === 'eat';
  const isHunt = intent === 'hunt' || intent === 'intercept';
  const isAvoid = intent === 'avoid' || intent === 'escape';

  const explicitBearing = pickTargetBearing(intent, cmd.target, senses);
  if (Number.isFinite(explicitBearing) && explicitBearing !== 0) {
    targetBearingDeg = explicitBearing;
    targetInfo = { kind: 'explicit', target: cmd.target || { type: 'none' } };
  } else if (isEat) {
    const chosen = selectFoodTarget(senses);
    const p = chosen || senses?.pellets?.[0] || null;
    if (p && typeof p.bearing_deg === 'number') {
      targetBearingDeg = p.bearing_deg;
      targetInfo = { kind: 'food', id: p.id ?? null, dist: p.dist ?? null };
    }
  } else if (isHunt || isAvoid) {
    const s = senses?.snakes?.[0] || null;
    if (s && typeof s.bearing_deg === 'number') {
      const toward = s.bearing_deg;
      targetBearingDeg = isAvoid ? degWrap180(toward + 180) : toward;
      targetInfo = { kind: isAvoid ? 'avoid_snake' : 'hunt_snake', id: s.id ?? null, dist: s.dist ?? null };
    }
  }

  console.log('[WormCommander] autopilot targeting', {
    intent,
    pelletCount: senses.pellets?.length ?? 0,
    snakeCount: senses.snakes?.length ?? 0,
    targetBearingDeg,
    target: targetInfo,
  });

  const required = (typeof cmd.constraints?.min_clearance === 'number' && cmd.constraints.min_clearance > 0)
    ? cmd.constraints.min_clearance
    : 180;

  const dangerMode = straightSelfClear < 360;
  const options = dangerMode
    ? [-3 * TURN_DEG, -2 * TURN_DEG, -TURN_DEG, 0, TURN_DEG, 2 * TURN_DEG, 3 * TURN_DEG]
    : [-TURN_DEG, 0, TURN_DEG];

  function rayClearanceToSnakes(relativeBearingDeg: number): number {
    const head = state.trail[0];
    if (!head) return SELF_CLEARANCE_LOOKAHEAD_PX;
    const ang = normalizeAngle(state.angle + (relativeBearingDeg * Math.PI) / 180);
    const vx = Math.cos(ang);
    const vy = Math.sin(ang);
    const hitR = SNAKE_RADIUS + 18;
    const hitR2 = hitR * hitR;
    for (let d = SELF_CLEARANCE_STEP_PX; d <= SELF_CLEARANCE_LOOKAHEAD_PX; d += SELF_CLEARANCE_STEP_PX) {
      const px = head.x + vx * d;
      const py = head.y + vy * d;
      for (const npc of state.npcs) {
        if (!npc.trail || npc.trail.length === 0) continue;
        for (let i = 4; i < npc.trail.length; i++) {
          const bp = npc.trail[i];
          const dx = bp.x - px;
          const dy = bp.y - py;
          if (dx * dx + dy * dy <= hitR2) return d;
        }
      }
    }
    return SELF_CLEARANCE_LOOKAHEAD_PX;
  }

  const LOOKAHEAD_PX = Math.min(SELF_CLEARANCE_LOOKAHEAD_PX, Math.max(520, Math.floor(required * 2.2)));
  const DANGER_PX = Math.max(160, Math.min(360, Math.floor(required * 1.1)));

  const scored = options
    .map((turnDeg) => {
      let score = 0;
      let foodScore = 0;

      if (!dangerMode && (isEat || isHunt || isAvoid) && targetBearingDeg !== null) {
        const newBearing = degWrap180(targetBearingDeg - turnDeg);
        const alignmentGain = Math.abs(targetBearingDeg) - Math.abs(newBearing);
        foodScore = alignmentGain * (isEat ? 8 : isHunt ? 5 : 5);
        score = foodScore;
      } else {
        if (turnDeg === 0) score = 50;
        else score = 0;
      }

      const selfClear = rayClearanceToSelf(state, turnDeg);
      const npcClear = rayClearanceToSnakes(turnDeg);
      const minClear = Math.min(selfClear, npcClear);

      score += minClear * (dangerMode ? 0.45 : 0.08);

      let avoidPenalty = 0;
      if (minClear < DANGER_PX) {
        avoidPenalty = (DANGER_PX - minClear) * (dangerMode ? 25 : 15);
        score -= avoidPenalty;
      } else if (minClear < LOOKAHEAD_PX) {
        avoidPenalty = (LOOKAHEAD_PX - minClear) * 0.5;
        score -= avoidPenalty;
      }

      score -= Math.abs(turnDeg) * (dangerMode ? 1.4 : 0.6);

      const danger = minClear < DANGER_PX;

      const newBearing = targetBearingDeg !== null ? degWrap180(targetBearingDeg - turnDeg) : 0;
      return { turnDeg, score, foodScore, avoidPenalty, newBearing, selfClear, npcClear, minClear, danger };
    })
    .sort((a, b) => b.score - a.score);

  const beforeDeg = headingDeg(state);
  const trailLen = state.trail.length;

  const allDangerous = scored.every((o) => o.danger);
  const minSelfClear = Math.min(...scored.map((o) => o.selfClear));
  const minNpcClear = Math.min(...scored.map((o) => o.npcClear));

  if (minSelfClear < LOOKAHEAD_PX || allDangerous) {
    console.warn('[WormCommander] TAIL DANGER', {
      trailLen,
      minSelfClear: Math.round(minSelfClear),
      minNpcClear: Math.round(minNpcClear),
      allDangerous,
      options: scored.map((o) => ({
        turn: o.turnDeg,
        selfClear: Math.round(o.selfClear),
        npcClear: Math.round(o.npcClear),
        danger: o.danger,
        score: Math.round(o.score),
      })),
    });
  }

  const safeOpt = scored.find((o) => !o.danger);
  const chosen = (dangerMode && !safeOpt)
    ? scored.slice().sort((a, b) => (b.minClear - a.minClear) || (Math.abs(a.turnDeg) - Math.abs(b.turnDeg)))[0]
    : (safeOpt || scored[0]);

  if (chosen.turnDeg !== 0) {
    state.angle = normalizeAngle(state.angle + (chosen.turnDeg * Math.PI) / 180);
  }

  if (chosen.danger) {
    console.error('[WormCommander] CHOSE DANGEROUS PATH', {
      chosen: { turn: chosen.turnDeg, selfClear: Math.round(chosen.selfClear), npcClear: Math.round(chosen.npcClear) },
      allOptions: scored.map((o) => ({ turn: o.turnDeg, danger: o.danger, score: Math.round(o.score) })),
    });
  }

  const afterDeg = headingDeg(state);
  console.log('[WormCommander] autopilot decision', {
    intent: cmd.intent,
    targetBearingDeg,
    chosen_turn_deg: chosen?.turnDeg ?? 0,
    applied_turn_deg: chosen.turnDeg,
    heading_before_deg: Math.round(beforeDeg * 10) / 10,
    heading_after_deg: Math.round(afterDeg * 10) / 10,
    trailLen,
    top3: scored.slice(0, 3).map((x) => ({
      turn: x.turnDeg,
      score: Math.round(x.score),
      food: Math.round(x.foodScore),
      avoid: Math.round(x.avoidPenalty),
      selfCl: Math.round(x.selfClear),
      npcCl: Math.round(x.npcClear),
      danger: x.danger,
    })),
  });
}
