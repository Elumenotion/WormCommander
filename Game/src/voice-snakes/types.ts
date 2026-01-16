export type Vec2 = { x: number; y: number };

export type Food = {
  x: number;
  y: number;
  hue: number;
  phase: number;
  pulseHz: number;
};

export type NpcSnake = {
  id: number;
  trail: Vec2[];
  angle: number;
  hue: number;
  speed: number;
  turnDir: -1 | 0 | 1;
  nextTurnAt: number;
  deadUntil: number;
};

export type AutopilotCommand = {
  intent: string;
  target: unknown;
  constraints: {
    risk?: 'low' | 'medium' | 'high';
    min_clearance?: number;
    avoid_snakes?: boolean;
    avoid_self?: boolean;
    prefer_food?: boolean;
    [key: string]: unknown;
  };
  until_ms: number;
};

export type ManualSteer = {
  targetAngle: number;
  until_ms: number;
  turnBuffer: number;
};

export type InputState = {
  left: boolean;
  right: boolean;
  holdDir: -1 | 0 | 1;
  holdStartAngle: number;
  holdTurnUsed: number;
  holdTurnBuffer: number;
};

export type Viewport = {
  w: number;
  h: number;
  dpr: number;
  zoom: number;
  vw: number;
  vh: number;
};

export type WormState = {
  trail: Vec2[];
  angle: number;
  score: number;
  highScore: number;
  running: boolean;
  paused: boolean;
  over: boolean;
  lastTs: number;
  raf: number | null;
  foods: Food[];
  renderNow: number;
  npcs: NpcSnake[];
  nextNpcId: number;
  autopilotEnabled: boolean;
  autopilot: AutopilotCommand | null;
  autopilotLastDecisionAt: number;
  autopilotEvalCount: number;
  autopilotLastTurnSign: number;
  autopilotLockedFoodId: string | null;
  autopilotLockedFoodUntil: number;
  bgm: HTMLAudioElement | null;
  bgmFadeRaf: number | null;
  bgImage: HTMLImageElement | null;
  musicEnabled: boolean;
  gameElapsedMs: number;
  manualSteer: ManualSteer | null;
};

export type UiElements = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scoreEl: HTMLElement;
  highScoreEl: HTMLElement;
  clockEl: HTMLElement | null;
  overlayEl: HTMLElement;
  overlayTitleEl: HTMLElement;
  overlaySubtitleEl: HTMLElement;
  overlayStatsEl: HTMLElement | null;
  finalTimeEl: HTMLElement | null;
  finalScoreEl: HTMLElement | null;
  finalHighScoreEl: HTMLElement | null;
  startBtn: HTMLElement;
  pauseBtn: HTMLElement;
  resetBtn: HTMLElement;
  restartBtn: HTMLElement;
  musicBtn: HTMLElement;
  micToggleBtn: HTMLElement;
  fullscreenToggleBtn: HTMLElement;
};

export type WormSensesOptions = {
  range?: number;
  maxPellets?: number;
  maxSnakes?: number;
  segmentsPerSnake?: number;
};

export type WormSensesPellet = {
  id: string;
  dist: number;
  bearing_deg: number;
  value: number;
  color_hue: number;
};

export type WormSensesSnakeBodyPoint = {
  dist: number;
  bearing_deg: number;
};

export type WormSensesSnake = {
  id: string;
  dist: number;
  bearing_deg: number;
  heading_deg: number;
  radius: number;
  threat: {
    head_dist: number;
    min_body_dist: number | null;
    collision_in_s: number | null;
  };
  body_points_polar: WormSensesSnakeBodyPoint[];
};

export type WormSenses = {
  type: 'worm_senses_v1';
  ts_ms: number;
  you: {
    pos_world: { x: number; y: number };
    heading_deg: number;
    speed: number;
    radius: number;
    length: number;
    score: number;
  };
  view: {
    range: number;
    fov_deg: number;
    max_items: {
      pellets: number;
      snakes: number;
      segments_per_snake: number;
    };
  };
  pellets: WormSensesPellet[];
  snakes: WormSensesSnake[];
};

export type SpeechKeyboardFocusGuard = {
  untilMs: number;
  chat: HTMLElement | null;
  restoreTarget: HTMLElement | null;
  raf: number | null;
  lastPointerDownMs: number;
};
