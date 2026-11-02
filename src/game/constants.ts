export const VIEW_WIDTH = 1280;
export const VIEW_HEIGHT = 720;

export const WORLD_WIDTH = 1920;
export const WORLD_HEIGHT = 1080;
export const WORLD_MARGIN = 70;

export const UNIT_SIZE = 50;
export const FORMATION_SPACING = UNIT_SIZE + 16;

export const CAMERA_MIN_ZOOM = 0.55;
export const CAMERA_MAX_ZOOM = 2.4;
export const CAMERA_START_ZOOM = 2 / 3;
export const CAMERA_ZOOM_STEP = 1.18;
export const CAMERA_ZOOM_SMOOTHING = 14;
export const CAMERA_PAN_SPEED = 760;

export const DRAG_THRESHOLD = 6;

export const COLORS = {
  background: 0x0b1510,
  grass: 0x3c663d,
  border: 0x1b261d,
  accent: 0x8cf2b5,
  text: '#d9ece1',
  textMuted: '#87a894',
  panel: 0x0a1710,
} as const;

export const FONT_FAMILY = "'Segoe UI', Arial, sans-serif";
