import { BGM_FADE_IN_MS } from './constants';
import { getUiElements } from './dom';
import { createAudioController } from './audio';
import { createGameLoop } from './game-loop';
import { createInputHandlers } from './input';
import { createRenderer } from './render';
import { createSpeechController } from './speech';
import { getWormSenses } from './senses';
import { createInputState, createState, createViewport, loadHighScore } from './state';
import type { WormSensesOptions } from './types';

export function initVoiceSnakes(): void {
  const start = () => {
    if (window.wormCleanup) {
      console.log('[WormCommander] Cleaning up previous instance');
      try { window.wormCleanup(); } catch (e) { console.warn('[WormCommander] Cleanup error', e); }
    }

    const ui = getUiElements();
    const state = createState();
    const input = createInputState();
    const viewport = createViewport();

    const audio = createAudioController(state);
    const renderer = createRenderer(state, viewport, ui);
    const gameLoop = createGameLoop({
      state,
      input,
      ui,
      render: renderer.render,
      playBgmWithFade: audio.playBgmWithFade,
      pauseBgm: audio.pauseBgm,
      cancelBgmFade: audio.cancelBgmFade,
    });

    const getSenses = (options?: WormSensesOptions) => getWormSenses(state, options);
    window.WormCommander = { getSenses };

    const speech = createSpeechController({
      state,
      ui,
      getWormSenses: getSenses,
      playBgmWithFade: audio.playBgmWithFade,
      pauseBgm: audio.pauseBgm,
      startOrRestart: gameLoop.startOrRestart,
      pauseGame: gameLoop.pauseGame,
      resumeGame: gameLoop.resumeGame,
      safeNudgeTurn: gameLoop.safeNudgeTurn,
      safeHoldTurn: gameLoop.safeHoldTurn,
      isFullscreenActive: renderer.isFullscreenActive,
    });

    const inputHandlers = createInputHandlers({
      state,
      input,
      viewport,
      ui,
      render: renderer.render,
      resetGame: gameLoop.resetGame,
      startGame: gameLoop.startGame,
      togglePlayAreaFullscreen: renderer.togglePlayAreaFullscreen,
      isFullscreenActive: renderer.isFullscreenActive,
      toggleSpeech: speech.toggleSpeech,
    });

    renderer.setupCanvas();
    state.highScore = loadHighScore();
    audio.initAudio();
    renderer.initBackground();

    gameLoop.resetGame();

    const speechCleanup = speech.setupSpeech();
    inputHandlers.bind();

    const onResize = () => {
      renderer.setupCanvas();
      renderer.render();
    };

    const onStart = () => {
      gameLoop.resetGame();
      gameLoop.startGame();
    };
    const onPause = () => gameLoop.pauseToggle();
    const onReset = () => {
      gameLoop.resetGame();
      gameLoop.startGame();
    };
    const onRestart = () => {
      gameLoop.resetGame();
      gameLoop.startGame();
    };
    const onMusic = () => {
      state.musicEnabled = !state.musicEnabled;
      ui.musicBtn.textContent = state.musicEnabled ? '🔊 Music On' : '🔇 Music Off';
      if (state.bgm) {
        if (state.musicEnabled && state.running && !state.paused && !state.over) {
          audio.playBgmWithFade('music enabled', BGM_FADE_IN_MS);
        } else {
          audio.pauseBgm('music disabled');
        }
      }
    };
    const onMicToggle = (e: MouseEvent) => {
      e.preventDefault();
      speech.toggleSpeech({ source: 'ui' });
      ui.canvas.focus({ preventScroll: true });
    };
    const onFullscreenToggle = (e: MouseEvent) => {
      e.preventDefault();
      renderer.togglePlayAreaFullscreen();
    };

    window.addEventListener('resize', onResize);
    ui.startBtn.addEventListener('click', onStart);
    ui.pauseBtn.addEventListener('click', onPause);
    ui.resetBtn.addEventListener('click', onReset);
    ui.restartBtn.addEventListener('click', onRestart);
    ui.musicBtn.addEventListener('click', onMusic);
    ui.micToggleBtn.addEventListener('click', onMicToggle);
    ui.fullscreenToggleBtn.addEventListener('click', onFullscreenToggle);

    renderer.updateFullscreenButton();

    window.wormCleanup = () => {
      window.removeEventListener('resize', onResize);
      ui.startBtn.removeEventListener('click', onStart);
      ui.pauseBtn.removeEventListener('click', onPause);
      ui.resetBtn.removeEventListener('click', onReset);
      ui.restartBtn.removeEventListener('click', onRestart);
      ui.musicBtn.removeEventListener('click', onMusic);
      ui.micToggleBtn.removeEventListener('click', onMicToggle);
      ui.fullscreenToggleBtn.removeEventListener('click', onFullscreenToggle);
      inputHandlers.cleanup();
      speechCleanup();
      audio.cleanupAudio();
      gameLoop.stopGame();
    };
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}
