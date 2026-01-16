import {
  BASE_LENGTH,
  BGM_FADE_IN_MS,
  FOOD_COUNT,
  FOOD_RADIUS,
  FOOD_RECENTER_RADIUS,
  FOOD_SPAWN_RADIUS,
  NPC_COUNT,
  NPC_RECENTER_RADIUS,
  NPC_SPEED_PX_PER_SEC,
  NPC_TURN_RATE_RAD_PER_SEC,
  SNAKE_RADIUS,
  SPEED_PX_PER_SEC,
  TURN_DEG,
  TURN_RAD,
  TURN_RATE_DEG_PER_SEC,
  TURN_RATE_RAD_PER_SEC,
} from './constants';
import { formatClock, setOverlay, updateClockUI, updateScoreUI } from './dom';
import { clamp01, dist2, normalizeAngle, signedAngleDelta } from './math';
import { applyAutopilot } from './autopilot';
import { saveHighScore, targetLength } from './state';
import type { InputState, NpcSnake, UiElements, WormState } from './types';

export type GameLoop = {
  resetGame: () => void;
  startGame: () => void;
  stopGame: () => void;
  pauseToggle: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  startOrRestart: (restart: boolean) => void;
  safeNudgeTurn: (direction: 'left' | 'right', degrees: number) => {
    applied_deg: number;
    blocked: boolean;
    blocked_candidate_angle: number | null;
  };
  safeHoldTurn: (direction: 'left' | 'right', durationMs: number) => {
    applied_deg: number;
    blocked: boolean;
    blocked_candidate_angle: number | null;
  };
};

type GameLoopDeps = {
  state: WormState;
  input: InputState;
  ui: UiElements;
  render: () => void;
  playBgmWithFade: (reason?: string, durationMs?: number) => void;
  pauseBgm: (reason?: string) => void;
  cancelBgmFade: () => void;
};

export function createGameLoop({
  state,
  input,
  ui,
  render,
  playBgmWithFade,
  pauseBgm,
  cancelBgmFade,
}: GameLoopDeps): GameLoop {
  const { startBtn, pauseBtn, resetBtn } = ui;

  function rand(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  function makeFoodAround(head: { x: number; y: number }) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * FOOD_SPAWN_RADIUS;
    return {
      x: head.x + Math.cos(a) * r,
      y: head.y + Math.sin(a) * r,
      hue: Math.floor(Math.random() * 360),
      phase: Math.random() * Math.PI * 2,
      pulseHz: rand(0.6, 1.6),
    };
  }

  function repopulateFoods(): void {
    const head = state.trail[0] || { x: 0, y: 0 };
    state.foods = [];
    for (let i = 0; i < FOOD_COUNT; i++) {
      state.foods.push(makeFoodAround(head));
    }
  }

  function keepFoodsNearHead(): void {
    const head = state.trail[0];
    if (!head) return;
    const r2 = FOOD_RECENTER_RADIUS * FOOD_RECENTER_RADIUS;
    for (let i = 0; i < state.foods.length; i++) {
      if (dist2(head, state.foods[i]) > r2) {
        state.foods[i] = makeFoodAround(head);
      }
    }
  }

  function trimTrailToLength(): void {
    const target = targetLength(state);
    let acc = 0;
    for (let i = 1; i < state.trail.length; i++) {
      const prev = state.trail[i - 1];
      const cur = state.trail[i];
      const segLen = Math.hypot(prev.x - cur.x, prev.y - cur.y);
      if (acc + segLen >= target) {
        const t = clamp01((target - acc) / (segLen || 1));
        const nx = prev.x + (cur.x - prev.x) * t;
        const ny = prev.y + (cur.y - prev.y) * t;
        state.trail.length = i;
        state.trail.push({ x: nx, y: ny });
        break;
      }
      acc += segLen;
    }
  }

  function trailLength(trail: Array<{ x: number; y: number }>): number {
    let len = 0;
    for (let i = 1; i < trail.length; i++) {
      const p0 = trail[i - 1];
      const p1 = trail[i];
      len += Math.hypot(p1.x - p0.x, p1.y - p0.y);
    }
    return len;
  }

  function trimTrailToTarget(trail: Array<{ x: number; y: number }>, targetLen: number) {
    const total = trailLength(trail);
    if (total <= targetLen) return trail;

    let acc = 0;
    for (let i = 1; i < trail.length; i++) {
      const prev = trail[i - 1];
      const cur = trail[i];
      const segLen = Math.hypot(prev.x - cur.x, prev.y - cur.y);
      if (acc + segLen >= targetLen) {
        const t = clamp01((targetLen - acc) / (segLen || 1));
        const nx = prev.x + (cur.x - prev.x) * t;
        const ny = prev.y + (cur.y - prev.y) * t;
        trail.length = i;
        trail.push({ x: nx, y: ny });
        break;
      }
      acc += segLen;
    }
    return trail;
  }

  function makeNpcAround(head: { x: number; y: number }): NpcSnake {
    const a = Math.random() * Math.PI * 2;
    const r = rand(1200, 2200);
    const x = head.x + Math.cos(a) * r;
    const y = head.y + Math.sin(a) * r;
    const ang = Math.random() * Math.PI * 2;
    const len = rand(BASE_LENGTH * 0.5, BASE_LENGTH * 5.0);
    const trail = [
      { x, y },
      { x: x - Math.cos(ang) * len, y: y - Math.sin(ang) * len },
    ];
    return {
      id: state.nextNpcId++,
      trail,
      angle: ang,
      hue: Math.floor(Math.random() * 360),
      speed: NPC_SPEED_PX_PER_SEC * rand(0.85, 1.2),
      turnDir: 0,
      nextTurnAt: performance.now() + rand(400, 1300),
      deadUntil: 0,
    };
  }

  function ensureNpcs(): void {
    const head = state.trail[0] || { x: 0, y: 0 };
    while (state.npcs.length < NPC_COUNT) {
      state.npcs.push(makeNpcAround(head));
    }
  }

  function keepNpcsNearPlayer(): void {
    const head = state.trail[0];
    if (!head) return;
    const r2 = NPC_RECENTER_RADIUS * NPC_RECENTER_RADIUS;
    const now = state.renderNow;
    for (let i = 0; i < state.npcs.length; i++) {
      const npc = state.npcs[i];
      if (!npc.trail || npc.trail.length === 0) continue;
      if (npc.deadUntil > now) continue;
      const nHead = npc.trail[0];
      if (!nHead) continue;
      if (dist2(head, nHead) > r2) {
        state.npcs[i] = makeNpcAround(head);
      }
    }
  }

  function wouldHitTrail(point: { x: number; y: number }, trail: Array<{ x: number; y: number }>, minIdx: number): boolean {
    const start = Math.max(0, Math.min(minIdx, trail.length));
    const r2 = (SNAKE_RADIUS * 0.85) * (SNAKE_RADIUS * 0.85);
    for (let i = start; i < trail.length; i++) {
      if (dist2(point, trail[i]) < r2) return true;
    }
    return false;
  }

  function disintegrateTrailIntoFood(trail: Array<{ x: number; y: number }>, hueHint: number): void {
    const maxFoods = 260;
    const stride = 8;
    for (let i = 0; i < trail.length; i += stride) {
      const p = trail[i];
      const jx = rand(-10, 10);
      const jy = rand(-10, 10);
      state.foods.push({
        x: p.x + jx,
        y: p.y + jy,
        hue: (hueHint + Math.floor(rand(-18, 18)) + 360) % 360,
        phase: Math.random() * Math.PI * 2,
        pulseHz: rand(0.7, 2.0),
      });
    }
    if (state.foods.length > maxFoods) {
      state.foods.splice(0, state.foods.length - maxFoods);
    }
  }

  function resetGame(): void {
    state.score = 0;
    state.over = false;
    state.paused = false;
    state.running = false;
    state.lastTs = 0;
    state.angle = 0;
    state.gameElapsedMs = 0;
    state.trail = [
      { x: 0, y: 0 },
      { x: -BASE_LENGTH * 1.5, y: 0 },
    ];
    state.npcs = [];
    repopulateFoods();
    ensureNpcs();
    updateScoreUI(state, ui);
    updateClockUI(state, ui);
    setOverlay(ui, false, '', '');
    render();
  }

  function startGame(): void {
    if (state.running) return;
    state.running = true;
    state.paused = false;
    state.over = false;

    if (state.bgm && state.musicEnabled) {
      playBgmWithFade('game start', BGM_FADE_IN_MS);
    }

    startBtn.setAttribute('disabled', 'true');
    pauseBtn.removeAttribute('disabled');
    resetBtn.removeAttribute('disabled');
    pauseBtn.textContent = 'Pause';
    setOverlay(ui, false, '', '');

    state.lastTs = performance.now();
    state.raf = requestAnimationFrame(frame);
  }

  function stopGame(): void {
    state.running = false;
    if (state.bgm) {
      cancelBgmFade();
      console.log('[WormCommander] BGM stop (game over/reset)');
      state.bgm.pause();
      state.bgm.currentTime = 0;
    }
    if (state.raf !== null) {
      cancelAnimationFrame(state.raf);
      state.raf = null;
    }
    startBtn.removeAttribute('disabled');
    pauseBtn.setAttribute('disabled', 'true');
    resetBtn.setAttribute('disabled', 'true');
  }

  function pauseToggle(): void {
    if (!state.running || state.over) return;
    state.paused = !state.paused;

    if (state.bgm) {
      if (state.paused) {
        pauseBgm('game paused');
      } else if (state.musicEnabled) {
        playBgmWithFade('game unpaused', BGM_FADE_IN_MS);
      }
    }

    pauseBtn.textContent = state.paused ? 'Resume' : 'Pause';
    setOverlay(ui, state.paused, 'Paused', 'Press Space to resume');
    if (!state.paused) {
      state.lastTs = performance.now();
      state.raf = requestAnimationFrame(frame);
    }
    render();
  }

  function pauseGame(): void {
    if (!state.running || state.over) return;
    if (!state.paused) pauseToggle();
  }

  function resumeGame(): void {
    if (state.over) return;
    if (!state.running) {
      startGame();
      return;
    }
    if (state.paused) pauseToggle();
  }

  function startOrRestart(restart: boolean): void {
    if (restart) {
      stopGame();
      resetGame();
      startGame();
      return;
    }
    if (!state.running) startGame();
  }

  function gameOver(reason: string): void {
    state.over = true;
    stopGame();

    if (ui.finalTimeEl) ui.finalTimeEl.textContent = formatClock(state.gameElapsedMs);
    if (ui.finalScoreEl) ui.finalScoreEl.textContent = String(state.score);
    if (ui.finalHighScoreEl) ui.finalHighScoreEl.textContent = String(state.highScore);

    setOverlay(ui, true, 'Game Over', reason, true);
  }

  function wouldHitSelfAt(point: { x: number; y: number }): boolean {
    const minIdx = Math.min(state.trail.length - 1, 16);
    const r2 = (SNAKE_RADIUS * 0.85) * (SNAKE_RADIUS * 0.85);
    for (let i = minIdx; i < state.trail.length; i++) {
      if (dist2(point, state.trail[i]) < r2) return true;
    }
    return false;
  }

  function wouldTurnCauseImmediateCollision(candidateAngle: number): boolean {
    const head = state.trail[0] || { x: 0, y: 0 };
    const vx = Math.cos(candidateAngle);
    const vy = Math.sin(candidateAngle);
    const dtSim = 1 / 60;
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const p = { x: head.x + vx * SPEED_PX_PER_SEC * dtSim * i, y: head.y + vy * SPEED_PX_PER_SEC * dtSim * i };
      if (wouldHitSelfAt(p)) return true;
    }
    return false;
  }

  function safeNudgeTurn(direction: 'left' | 'right', degrees: number) {
    const dir = direction === 'right' ? 1 : -1;
    const steps = Math.max(0, Math.floor(degrees / TURN_DEG));
    let applied = 0;
    let blocked = false;
    let blockedCandidate: number | null = null;
    for (let i = 0; i < steps; i++) {
      const candidate = normalizeAngle(state.angle + dir * TURN_RAD);
      if (wouldTurnCauseImmediateCollision(candidate)) {
        blocked = true;
        blockedCandidate = candidate;
        break;
      }
      state.angle = candidate;
      applied += TURN_DEG;
    }
    return { applied_deg: applied, blocked, blocked_candidate_angle: blockedCandidate };
  }

  function safeHoldTurn(direction: 'left' | 'right', durationMs: number) {
    const stepPeriodMs = (TURN_DEG / TURN_RATE_DEG_PER_SEC) * 1000;
    const steps = Math.max(0, Math.floor(durationMs / stepPeriodMs));
    const degrees = steps * TURN_DEG;
    return safeNudgeTurn(direction, degrees);
  }

  function applyHeldTurning(dt: number): void {
    if (input.holdDir === 0) return;

    const remainingCap = Math.PI - input.holdTurnUsed;
    if (remainingCap <= 1e-6) return;

    input.holdTurnBuffer += TURN_RATE_RAD_PER_SEC * dt;
    while (input.holdTurnBuffer >= TURN_RAD) {
      if (input.holdTurnUsed + TURN_RAD > Math.PI + 1e-6) break;

      const candidate = normalizeAngle(state.angle + input.holdDir * TURN_RAD);
      if (wouldTurnCauseImmediateCollision(candidate)) {
        input.holdTurnBuffer = 0;
        break;
      }

      state.angle = candidate;
      input.holdTurnUsed += TURN_RAD;
      input.holdTurnBuffer -= TURN_RAD;
      if (Math.PI - input.holdTurnUsed <= 1e-6) break;
    }
  }

  function applyManualSteer(dt: number): void {
    const steer = state.manualSteer;
    if (!steer) return;
    const now = state.renderNow;
    if (now >= steer.until_ms) {
      state.manualSteer = null;
      return;
    }

    steer.turnBuffer += TURN_RATE_RAD_PER_SEC * dt;
    while (steer.turnBuffer >= TURN_RAD) {
      const d = signedAngleDelta(state.angle, steer.targetAngle);
      if (Math.abs(d) <= TURN_RAD * 0.5) {
        steer.turnBuffer = 0;
        break;
      }

      const dir = d > 0 ? 1 : -1;
      const candidate = normalizeAngle(state.angle + dir * TURN_RAD);
      if (wouldTurnCauseImmediateCollision(candidate)) {
        steer.turnBuffer = 0;
        break;
      }

      state.angle = candidate;
      steer.turnBuffer -= TURN_RAD;
    }
  }

  function maybeEatFood(head: { x: number; y: number }): void {
    const eatR2 = (SNAKE_RADIUS + FOOD_RADIUS) * (SNAKE_RADIUS + FOOD_RADIUS);
    for (let i = 0; i < state.foods.length; i++) {
      if (dist2(head, state.foods[i]) <= eatR2) {
        state.score += 1;
        if (state.score > state.highScore) {
          state.highScore = state.score;
          saveHighScore(state.highScore);
        }
        updateScoreUI(state, ui);
        state.foods[i] = makeFoodAround(head);
      }
    }
  }

  function checkSelfCollision(head: { x: number; y: number }): boolean {
    return wouldHitSelfAt(head);
  }

  function step(dt: number): void {
    const head = state.trail[0]!;
    const vx = Math.cos(state.angle);
    const vy = Math.sin(state.angle);
    const speed = SPEED_PX_PER_SEC;

    const next = { x: head.x + vx * speed * dt, y: head.y + vy * speed * dt };
    state.trail.unshift(next);
    trimTrailToLength();

    maybeEatFood(next);
    keepFoodsNearHead();
    keepNpcsNearPlayer();
    if (checkSelfCollision(next)) {
      gameOver('You ran into yourself.');
      return;
    }

    const now = state.renderNow;
    for (const npc of state.npcs) {
      if (npc.deadUntil > now) continue;
      const nHead = npc.trail[0];
      if (!nHead) continue;

      if (now >= npc.nextTurnAt) {
        const r = Math.random();
        npc.turnDir = r < 0.18 ? -1 : r < 0.36 ? 1 : 0;
        npc.nextTurnAt = now + rand(350, 1200);
      }

      npc.angle = normalizeAngle(npc.angle + npc.turnDir * NPC_TURN_RATE_RAD_PER_SEC * dt);

      const nvx = Math.cos(npc.angle);
      const nvy = Math.sin(npc.angle);
      const nNext = { x: nHead.x + nvx * npc.speed * dt, y: nHead.y + nvy * npc.speed * dt };
      npc.trail.unshift(nNext);
      npc.trail = trimTrailToTarget(npc.trail, BASE_LENGTH * 0.95);

      const eatR2 = (SNAKE_RADIUS + FOOD_RADIUS) * (SNAKE_RADIUS + FOOD_RADIUS);
      for (let i = 0; i < state.foods.length; i++) {
        if (dist2(nNext, state.foods[i]) <= eatR2) {
          state.foods[i] = makeFoodAround(nNext);
        }
      }
    }

    for (let j = 0; j < state.npcs.length; j++) {
      const npc = state.npcs[j];
      if (npc.deadUntil > now) continue;
      if (wouldHitTrail(next, npc.trail, 10)) {
        disintegrateTrailIntoFood(state.trail, 48);
        gameOver('You hit another snake.');
        return;
      }
    }

    for (let i = 0; i < state.npcs.length; i++) {
      const npc = state.npcs[i];
      if (npc.deadUntil > now) continue;
      const nHead = npc.trail[0];
      if (!nHead) continue;

      if (wouldHitTrail(nHead, state.trail, 16)) {
        disintegrateTrailIntoFood(npc.trail, npc.hue);
        npc.deadUntil = now + 1200;
        npc.trail = [];
        continue;
      }

      for (let k = 0; k < state.npcs.length; k++) {
        if (k === i) continue;
        const other = state.npcs[k];
        if (other.deadUntil > now) continue;
        if (wouldHitTrail(nHead, other.trail, 12)) {
          disintegrateTrailIntoFood(npc.trail, npc.hue);
          npc.deadUntil = now + 1200;
          npc.trail = [];
          break;
        }
      }
    }

    for (let i = 0; i < state.npcs.length; i++) {
      const npc = state.npcs[i];
      if (npc.deadUntil > 0 && npc.deadUntil <= now) {
        state.npcs[i] = makeNpcAround(next);
      }
    }
  }

  function frame(ts: number): void {
    if (!state.running) return;
    if (state.paused || state.over) return;

    const dt = Math.min(0.05, Math.max(0, (ts - state.lastTs) / 1000));
    state.lastTs = ts;

    state.renderNow = ts;

    state.gameElapsedMs += dt * 1000;
    updateClockUI(state, ui);

    applyManualSteer(dt);
    applyAutopilot(state, dt);
    applyHeldTurning(dt);
    step(dt);
    render();
    state.raf = requestAnimationFrame(frame);
  }

  return {
    resetGame,
    startGame,
    stopGame,
    pauseToggle,
    pauseGame,
    resumeGame,
    startOrRestart,
    safeNudgeTurn,
    safeHoldTurn,
  };
}
