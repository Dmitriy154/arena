export const VIEW_WIDTH = 1280;
export const VIEW_HEIGHT = 720;

export const WORLD_WIDTH = 3840;
export const WORLD_HEIGHT = 2160;
export const WORLD_MARGIN = 70;

export const UNIT_SIZE = 50;
export const FORMATION_SPACING = UNIT_SIZE + 38;
/** Радиус поиска проходимой точки для слота строя. */
export const FORMATION_SNAP_RADIUS = 220;
/** Шаг кольцевого поиска проходимой точки. */
export const FORMATION_SNAP_STEP = 20;

export const CAMERA_MIN_ZOOM = 0.55;
export const CAMERA_MAX_ZOOM = 2.4;
export const CAMERA_START_ZOOM = 2 / 3;
export const CAMERA_ZOOM_STEP = 1.18;
export const CAMERA_ZOOM_SMOOTHING = 14;
export const CAMERA_PAN_SPEED = 760;

export const DRAG_THRESHOLD = 6;

/** Радиус обзора одного отряда игрока, в пикселях мира. */
export const VISION_RADIUS = 440;
/** Насколько падает обзор отряда в чаще леса. */
export const FOREST_VISION_FACTOR = 0.35;
/** Глубина у кромки, где обзор ещё полный. */
export const FOREST_VISION_EDGE = 20;
/** Глубина, с которой обзор падает до минимума. */
export const FOREST_VISION_DEPTH = 90;
/** Первые пиксели луча от наблюдателя лес не считается преградой. */
export const FOREST_SIGHT_CLEAR_RADIUS = 80;
/** Сколько леса подряд должно быть на луче, чтобы обзор перекрылся. */
export const FOREST_SIGHT_BLOCK_DEPTH = 60;
/** Шаг выборки вдоль луча при проверке перекрытия. */
export const SIGHT_SAMPLE_STEP = 16;
/** Плотность «дымки» на уже разведанной, но не просматриваемой территории. */
export const FOG_SHROUD_ALPHA = 0.58;
/** Через сколько пикселей пути обновляется разведанная зона. */
export const FOG_EXPLORE_STEP = 26;
export const VISION_BRUSH_TEXTURE = 'vision-brush';
/** Масштабы кисти обзора: отряд в чаще рисует туман меньшим кругом. */
export const VISION_BRUSH_SCALES = [1, 0.8, 0.6, 0.4] as const;
export const visionBrushKey = (index: number): string =>
  `${VISION_BRUSH_TEXTURE}-${index}`;
/**
 * Разрешение слоёв тумана относительно мира: кисти и текстуры считаются
 * в этих единицах. Туман мягкий, поэтому четверти разрешения хватает,
 * а пикселей в 16 раз меньше, чем в полном размере мира.
 */
export const FOG_RESOLUTION = 0.25;

/** Размер клетки сетки проходимости для A*. */
export const PATH_CELL_SIZE = 40;

/** Множитель скорости в лесу. */
export const FOREST_SPEED_MULTIPLIER = 0.4;
/** Во сколько раз A* считает клетку леса дороже её реальной цены: заставляет обходить. */
export const FOREST_PATH_COST_FACTOR = 3;
/** В лесу враг виден только с этого процента радиуса обзора. */
export const FOREST_CONCEALMENT_FACTOR = 0.25;

export const COLORS = {
  background: 0x0b1510,
  grass: 0x3c663d,
  border: 0x1b261d,
  accent: 0x8cf2b5,
  text: '#d9ece1',
  textMuted: '#87a894',
  panel: 0x0a1710,
  fog: 0x000000,
} as const;

export const FONT_FAMILY = "'Segoe UI', Arial, sans-serif";
