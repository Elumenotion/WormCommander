import { BASE_LENGTH, GROWTH_PER_FOOD } from './constants';
import type { InputState, Viewport, WormState } from './types';

export function createState(): WormState {
  return {
    trail: [],
    angle: 0,
    score: 0,
    highScore: 0,
    running: false,
    paused: false,
    over: false,
    lastTs: 0,
    raf: null,
    foods: [],
    renderNow: performance.now(),
    npcs: [],
    nextNpcId: 1,
    autopilotEnabled: true,
    autopilot: null,
    autopilotLastDecisionAt: 0,
    autopilotEvalCount: 0,
    autopilotLastTurnSign: 0,
    autopilotLockedFoodId: null,
    autopilotLockedFoodUntil: 0,
    bgm: null,
    bgmFadeRaf: null,
    bgImage: null,
    musicEnabled: false,
    gameElapsedMs: 0,
    manualSteer: null,
  };
}

export function createInputState(): InputState {
  return {
    left: false,
    right: false,
    holdDir: 0,
    holdStartAngle: 0,
    holdTurnUsed: 0,
    holdTurnBuffer: 0,
  };
}

export function createViewport(): Viewport {
  return { w: 600, h: 600, dpr: 1, zoom: 1, vw: 600, vh: 600 };
}

export function loadHighScore(): number {
  const raw = localStorage.getItem('voice-snakes-high-score');
  if (raw === null) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function saveHighScore(value: number): void {
  localStorage.setItem('voice-snakes-high-score', String(value));
}

export function targetLength(state: WormState): number {
  return BASE_LENGTH * 1.5 + state.score * GROWTH_PER_FOOD;
}
