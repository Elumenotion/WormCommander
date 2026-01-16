import { normalizeAngle, radToDeg } from './math';
import type { InputState, UiElements, Viewport, WormState } from './types';

type InputHandlersDeps = {
  state: WormState;
  input: InputState;
  viewport: Viewport;
  ui: UiElements;
  render: () => void;
  resetGame: () => void;
  startGame: () => void;
  togglePlayAreaFullscreen: () => void;
  isFullscreenActive: () => boolean;
  toggleSpeech: (options: { source: string }) => void;
};

export type InputHandlers = {
  bind: () => void;
  cleanup: () => void;
};

export function createInputHandlers({
  state,
  input,
  viewport,
  ui,
  render,
  resetGame,
  startGame,
  togglePlayAreaFullscreen,
  isFullscreenActive,
  toggleSpeech,
}: InputHandlersDeps): InputHandlers {
  const { canvas } = ui;

  let forceFocusInterval: ReturnType<typeof setInterval> | null = null;
  let forceFocusUntil = 0;
  let forceFocusUserClickedAt = 0;

  let tapStartTime = 0;
  let tapStartPos = { x: 0, y: 0 };
  const TAP_MAX_DURATION_MS = 300;
  const TAP_MAX_DISTANCE_PX = 10;

  function startTurnHold(dir: -1 | 0 | 1): void {
    input.holdDir = dir;
    input.holdStartAngle = state.angle;
    input.holdTurnUsed = 0;
    input.holdTurnBuffer = 0;
  }

  function updateHoldDirFromKeys(): void {
    if (input.left && !input.right) {
      if (input.holdDir !== -1) {
        startTurnHold(-1);
        if (state.autopilot) {
          console.log('[WormCommander] Manual control took over, cancelling autopilot');
          state.autopilot = null;
        }
      }
    } else if (input.right && !input.left) {
      if (input.holdDir !== 1) {
        startTurnHold(1);
        if (state.autopilot) {
          console.log('[WormCommander] Manual control took over, cancelling autopilot');
          state.autopilot = null;
        }
      }
    } else {
      input.holdDir = 0;
      input.holdTurnBuffer = 0;
    }
  }

  function shouldIgnoreInput(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null;
    if (!t) return false;
    const tag = t.tagName.toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'GUIDEANTS-CHAT') return true;
    if (t.isContentEditable) return true;
    return false;
  }

  function forceFocusToCanvas(durationMs: number): void {
    forceFocusUntil = performance.now() + durationMs;
    if (forceFocusInterval !== null) return;

    forceFocusInterval = setInterval(() => {
      const now = performance.now();
      if (now > forceFocusUntil) {
        if (forceFocusInterval) clearInterval(forceFocusInterval);
        forceFocusInterval = null;
        return;
      }
      if (now - forceFocusUserClickedAt < 500) return;
      if (document.activeElement !== canvas) {
        canvas.focus({ preventScroll: true });
      }
    }, 50);
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (shouldIgnoreInput(e)) return;

    const key = e.key.toLowerCase();
    if (key === 'arrowleft' || key === 'a') {
      e.preventDefault();
      if (!input.left) {
        input.left = true;
        updateHoldDirFromKeys();
        if (!state.running) render();
      }
    } else if (key === 'arrowright' || key === 'd') {
      e.preventDefault();
      if (!input.right) {
        input.right = true;
        updateHoldDirFromKeys();
        if (!state.running) render();
      }
    } else if (key === ' ') {
      e.preventDefault();
      toggleSpeech({ source: 'keyboard' });
      forceFocusToCanvas(3000);
    } else if (key === 'r') {
      e.preventDefault();
      resetGame();
      startGame();
    } else if (key === 'escape') {
      if (isFullscreenActive()) {
        e.preventDefault();
        togglePlayAreaFullscreen();
      }
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (shouldIgnoreInput(e)) return;

    const key = e.key.toLowerCase();
    if (key === 'arrowleft' || key === 'a') {
      input.left = false;
      updateHoldDirFromKeys();
    } else if (key === 'arrowright' || key === 'd') {
      input.right = false;
      updateHoldDirFromKeys();
    }
  }

  function handleCanvasClick(e: MouseEvent | PointerEvent): void {
    const path = typeof e.composedPath === 'function' ? e.composedPath() : [];

    const isFromCanvas = e.target === canvas || path.includes(canvas);
    if (!isFromCanvas) return;

    for (const el of path) {
      if (!(el instanceof HTMLElement)) continue;
      const tag = el.tagName.toUpperCase();
      if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (tag === 'GUIDEANTS-CHAT' || el.closest('guideants-chat')) return;
    }

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const head = state.trail[0] || { x: 0, y: 0 };
    const vw = viewport.vw;
    const vh = viewport.vh;
    const cx = vw / 2;
    const cy = vh / 2;
    const camX = head.x - cx;
    const camY = head.y - cy;

    const virtualX = (canvasX / rect.width) * vw;
    const virtualY = (canvasY / rect.height) * vh;

    const worldX = virtualX + camX;
    const worldY = virtualY + camY;

    const dx = worldX - head.x;
    const dy = worldY - head.y;
    const targetAngle = normalizeAngle(Math.atan2(dy, dx));

    if (state.autopilot) {
      console.log('[WormCommander] Manual steer took over, cancelling autopilot');
      state.autopilot = null;
    }

    state.manualSteer = { targetAngle, until_ms: performance.now() + 2000, turnBuffer: 0 };

    console.log('[WormCommander] Click-to-steer', {
      canvas: { x: canvasX, y: canvasY },
      virtual: { x: virtualX, y: virtualY },
      world: { x: worldX, y: worldY },
      head: { x: head.x, y: head.y },
      targetAngleDeg: Math.round((radToDeg(targetAngle) + 360) % 360),
    });
  }

  function handleCanvasPointerDown(e: PointerEvent): void {
    if (e.button !== 0 && e.button !== undefined) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target !== canvas) return;

    tapStartTime = performance.now();
    tapStartPos = { x: e.clientX, y: e.clientY };

    if (e.pointerType !== 'mouse') {
      e.preventDefault();
    }
  }

  function handleCanvasPointerUp(e: PointerEvent): void {
    if (e.button !== 0 && e.button !== undefined) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target !== canvas) return;

    const tapDuration = performance.now() - tapStartTime;
    const tapDistance = Math.hypot(e.clientX - tapStartPos.x, e.clientY - tapStartPos.y);
    const isQuickTap = tapDuration < TAP_MAX_DURATION_MS && tapDistance < TAP_MAX_DISTANCE_PX;

    if (isQuickTap) {
      e.preventDefault();
      handleCanvasClick(e);
      if (e.pointerType !== 'mouse') {
        canvas.focus({ preventScroll: true });
      }
    }
  }

  function onDocumentPointerDown(): void {
    forceFocusUserClickedAt = performance.now();
  }

  const onCanvasClick = () => { };

  function bind(): void {
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);

    canvas.addEventListener('pointerdown', handleCanvasPointerDown, { passive: false });
    canvas.addEventListener('pointerup', handleCanvasPointerUp, { passive: false });
    canvas.addEventListener('click', onCanvasClick, { passive: true });

    document.addEventListener('pointerdown', onDocumentPointerDown, { capture: true, passive: true });
  }

  function cleanup(): void {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);

    canvas.removeEventListener('pointerdown', handleCanvasPointerDown);
    canvas.removeEventListener('pointerup', handleCanvasPointerUp);
    canvas.removeEventListener('click', onCanvasClick);

    document.removeEventListener('pointerdown', onDocumentPointerDown, true);

    if (forceFocusInterval) {
      clearInterval(forceFocusInterval);
      forceFocusInterval = null;
    }
  }

  return { bind, cleanup };
}
