import type { GuideantsChatElement, ToolCall, ToolResult } from 'guideants';
import { BGM_FADE_IN_MS } from './constants';
import { setMicToggleUi } from './dom';
import type {
  AutopilotCommand,
  SpeechKeyboardFocusGuard,
  UiElements,
  WormSenses,
  WormSensesOptions,
  WormState,
} from './types';

type ToggleSpeechOptions = {
  source?: string;
  restoreTarget?: HTMLElement | null;
};

type SpeechDeps = {
  state: WormState;
  ui: UiElements;
  getWormSenses: (options?: WormSensesOptions) => WormSenses;
  playBgmWithFade: (reason?: string, durationMs?: number) => void;
  pauseBgm: (reason?: string) => void;
  startOrRestart: (restart: boolean) => void;
  pauseGame: () => void;
  resumeGame: () => void;
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
  isFullscreenActive: () => boolean;
};

export type SpeechController = {
  toggleSpeech: (options: ToggleSpeechOptions) => void;
  setupSpeech: () => () => void;
};

export function createSpeechController({
  state,
  ui,
  getWormSenses,
  playBgmWithFade,
  pauseBgm,
  startOrRestart,
  pauseGame,
  resumeGame,
  safeNudgeTurn,
  safeHoldTurn,
  isFullscreenActive,
}: SpeechDeps): SpeechController {
  const speechKeyboardFocusGuard: SpeechKeyboardFocusGuard = {
    untilMs: 0,
    chat: null,
    restoreTarget: null,
    raf: null,
    lastPointerDownMs: 0,
  };

  function restoreFocusAfterSpeechKeyboard(chat: HTMLElement, restoreTarget: HTMLElement | null): void {
    if (document.activeElement === ui.canvas) return;

    if (restoreTarget && restoreTarget !== chat && document.contains(restoreTarget) && typeof restoreTarget.focus === 'function') {
      try {
        restoreTarget.focus({ preventScroll: true });
        console.log('[WormCommander] Focus restored to saved target');
        return;
      } catch {
        // ignore
      }
    }

    try {
      ui.canvas.focus({ preventScroll: true });
      console.log('[WormCommander] Focus restored to canvas');
    } catch {
      // ignore
    }
  }

  function startSpeechKeyboardFocusGuard(chat: HTMLElement, restoreTarget: HTMLElement | null): void {
    speechKeyboardFocusGuard.untilMs = performance.now() + 2000;
    speechKeyboardFocusGuard.chat = chat;
    speechKeyboardFocusGuard.restoreTarget = restoreTarget;
    if (speechKeyboardFocusGuard.raf === null) {
      speechKeyboardFocusGuard.raf = requestAnimationFrame(speechKeyboardFocusGuardTick);
    }
  }

  function stopSpeechKeyboardFocusGuard(): void {
    speechKeyboardFocusGuard.untilMs = 0;
    speechKeyboardFocusGuard.chat = null;
    speechKeyboardFocusGuard.restoreTarget = null;
    speechKeyboardFocusGuard.lastPointerDownMs = 0;
    if (speechKeyboardFocusGuard.raf !== null) {
      cancelAnimationFrame(speechKeyboardFocusGuard.raf);
      speechKeyboardFocusGuard.raf = null;
    }
  }

  function speechKeyboardFocusGuardTick(): void {
    const now = performance.now();
    if (now > speechKeyboardFocusGuard.untilMs) {
      stopSpeechKeyboardFocusGuard();
      return;
    }
    const chat = speechKeyboardFocusGuard.chat;
    if (chat) {
      const allowUserClick = (now - speechKeyboardFocusGuard.lastPointerDownMs) < 250;
      if (!allowUserClick) {
        restoreFocusAfterSpeechKeyboard(chat, speechKeyboardFocusGuard.restoreTarget);
      }
    }
    speechKeyboardFocusGuard.raf = requestAnimationFrame(speechKeyboardFocusGuardTick);
  }

  function toggleSpeech(options: ToggleSpeechOptions): void {
    const chat = document.getElementById('worm-commander-chat');
    if (!chat || !chat.shadowRoot) return;

    const micBtn = chat.shadowRoot.getElementById('wf-mic');
    if (!(micBtn instanceof HTMLButtonElement)) return;

    const isRecording = micBtn.classList.contains('hidden');

    console.log('[WormCommander] toggleSpeech', { isRecording });

    const source = options?.source || 'unknown';
    const activeEl = document.activeElement;
    const isActiveInChat = activeEl === chat || (activeEl && chat.contains(activeEl));
    const restoreTarget = source === 'keyboard' && !isActiveInChat && activeEl instanceof HTMLElement ? activeEl : null;

    if (source === 'keyboard') {
      startSpeechKeyboardFocusGuard(chat, restoreTarget);
    }

    if (!isRecording) {
      if (state.bgm && !state.bgm.paused) {
        console.log('[WormCommander] BGM pause (before mic start)');
        state.bgm.pause();
      }
      console.log('[WormCommander] Starting recording (keyboard guard armed:', source === 'keyboard', ')');
      micBtn.click();
    } else {
      console.log('[WormCommander] Stopping recording (keyboard guard armed:', source === 'keyboard', ')');
      const stopBtn = chat.shadowRoot.querySelector('button[aria-label*="Stop"]')
        || chat.shadowRoot.querySelector('button:not(.hidden)[aria-label*="stop"]');
      if (stopBtn instanceof HTMLButtonElement) {
        stopBtn.click();
      }
      waitForAsrAndSend(chat, { source, restoreTarget });
    }
  }

  async function waitForAsrAndSend(chat: HTMLElement, options?: ToggleSpeechOptions): Promise<void> {
    const shadow = chat.shadowRoot;
    if (!shadow) return;
    const inputEl = shadow.getElementById('wf-input');
    const sendBtn = shadow.getElementById('wf-send');
    const micBtn = shadow.getElementById('wf-mic');

    const isInput = inputEl instanceof HTMLInputElement || inputEl instanceof HTMLTextAreaElement;
    if (!isInput || !(sendBtn instanceof HTMLButtonElement) || !(micBtn instanceof HTMLButtonElement)) {
      console.log('[WormCommander] waitForAsrAndSend: missing elements');
      return;
    }

    console.log('[WormCommander] waitForAsrAndSend: waiting for transcription');

    let checks = 0;
    const maxChecks = 80;

    while (checks < maxChecks) {
      checks++;
      await new Promise((r) => setTimeout(r, 100));

      const isMicHidden = micBtn.classList.contains('hidden');
      const hasText = inputEl.value.trim().length > 0;

      if (!isMicHidden && hasText) {
        console.log('[WormCommander] waitForAsrAndSend: sending', { text: inputEl.value.trim() });
        await new Promise((r) => setTimeout(r, 50));
        if (options?.source === 'keyboard') {
          startSpeechKeyboardFocusGuard(chat, options.restoreTarget || null);
        }
        sendBtn.click();
        if (options?.source === 'keyboard') {
          restoreFocusAfterSpeechKeyboard(chat, options.restoreTarget || null);
          setTimeout(() => restoreFocusAfterSpeechKeyboard(chat, options.restoreTarget || null), 50);
          setTimeout(() => restoreFocusAfterSpeechKeyboard(chat, options.restoreTarget || null), 150);
          setTimeout(() => restoreFocusAfterSpeechKeyboard(chat, options.restoreTarget || null), 300);
        }
        return;
      }

      if (!isMicHidden && !hasText && checks > 20) {
        console.log('[WormCommander] waitForAsrAndSend: no text, giving up');
        return;
      }
    }
    console.log('[WormCommander] waitForAsrAndSend: timeout');
  }

  function setupSpeech(): () => void {
    const chatEl = document.getElementById('worm-commander-chat');
    const chat = chatEl && 'registerTool' in chatEl ? chatEl as GuideantsChatElement : null;
    let micObserver: MutationObserver | null = null;

    if (chat) {
      console.log('[WormCommander] chatEl found:', !!chat, 'registerTool:', typeof chat?.registerTool);

      if (typeof chat.setContextProvider === 'function') {
        chat.setContextProvider(() => JSON.stringify(getWormSenses()));
      }

      function parseArgs(call: ToolCall): Record<string, unknown> {
        try {
          return typeof call.function.arguments === 'string'
            ? JSON.parse(call.function.arguments || '{}')
            : (call.function.arguments || {});
        } catch {
          return {};
        }
      }

      function toolResult(call: ToolCall, name: string, payload: unknown): ToolResult {
        return { toolCallId: call.id, name, content: JSON.stringify(payload) };
      }

      chat.registerTool('Start', async (call) => {
        const args = parseArgs(call);
        const restart = !!args.restart;
        startOrRestart(restart);
        return toolResult(call, 'Start', { status: 'ok', senses: getWormSenses() });
      });

      chat.registerTool('Pause', async (call) => {
        pauseGame();
        return toolResult(call, 'Pause', { status: 'ok', senses: getWormSenses() });
      });

      chat.registerTool('Resume', async (call) => {
        resumeGame();
        return toolResult(call, 'Resume', { status: 'ok', senses: getWormSenses() });
      });

      chat.registerTool('Turn', async (call) => {
        const args = parseArgs(call);
        const direction = args.direction === 'right' ? 'right' : 'left';
        const degrees = Number(args.degrees);
        const allowed = [30, 60, 90, 120, 150];
        if (!allowed.includes(degrees)) {
          return toolResult(call, 'Turn', {
            status: 'error',
            code: 'INVALID_DEGREES',
            retryable: true,
            context: { allowedDegrees: allowed },
            senses: getWormSenses(),
          });
        }
        const applied = safeNudgeTurn(direction, degrees);
        return toolResult(call, 'Turn', { status: 'ok', ...applied, senses: getWormSenses() });
      });

      chat.registerTool('HoldTurn', async (call) => {
        const args = parseArgs(call);
        const direction = args.direction === 'right' ? 'right' : 'left';
        const durationMs = Math.max(0, Math.min(10000, Number(args.duration_ms) || 0));
        const applied = safeHoldTurn(direction, durationMs);
        return toolResult(call, 'HoldTurn', { status: 'ok', ...applied, senses: getWormSenses() });
      });

      chat.registerTool('ExecuteIntent', async (call) => {
        const args = parseArgs(call);
        console.log('[WormCommander] ExecuteIntent', args);
        if (!state.autopilotEnabled) {
          return toolResult(call, 'ExecuteIntent', {
            status: 'error',
            code: 'AUTOPILOT_DISABLED',
            retryable: true,
            message: 'Autopilot is disabled. Enable it with SetAutopilot.',
            senses: getWormSenses(),
          });
        }

        if (state.over) startOrRestart(true);
        else if (state.paused || !state.running) resumeGame();

        const constraints = (args.constraints && typeof args.constraints === 'object')
          ? (args.constraints as AutopilotCommand['constraints'])
          : undefined;

        state.autopilot = {
          intent: String(args.intent || 'survive'),
          target: args.target || { type: 'none' },
          constraints: constraints || { risk: 'medium', avoid_snakes: true, avoid_self: true, prefer_food: true },
          until_ms: performance.now() + 99999999,
        };
        state.autopilotLastDecisionAt = 0;

        return toolResult(call, 'ExecuteIntent', { status: 'ok', senses: getWormSenses() });
      });

      chat.registerTool('SetAutopilot', async (call) => {
        const args = parseArgs(call);
        state.autopilotEnabled = !!args.enabled;

        if (state.autopilotEnabled) {
          if (!state.autopilot || state.renderNow > state.autopilot.until_ms) {
            state.autopilot = {
              intent: 'eat',
              target: { type: 'nearest_food' },
              constraints: { risk: 'medium' },
              until_ms: state.renderNow + 99999999,
            };
          }
          if (state.over) startOrRestart(true);
          else if (state.paused || !state.running) resumeGame();
        } else {
          state.autopilot = null;
        }

        return toolResult(call, 'SetAutopilot', { status: 'ok', enabled: state.autopilotEnabled, senses: getWormSenses() });
      });

      chat.registerTool('Status', async (call) => {
        return toolResult(call, 'Status', {
          status: 'ok',
          running: !!state.running,
          paused: !!state.paused,
          score: state.score,
          highScore: state.highScore,
          senses: getWormSenses(),
        });
      });

      chat.registerTool('EnableMusic', async (call) => {
        const args = parseArgs(call);
        state.musicEnabled = !!args.enabled;
        ui.musicBtn.textContent = state.musicEnabled ? '🔊 Music On' : '🔇 Music Off';
        if (state.bgm) {
          if (state.musicEnabled && state.running && !state.paused && !state.over) {
            playBgmWithFade('music enabled via tool', BGM_FADE_IN_MS);
          } else {
            pauseBgm('music disabled via tool');
          }
        }
        return toolResult(call, 'EnableMusic', { status: 'ok', musicEnabled: state.musicEnabled, senses: getWormSenses() });
      });

      const setupMicObserver = () => {
        console.log('[WormCommander] setupMicObserver called, shadowRoot:', !!chat.shadowRoot);
        if (!chat.shadowRoot) return null;

        const micBtn = chat.shadowRoot.getElementById('wf-mic');
        console.log('[WormCommander] setupMicObserver micBtn:', !!micBtn);
        if (!(micBtn instanceof HTMLButtonElement)) {
          const allBtns = chat.shadowRoot.querySelectorAll('button');
          console.log('[WormCommander] All buttons in shadowRoot:', allBtns.length);
          allBtns.forEach((b, i) => console.log(`  btn[${i}]:`, b.id, b.getAttribute('aria-label')));
          return null;
        }

        let wasRecording = false;
        const observer = new MutationObserver(() => {
          const isHidden = micBtn.classList.contains('hidden');
          const isRecording = isHidden;

          console.log('[WormCommander] Mic mutation: hidden=', isHidden, 'isRecording=', isRecording, 'wasRecording=', wasRecording);

          setMicToggleUi(ui, isRecording);

          if (isRecording && !wasRecording) {
            if (state.bgm) {
              pauseBgm('recording started');
            }
          } else if (!isRecording && wasRecording) {
            if (state.bgm && state.musicEnabled && state.running && !state.paused && !state.over) {
              playBgmWithFade('recording stopped', BGM_FADE_IN_MS);
            }

            if (isFullscreenActive()) {
              console.log('[WormCommander] Recording stopped in fullscreen, checking for auto-submit');
              waitForAsrAndSend(chat, { source: 'fullscreen-auto', restoreTarget: null });
            }
          }
          wasRecording = isRecording;
        });

        observer.observe(micBtn, { attributes: true, attributeFilter: ['class'] });
        console.log('[WormCommander] Mic observer set up successfully');
        wasRecording = micBtn.classList.contains('hidden');
        setMicToggleUi(ui, wasRecording);
        return observer;
      };

      micObserver = setupMicObserver();
      if (micObserver) {
        window.wormMicObserver = micObserver;
      } else {
        console.log('[WormCommander] Mic observer setup failed, will retry');
        setTimeout(() => {
          if (!window.wormMicObserver) {
            const obs = setupMicObserver();
            if (obs) window.wormMicObserver = obs;
          }
        }, 500);
        setTimeout(() => {
          if (!window.wormMicObserver) {
            console.log('[WormCommander] Final retry for mic observer');
            const obs = setupMicObserver();
            if (obs) window.wormMicObserver = obs;
          }
        }, 1500);
      }
    }

    const onDocumentPointerDown = (e: PointerEvent) => {
      if (performance.now() > speechKeyboardFocusGuard.untilMs) return;
      const chatEl = speechKeyboardFocusGuard.chat;
      if (!chatEl) return;
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
      if (path.includes(chatEl)) speechKeyboardFocusGuard.lastPointerDownMs = performance.now();
    };

    document.addEventListener('pointerdown', onDocumentPointerDown, true);

    return () => {
      document.removeEventListener('pointerdown', onDocumentPointerDown, true);
      stopSpeechKeyboardFocusGuard();
      if (window.wormMicObserver) {
        window.wormMicObserver.disconnect();
        window.wormMicObserver = null;
      }
      if (micObserver) {
        micObserver.disconnect();
        micObserver = null;
      }
    };
  }

  return { toggleSpeech, setupSpeech };
}
