export const COLORS = {
  bg: '#0b1220',
  // Brand palette (from `public/LogoV2.svg`)
  brandRed: '#b42025',
  brandOrange: '#efa022',
  brandGold: '#fed209',
  brandYellow: '#fee85e',
  text: 'rgba(255,255,255,0.88)',
} as const;

export const TURN_DEG = 30;
export const TURN_RAD = (TURN_DEG * Math.PI) / 180;
export const TURN_RATE_DEG_PER_SEC = 180; // 6 * 30° steps per second when held
export const TURN_RATE_RAD_PER_SEC = (TURN_RATE_DEG_PER_SEC * Math.PI) / 180;
export const SNAKE_RADIUS = 10; // world units (CSS pixels)
export const BASE_LENGTH = 160; // pixels
export const GROWTH_PER_FOOD = 28; // pixels
export const SPEED_PX_PER_SEC = 140;
export const NPC_COUNT = 12; // Increased count
export const NPC_SPEED_PX_PER_SEC = 120;
export const NPC_TURN_RATE_RAD_PER_SEC = (120 * Math.PI) / 180;
export const NPC_RECENTER_RADIUS = 2600; // if an NPC gets too far from the player, respawn it near the player
export const FOOD_COUNT = 24; // Increased food too
export const FOOD_RADIUS = 7;
export const FOOD_SPAWN_RADIUS = 1300; // around head
export const FOOD_RECENTER_RADIUS = 1800; // if a pellet is farther than this from the head, respawn it near the head

// --- Audio ---
// Note: browsers/OS can "duck" audio when the microphone is active. We intentionally
// fade BGM back in on resume to avoid a brief perceived loudness spike.
export const BGM_VOLUME = 0.2;
export const BGM_FADE_IN_MS = 220;

// --- "Worm senses" (Option A: worm-centric polar snapshot) ---
export const SENSE_RANGE = 1400; // world px radius included in senses snapshot
export const SENSE_MAX_PELLETS = 40;
export const SENSE_MAX_SNAKES = 16;
export const SENSE_SEGMENTS_PER_SNAKE = 12;
export const AUTOPILOT_DECISION_MS = 200;
export const AUTOPILOT_DANGER_DECISION_MS = 60; // react faster when a collision is near
export const SELF_CLEARANCE_LOOKAHEAD_PX = 1400; // how far ahead we check for self-tail collisions when steering
export const SELF_CLEARANCE_BUFFER_PX = 12; // extra buffer - keep small so we don't detect segments beside us
export const SELF_CLEARANCE_STEP_PX = 18; // sampling step for clearance checks
export const AUTOPILOT_TURN_DEADZONE_DEG = 14; // small target bearing changes shouldn't cause oscillation
export const AUTOPILOT_TURN_INERTIA_BONUS = 40; // small bias; too much causes orbiting
export const AUTOPILOT_TARGET_LOCK_MS = 1500; // lock a chosen food target briefly to avoid thrash

export const VIEW_BASE_PX = 900; // virtual viewport size; canvas resizing zooms content relative to this
export const FULLSCREEN_PHONE_ZOOM_MULT = 1.7;
export const FULLSCREEN_PHONE_MIN_SIDE_PX = 560; // treat <= this as "phone-ish" for fullscreen zoom (CSS px)
