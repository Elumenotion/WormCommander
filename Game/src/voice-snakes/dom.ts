import type { UiElements, WormState } from './types';

export function getUiElements(): UiElements {
  const canvas = document.getElementById('voice-snakes-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('voice-snakes: canvas not found');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('voice-snakes: 2d context not available');

  const scoreEl = document.getElementById('voice-snakes-score');
  const highScoreEl = document.getElementById('voice-snakes-high-score');
  const clockEl = document.getElementById('voice-snakes-clock');
  const overlayEl = document.getElementById('voice-snakes-overlay');
  const overlayTitleEl = document.getElementById('voice-snakes-overlay-title');
  const overlaySubtitleEl = document.getElementById('voice-snakes-overlay-subtitle');
  const overlayStatsEl = document.getElementById('voice-snakes-overlay-stats');
  const finalTimeEl = document.getElementById('voice-snakes-final-time');
  const finalScoreEl = document.getElementById('voice-snakes-final-score');
  const finalHighScoreEl = document.getElementById('voice-snakes-final-high-score');
  const startBtn = document.getElementById('voice-snakes-start');
  const pauseBtn = document.getElementById('voice-snakes-pause');
  const resetBtn = document.getElementById('voice-snakes-reset');
  const restartBtn = document.getElementById('voice-snakes-restart');
  const musicBtn = document.getElementById('voice-snakes-music');
  const micToggleBtn = document.getElementById('voice-snakes-mic-toggle');
  const fullscreenToggleBtn = document.getElementById('voice-snakes-fullscreen-toggle');

  if (
    !scoreEl ||
    !highScoreEl ||
    !overlayEl ||
    !overlayTitleEl ||
    !overlaySubtitleEl ||
    !startBtn ||
    !pauseBtn ||
    !resetBtn ||
    !restartBtn ||
    !micToggleBtn ||
    !fullscreenToggleBtn ||
    !musicBtn
  ) {
    throw new Error('voice-snakes: UI elements not found');
  }

  return {
    canvas,
    ctx,
    scoreEl,
    highScoreEl,
    clockEl,
    overlayEl,
    overlayTitleEl,
    overlaySubtitleEl,
    overlayStatsEl,
    finalTimeEl,
    finalScoreEl,
    finalHighScoreEl,
    startBtn,
    pauseBtn,
    resetBtn,
    restartBtn,
    musicBtn,
    micToggleBtn,
    fullscreenToggleBtn,
  };
}

export function setOverlay(
  ui: UiElements,
  visible: boolean,
  title: string,
  subtitle: string,
  showStats = false
): void {
  ui.overlayEl.hidden = !visible;
  ui.overlayTitleEl.textContent = title || '';
  ui.overlaySubtitleEl.textContent = subtitle || '';
  if (ui.overlayStatsEl) {
    ui.overlayStatsEl.hidden = !showStats;
  }
}

export function updateScoreUI(state: WormState, ui: UiElements): void {
  ui.scoreEl.textContent = String(state.score);
  ui.highScoreEl.textContent = String(state.highScore);
}

export function formatClock(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function updateClockUI(state: WormState, ui: UiElements): void {
  if (ui.clockEl) {
    ui.clockEl.textContent = formatClock(state.gameElapsedMs);
  }
}

export function setMicToggleUi(ui: UiElements, isRecording: boolean): void {
  ui.micToggleBtn.textContent = isRecording ? 'Stop Mic' : 'Mic';
  ui.micToggleBtn.classList.toggle('is-recording', !!isRecording);
  ui.micToggleBtn.setAttribute('aria-pressed', isRecording ? 'true' : 'false');
}

export function updateFullscreenButton(
  ui: UiElements,
  isFullscreenActive: () => boolean
): void {
  ui.fullscreenToggleBtn.textContent = isFullscreenActive() ? 'Exit Fullscreen' : 'Fullscreen';
}
