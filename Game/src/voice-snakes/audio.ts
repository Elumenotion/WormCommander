import { BGM_FADE_IN_MS, BGM_VOLUME } from './constants';
import type { WormState } from './types';

export type AudioController = {
  initAudio: () => void;
  cleanupAudio: () => void;
  cancelBgmFade: () => void;
  pauseBgm: (reason?: string) => void;
  playBgmWithFade: (reason?: string, durationMs?: number) => void;
};

export function createAudioController(state: WormState): AudioController {
  function cancelBgmFade(): void {
    if (state.bgmFadeRaf !== null) {
      cancelAnimationFrame(state.bgmFadeRaf);
      state.bgmFadeRaf = null;
    }
  }

  function pauseBgm(reason?: string): void {
    if (!state.bgm) return;
    cancelBgmFade();
    console.log('[WormCommander] BGM pause', reason ? `(${reason})` : '');
    state.bgm.pause();
  }

  function playBgmWithFade(reason?: string, durationMs?: number): void {
    const bgm = state.bgm;
    if (!bgm) return;
    if (!state.musicEnabled) return;
    if (!state.running || state.paused || state.over) return;

    cancelBgmFade();

    const target = BGM_VOLUME;
    const fadeMs = Math.max(0, Number.isFinite(durationMs) ? Number(durationMs) : BGM_FADE_IN_MS);

    if (!Number.isFinite(bgm.volume) || bgm.volume > target) bgm.volume = target;
    if (fadeMs > 0) bgm.volume = 0;

    console.log('[WormCommander] BGM play', reason ? `(${reason})` : '', { fadeMs, target });
    bgm.play()
      .then(() => {
        if (fadeMs <= 0) {
          bgm.volume = target;
          return;
        }
        const startTs = performance.now();
        const tick = (now: number) => {
          if (!state.bgm || state.bgm !== bgm) { state.bgmFadeRaf = null; return; }
          if (!state.musicEnabled || !state.running || state.paused || state.over) { state.bgmFadeRaf = null; return; }

          const t = Math.min(1, Math.max(0, (now - startTs) / fadeMs));
          bgm.volume = target * t;
          if (t < 1) state.bgmFadeRaf = requestAnimationFrame(tick);
          else {
            bgm.volume = target;
            state.bgmFadeRaf = null;
          }
        };
        state.bgmFadeRaf = requestAnimationFrame(tick);
      })
      .catch((e) => console.warn('[WormCommander] BGM play failed', e));
  }

  function initAudio(): void {
    try {
      state.bgm = new Audio('./sounds/voice-snakes/SUGAR-PLUM.mp3');
      state.bgm.loop = true;
      state.bgm.volume = BGM_VOLUME;
      console.log('[WormCommander] BGM initialized', { src: state.bgm.src, volume: state.bgm.volume });
    } catch (e) {
      console.warn('[WormCommander] Audio init failed', e);
    }
  }

  function cleanupAudio(): void {
    if (state.bgm) {
      cancelBgmFade();
      state.bgm.pause();
      state.bgm = null;
    }
  }

  return { initAudio, cleanupAudio, cancelBgmFade, pauseBgm, playBgmWithFade };
}
