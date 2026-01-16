import {
  COLORS,
  FOOD_RADIUS,
  FULLSCREEN_PHONE_MIN_SIDE_PX,
  FULLSCREEN_PHONE_ZOOM_MULT,
  SNAKE_RADIUS,
  VIEW_BASE_PX,
} from './constants';
import { updateFullscreenButton as updateFullscreenButtonUi } from './dom';
import type { UiElements, Viewport, WormState } from './types';

export type Renderer = {
  setupCanvas: () => void;
  render: () => void;
  initBackground: () => void;
  isFullscreenActive: () => boolean;
  togglePlayAreaFullscreen: () => void;
  updateFullscreenButton: () => void;
};

export function createRenderer(state: WormState, viewport: Viewport, ui: UiElements): Renderer {
  const { canvas, ctx } = ui;

  function setupCanvas(): void {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    viewport.w = Math.max(1, Math.floor(rect.width));
    viewport.h = Math.max(1, Math.floor(rect.height));
    viewport.dpr = dpr;

    canvas.width = Math.floor(viewport.w * dpr);
    canvas.height = Math.floor(viewport.h * dpr);

    viewport.zoom = Math.max(0.35, Math.min(2.5, Math.min(viewport.w / VIEW_BASE_PX, viewport.h / VIEW_BASE_PX)));

    const card = canvas.closest('.snakes-card');
    const isFullscreen = !!(card && card.classList.contains('pseudo-fullscreen'));
    const minSide = Math.min(viewport.w, viewport.h);
    if (isFullscreen && minSide <= FULLSCREEN_PHONE_MIN_SIDE_PX) {
      viewport.zoom = Math.max(0.35, Math.min(2.5, viewport.zoom * FULLSCREEN_PHONE_ZOOM_MULT));
    }
    viewport.vw = viewport.w / viewport.zoom;
    viewport.vh = viewport.h / viewport.zoom;
  }

  function render(): void {
    const animNow = performance.now();
    const t = animNow / 1000;

    const { dpr, zoom, vw, vh } = viewport;
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);

    const head = state.trail[0] || { x: 0, y: 0 };
    const cx = vw / 2;
    const cy = vh / 2;
    const camX = head.x - cx;
    const camY = head.y - cy;

    ctx.clearRect(0, 0, vw, vh);

    const BG_PARALLAX = 0.1;
    if (state.bgImage && state.bgImage.complete && state.bgImage.naturalWidth > 0) {
      const bgScale = 10;
      const bgW = vw * bgScale;
      const bgH = vh * bgScale;
      const bgX = -bgW / 2 - camX * BG_PARALLAX;
      const bgY = -bgH / 2 - camY * BG_PARALLAX;
      ctx.drawImage(state.bgImage, bgX, bgY, bgW, bgH);
    } else {
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, vw, vh);
    }

    const offscreenMargin = 50 / zoom;

    for (const f of state.foods) {
      const sx = f.x - camX;
      const sy = f.y - camY;
      if (sx < -offscreenMargin || sy < -offscreenMargin || sx > vw + offscreenMargin || sy > vh + offscreenMargin) continue;

      const pulse = 0.5 + 0.5 * Math.sin((Math.PI * 2) * f.pulseHz * t + f.phase);
      const glowR = FOOD_RADIUS + 12 + pulse * 10;
      const coreR = FOOD_RADIUS + pulse * 1.5;

      const core = `hsl(${f.hue} 95% 60%)`;
      const mid = `hsla(${f.hue}, 95%, 60%, ${0.32 + pulse * 0.18})`;
      const edge = `hsla(${f.hue}, 95%, 60%, 0)`;

      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
      g.addColorStop(0, mid);
      g.addColorStop(0.4, `hsla(${f.hue}, 95%, 60%, ${0.12 + pulse * 0.10})`);
      g.addColorStop(1, edge);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = core;
      ctx.arc(sx, sy, coreR, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = `hsla(${f.hue}, 100%, 85%, ${0.55 - pulse * 0.2})`;
      ctx.arc(sx - coreR * 0.25, sy - coreR * 0.25, Math.max(1.5, coreR * 0.28), 0, Math.PI * 2);
      ctx.fill();
    }

    for (const npc of state.npcs) {
      if (!npc.trail || npc.trail.length < 2) continue;

      const bodyOutline = `hsla(${npc.hue}, 95%, 18%, 0.9)`;
      const bodyMain = `hsl(${npc.hue} 95% 55%)`;
      const bodyHighlight = `hsl(${npc.hue} 100% 72%)`;

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = bodyOutline;
      ctx.lineWidth = SNAKE_RADIUS * 2 + 6;
      ctx.beginPath();
      for (let i = 0; i < npc.trail.length; i++) {
        const p = npc.trail[i];
        const sx = p.x - camX;
        const sy = p.y - camY;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      ctx.strokeStyle = bodyMain;
      ctx.lineWidth = SNAKE_RADIUS * 2 + 1;
      ctx.beginPath();
      for (let i = 0; i < npc.trail.length; i++) {
        const p = npc.trail[i];
        const sx = p.x - camX;
        const sy = p.y - camY;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      ctx.strokeStyle = bodyOutline;
      ctx.lineWidth = Math.max(1.6, SNAKE_RADIUS * 0.28);
      ctx.lineCap = 'round';
      const ringStep = 12;
      const ringHalf = SNAKE_RADIUS * 0.95;
      for (let i = ringStep; i < npc.trail.length - 2; i += ringStep) {
        const prev = npc.trail[i - 1];
        const cur = npc.trail[i];
        const next = npc.trail[i + 1];
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const sx = cur.x - camX;
        const sy = cur.y - camY;
        const alpha = 0.18 + 0.55 * (1 - i / npc.trail.length);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(sx - nx * ringHalf, sy - ny * ringHalf);
        ctx.lineTo(sx + nx * ringHalf, sy + ny * ringHalf);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      ctx.strokeStyle = bodyHighlight;
      ctx.lineWidth = Math.max(2, SNAKE_RADIUS * 0.7);
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      const waveStep = 4;
      for (let i = 0; i < npc.trail.length; i += waveStep) {
        const p = npc.trail[i];
        const sx = p.x - camX;
        const sy = p.y - camY;
        const wiggle = Math.sin(t * 4 + i * 0.15) * 1;
        if (i === 0) ctx.moveTo(sx, sy + wiggle);
        else ctx.lineTo(sx, sy + wiggle);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      const npcHead = npc.trail[0];
      const hx = npcHead.x - camX;
      const hy = npcHead.y - camY;
      const hr = SNAKE_RADIUS + 4;
      const a = npc.angle;
      const fx = Math.cos(a);
      const fy = Math.sin(a);
      const lx = -fy;
      const ly = fx;
      const hg = ctx.createRadialGradient(hx - fx * hr * 0.25, hy - fy * hr * 0.25, hr * 0.2, hx, hy, hr * 1.4);
      hg.addColorStop(0, `hsl(${npc.hue} 100% 78%)`);
      hg.addColorStop(0.55, `hsl(${npc.hue} 95% 55%)`);
      hg.addColorStop(1, `hsl(${npc.hue} 95% 22%)`);
      ctx.beginPath();
      ctx.fillStyle = hg;
      ctx.arc(hx, hy, hr, 0, Math.PI * 2);
      ctx.fill();

      const eyeForward = hr * 0.28;
      const eyeSide = hr * 0.38;
      const eyeR = Math.max(2.1, hr * 0.17);
      const pupilR = Math.max(1.3, eyeR * 0.45);
      const leftEye = { x: hx + fx * eyeForward + lx * eyeSide, y: hy + fy * eyeForward + ly * eyeSide };
      const rightEye = { x: hx + fx * eyeForward - lx * eyeSide, y: hy + fy * eyeForward - ly * eyeSide };

      for (const e of [leftEye, rightEye]) {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.arc(e.x, e.y, eyeR, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = 'rgba(25,25,25,0.9)';
        ctx.arc(e.x + fx * eyeR * 0.25, e.y + fy * eyeR * 0.25, pupilR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (state.trail.length >= 2) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const bodyOutline = 'rgba(180,32,37,0.95)';
      const bodyMain = COLORS.brandGold;
      const bodyHighlight = COLORS.brandYellow;

      ctx.strokeStyle = bodyOutline;
      ctx.lineWidth = SNAKE_RADIUS * 2 + 6;
      ctx.beginPath();
      for (let i = 0; i < state.trail.length; i++) {
        const p = state.trail[i];
        const sx = p.x - camX;
        const sy = p.y - camY;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      ctx.strokeStyle = bodyMain;
      ctx.lineWidth = SNAKE_RADIUS * 2 + 1;
      ctx.beginPath();
      for (let i = 0; i < state.trail.length; i++) {
        const p = state.trail[i];
        const sx = p.x - camX;
        const sy = p.y - camY;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      ctx.strokeStyle = bodyOutline;
      ctx.lineWidth = Math.max(1.6, SNAKE_RADIUS * 0.28);
      ctx.lineCap = 'round';
      const ringStep = 12;
      const ringHalf = SNAKE_RADIUS * 0.95;
      for (let i = ringStep; i < state.trail.length - 2; i += ringStep) {
        const prev = state.trail[i - 1];
        const cur = state.trail[i];
        const next = state.trail[i + 1];
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const sx = cur.x - camX;
        const sy = cur.y - camY;
        const alpha = 0.25 + 0.65 * (1 - i / state.trail.length);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(sx - nx * ringHalf, sy - ny * ringHalf);
        ctx.lineTo(sx + nx * ringHalf, sy + ny * ringHalf);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      ctx.strokeStyle = bodyHighlight;
      ctx.lineWidth = Math.max(2, SNAKE_RADIUS * 0.7);
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      const waveStep = 4;
      for (let i = 0; i < state.trail.length; i += waveStep) {
        const p = state.trail[i];
        const sx = p.x - camX;
        const sy = p.y - camY;
        const wiggle = Math.sin(t * 4 + i * 0.15) * 1.2;
        if (i === 0) ctx.moveTo(sx, sy + wiggle);
        else ctx.lineTo(sx, sy + wiggle);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const headPoint = state.trail[0] || { x: 0, y: 0 };
    const sx = headPoint.x - camX;
    const sy = headPoint.y - camY;
    const a = state.angle;
    const r = SNAKE_RADIUS + 4;
    const fx = Math.cos(a);
    const fy = Math.sin(a);
    const lx = -fy;
    const ly = fx;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;

    const g = ctx.createRadialGradient(sx - fx * r * 0.25, sy - fy * r * 0.25, r * 0.2, sx, sy, r * 1.4);
    g.addColorStop(0, COLORS.brandYellow);
    g.addColorStop(0.55, COLORS.brandOrange);
    g.addColorStop(1, COLORS.brandRed);

    ctx.beginPath();
    ctx.fillStyle = g;
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const eyeForward = r * 0.28;
    const eyeSide = r * 0.38;
    const eyeR = Math.max(2.2, r * 0.18);
    const pupilR = Math.max(1.4, eyeR * 0.45);
    const leftEye = { x: sx + fx * eyeForward + lx * eyeSide, y: sy + fy * eyeForward + ly * eyeSide };
    const rightEye = { x: sx + fx * eyeForward - lx * eyeSide, y: sy + fy * eyeForward - ly * eyeSide };

    for (const e of [leftEye, rightEye]) {
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.arc(e.x, e.y, eyeR, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = 'rgba(25,25,25,0.9)';
      ctx.arc(e.x + fx * eyeR * 0.25, e.y + fy * eyeR * 0.25, pupilR, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.arc(e.x - fx * pupilR * 0.35, e.y - fy * pupilR * 0.35, Math.max(0.8, pupilR * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(40,20,10,0.65)';
    ctx.lineWidth = Math.max(1.5, r * 0.10);
    ctx.lineCap = 'round';
    ctx.beginPath();
    const mx = sx + fx * r * 0.55;
    const my = sy + fy * r * 0.55;
    const mR = r * 0.32;
    ctx.arc(mx, my, mR, a + Math.PI * 0.75, a + Math.PI * 1.25);
    ctx.stroke();

    const flick = 0.5 + 0.5 * Math.sin(t * 6.5);
    if (flick > 0.72) {
      const len = r * (0.8 + (flick - 0.72) * 3.0);
      ctx.strokeStyle = 'rgba(180,32,37,0.9)';
      ctx.lineWidth = Math.max(1.2, r * 0.08);
      ctx.beginPath();
      ctx.moveTo(mx + fx * mR * 0.85, my + fy * mR * 0.85);
      ctx.lineTo(mx + fx * (mR * 0.85 + len), my + fy * (mR * 0.85 + len));
      ctx.stroke();
    }

    if (state.paused) {
      ctx.fillStyle = COLORS.text;
      ctx.font = '600 20px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Paused', vw / 2, 32);
    }
  }

  function initBackground(): void {
    state.bgImage = new Image();
    state.bgImage.src = './sounds/voice-snakes/background.png';
    state.bgImage.onload = () => {
      console.log('[WormCommander] Background image loaded');
      render();
    };
  }

  function isFullscreenActive(): boolean {
    const card = canvas.closest('.snakes-card');
    return !!(card && card.classList.contains('pseudo-fullscreen'));
  }

  function updateFullscreenButton(): void {
    updateFullscreenButtonUi(ui, isFullscreenActive);
  }

  function togglePlayAreaFullscreen(): void {
    const card = canvas.closest('.snakes-card');
    if (!(card instanceof HTMLElement)) return;

    if (isFullscreenActive()) {
      card.classList.remove('pseudo-fullscreen');
      document.body.classList.remove('has-pseudo-fullscreen');
    } else {
      card.classList.add('pseudo-fullscreen');
      document.body.classList.add('has-pseudo-fullscreen');
    }

    setupCanvas();
    render();
    updateFullscreenButton();
    canvas.focus({ preventScroll: true });
  }

  return { setupCanvas, render, initBackground, isFullscreenActive, togglePlayAreaFullscreen, updateFullscreenButton };
}
