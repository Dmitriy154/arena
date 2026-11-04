import Phaser from 'phaser';
import {
  FORMATION_SNAP_RADIUS,
  FORMATION_SNAP_STEP,
  FOREST_CONCEALMENT_FACTOR,
  FOREST_SIGHT_BLOCK_DEPTH,
  FOREST_SIGHT_CLEAR_RADIUS,
  FOREST_PATH_COST_FACTOR,
  FOREST_SPEED_MULTIPLIER,
  FOREST_VISION_DEPTH,
  FOREST_VISION_EDGE,
  FOREST_VISION_FACTOR,
  SIGHT_SAMPLE_STEP,
  UNIT_SIZE,
  WORLD_HEIGHT,
  WORLD_MARGIN,
  WORLD_WIDTH,
} from '../constants';
import type { UnitTypeId } from '../types';

export type TerrainKind = 'forest' | 'water';

export interface TerrainPatch {
  kind: TerrainKind;
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
}

const TERRAIN_TEXTURE = 'terrain-layer';
/** Сколько точек по окружности проверяется на габарит отряда. */
const FOOTPRINT_SAMPLES = 8;

/** Лес непроходим для конницы. */
const CAVALRY: ReadonlySet<UnitTypeId> = new Set<UnitTypeId>(['LC', 'HC']);

/**
 * Раскладка местности в мировых координатах. Патчи — эллипсы.
 * Держать свободными: зону старта игрока вокруг (960, 1080) и
 * зону старта врага вокруг (2880, 1080) — по 700 px в стороны.
 */
export const TERRAIN_PATCHES: readonly TerrainPatch[] = [
  { kind: 'water', x: 1400, y: 480, radiusX: 460, radiusY: 260 },
  { kind: 'water', x: 3240, y: 1760, radiusX: 360, radiusY: 200 },
  { kind: 'forest', x: 2300, y: 500, radiusX: 420, radiusY: 340 },
  { kind: 'forest', x: 1040, y: 1750, radiusX: 440, radiusY: 260 },
  { kind: 'forest', x: 2300, y: 1800, radiusX: 380, radiusY: 240 },
  { kind: 'forest', x: 1920, y: 1080, radiusX: 380, radiusY: 300 },
];

export class Terrain {
  private readonly image: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container) {
    this.image = Terrain.buildTexture(scene);
    parent.add(this.image);
  }

  kindAt(x: number, y: number): TerrainKind | null {
    for (const patch of TERRAIN_PATCHES) {
      const dx = (x - patch.x) / patch.radiusX;
      const dy = (y - patch.y) / patch.radiusY;

      if (dx * dx + dy * dy <= 1) {
        return patch.kind;
      }
    }

    return null;
  }

  isConcealing(x: number, y: number): boolean {
    return this.kindAt(x, y) === 'forest';
  }

  isPassable(x: number, y: number, type: UnitTypeId): boolean {
    const kind = this.kindAt(x, y);

    if (kind === 'water') {
      return false;
    }

    return !(kind === 'forest' && CAVALRY.has(type));
  }

  /** Проходимость с учётом габарита: центр и окружность радиусом в полкорпуса. */
  isAreaPassable(x: number, y: number, type: UnitTypeId): boolean {
    if (!this.isPassable(x, y, type)) {
      return false;
    }

    const radius = UNIT_SIZE / 2;

    for (let index = 0; index < FOOTPRINT_SAMPLES; index += 1) {
      const angle = (Math.PI * 2 * index) / FOOTPRINT_SAMPLES;
      const offsetX = Math.cos(angle) * radius;
      const offsetY = Math.sin(angle) * radius;

      if (!this.isPassable(x + offsetX, y + offsetY, type)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Ближайшая проходимая точка вокруг цели: слот строя не должен попадать
   * в воду или в лес, недоступный типу отряда, иначе отряд встаёт на краю.
   * Точки из avoid пропускаются, чтобы отряды не сходились в одну.
   */
  nearestPassablePoint(
    x: number,
    y: number,
    type: UnitTypeId,
    avoid: readonly { x: number; y: number }[] = [],
  ): Phaser.Math.Vector2 | null {
    if (this.isAreaPassable(x, y, type) && !Terrain.isOccupied(x, y, avoid)) {
      return new Phaser.Math.Vector2(x, y);
    }

    for (
      let radius = FORMATION_SNAP_STEP;
      radius <= FORMATION_SNAP_RADIUS;
      radius += FORMATION_SNAP_STEP
    ) {
      const samples = Math.max(8, Math.round((Math.PI * 2 * radius) / FORMATION_SNAP_STEP));
      let best: Phaser.Math.Vector2 | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (let index = 0; index < samples; index += 1) {
        const angle = (Math.PI * 2 * index) / samples;
        const candidateX = Phaser.Math.Clamp(
          x + Math.cos(angle) * radius,
          WORLD_MARGIN,
          WORLD_WIDTH - WORLD_MARGIN,
        );
        const candidateY = Phaser.Math.Clamp(
          y + Math.sin(angle) * radius,
          WORLD_MARGIN,
          WORLD_HEIGHT - WORLD_MARGIN,
        );

        if (!this.isAreaPassable(candidateX, candidateY, type)) {
          continue;
        }

        if (Terrain.isOccupied(candidateX, candidateY, avoid)) {
          continue;
        }

        const distance = Phaser.Math.Distance.Squared(x, y, candidateX, candidateY);

        if (distance < bestDistance) {
          bestDistance = distance;
          best = new Phaser.Math.Vector2(candidateX, candidateY);
        }
      }

      if (best) {
        return best;
      }
    }

    return null;
  }

  /**
   * Лес перекрывает взгляд: если луч проходит сквозь него дольше
   * FOREST_SIGHT_BLOCK_DEPTH, цель за лесом не видна.
   * Первые FOREST_SIGHT_CLEAR_RADIUS от наблюдателя не считаются,
   * иначе отряд в чаще слеп на всё.
   */
  blocksSight(fromX: number, fromY: number, toX: number, toY: number): boolean {
    const distance = Math.hypot(toX - fromX, toY - fromY);

    if (distance <= FOREST_SIGHT_CLEAR_RADIUS) {
      return false;
    }

    const steps = Math.max(1, Math.ceil(distance / SIGHT_SAMPLE_STEP));
    const stepLength = distance / steps;
    let forestRun = 0;

    for (let step = 1; step < steps; step += 1) {
      const travelled = step * stepLength;

      if (travelled < FOREST_SIGHT_CLEAR_RADIUS) {
        continue;
      }

      const ratio = step / steps;
      const x = fromX + (toX - fromX) * ratio;
      const y = fromY + (toY - fromY) * ratio;

      if (this.kindAt(x, y) === 'forest') {
        forestRun += stepLength;

        if (forestRun >= FOREST_SIGHT_BLOCK_DEPTH) {
          return true;
        }
      } else {
        forestRun = 0;
      }
    }

    return false;
  }

  private static isOccupied(
    x: number,
    y: number,
    avoid: readonly { x: number; y: number }[],
  ): boolean {
    const minimum = UNIT_SIZE + 6;

    return avoid.some((point) => Phaser.Math.Distance.Squared(x, y, point.x, point.y) < minimum * minimum);
  }

  /**
   * Множитель обзора наблюдателя: в чаще видно только вблизи, у самой кромки
   * обзор полный. Глубина считается по эллипсу патча.
   */
  visionMultiplier(x: number, y: number): number {
    const depth = this.forestDepth(x, y);

    if (depth <= FOREST_VISION_EDGE) {
      return 1;
    }

    const deep = Math.min(
      1,
      (depth - FOREST_VISION_EDGE) / (FOREST_VISION_DEPTH - FOREST_VISION_EDGE),
    );

    return 1 - (1 - FOREST_VISION_FACTOR) * deep;
  }

  /** Глубина точки внутри леса в пикселях; 0 — точка вне леса. */
  private forestDepth(x: number, y: number): number {
    let depth = 0;

    for (const patch of TERRAIN_PATCHES) {
      if (patch.kind !== 'forest') {
        continue;
      }

      const dx = (x - patch.x) / patch.radiusX;
      const dy = (y - patch.y) / patch.radiusY;
      const norm = Math.hypot(dx, dy);

      if (norm >= 1) {
        continue;
      }

      const patchDepth = (1 - norm) * Math.min(patch.radiusX, patch.radiusY);

      if (patchDepth > depth) {
        depth = patchDepth;
      }
    }

    return depth;
  }

  speedMultiplier(x: number, y: number): number {
    return this.kindAt(x, y) === 'forest' ? FOREST_SPEED_MULTIPLIER : 1;
  }

  /**
   * Цена входа в клетку для A*: обратная скорость, а лес ещё и штрафуется,
   * чтобы отряд обходил чащу, а не шёл сквозь неё.
   */
  moveCost(x: number, y: number): number {
    const speed = this.speedMultiplier(x, y);

    return this.kindAt(x, y) === 'forest' ? (1 / speed) * FOREST_PATH_COST_FACTOR : 1 / speed;
  }

  /** Радиус, с которого виден объект в этой точке: в лесу он меньше. */
  concealmentRadius(radius: number, x: number, y: number): number {
    return this.isConcealing(x, y) ? radius * FOREST_CONCEALMENT_FACTOR : radius;
  }

  private static buildTexture(scene: Phaser.Scene): Phaser.GameObjects.Image {
    if (!scene.textures.exists(TERRAIN_TEXTURE)) {
      const graphics = scene.make.graphics({ x: 0, y: 0 }, false);

      TERRAIN_PATCHES.forEach((patch, index) => {
        if (patch.kind === 'water') {
          Terrain.drawWater(graphics, patch, index);
        } else {
          Terrain.drawForest(graphics, patch, index);
        }
      });

      graphics.generateTexture(TERRAIN_TEXTURE, WORLD_WIDTH, WORLD_HEIGHT);
      graphics.destroy();
    }

    return scene.add.image(0, 0, TERRAIN_TEXTURE).setOrigin(0);
  }

  private static drawWater(
    graphics: Phaser.GameObjects.Graphics,
    patch: TerrainPatch,
    index: number,
  ): void {
    const random = new Phaser.Math.RandomDataGenerator(['water', String(index)]);

    graphics.fillStyle(0x6f8f6a, 0.35);
    graphics.fillEllipse(patch.x, patch.y, patch.radiusX * 2 + 16, patch.radiusY * 2 + 16);

    graphics.fillStyle(0x16384f, 1);
    graphics.fillEllipse(patch.x, patch.y, patch.radiusX * 2, patch.radiusY * 2);

    graphics.fillStyle(0x1e4a66, 1);
    graphics.fillEllipse(patch.x, patch.y, patch.radiusX * 1.84, patch.radiusY * 1.84);

    graphics.fillStyle(0x2b6389, 0.5);
    graphics.fillEllipse(
      patch.x - patch.radiusX * 0.16,
      patch.y - patch.radiusY * 0.2,
      patch.radiusX * 1.1,
      patch.radiusY * 0.92,
    );

    graphics.lineStyle(2, 0x9fd6ef, 0.16);

    for (let index2 = 0; index2 < 16; index2 += 1) {
      const angle = random.rotation();
      const spread = Math.sqrt(random.frac()) * 0.78;
      const x = patch.x + Math.cos(angle) * patch.radiusX * spread;
      const y = patch.y + Math.sin(angle) * patch.radiusY * spread;
      const width = random.between(16, 44);

      graphics.beginPath();
      graphics.moveTo(x - width / 2, y);
      graphics.lineTo(x + width / 2, y);
      graphics.strokePath();
    }
  }

  private static drawForest(
    graphics: Phaser.GameObjects.Graphics,
    patch: TerrainPatch,
    index: number,
  ): void {
    const random = new Phaser.Math.RandomDataGenerator(['forest', String(index)]);
    const area = Math.PI * patch.radiusX * patch.radiusY;
    const treeCount = Math.round(area / 850);

    graphics.fillStyle(0x22391b, 0.92);
    graphics.fillEllipse(patch.x, patch.y, patch.radiusX * 2, patch.radiusY * 2);

    for (let tree = 0; tree < treeCount; tree += 1) {
      const angle = random.rotation();
      const spread = Math.sqrt(random.frac()) * 0.94;
      const x = patch.x + Math.cos(angle) * patch.radiusX * spread;
      const y = patch.y + Math.sin(angle) * patch.radiusY * spread;
      const size = random.between(11, 17);

      graphics.fillStyle(0x0d1f0c, 0.4);
      graphics.fillEllipse(x + 3, y + 5, size * 1.7, size * 1.15);

      graphics.fillStyle(random.pick([0x2c5626, 0x336428, 0x264c1f]), 0.96);
      graphics.fillCircle(x, y, size);

      graphics.fillStyle(0x4f8f3d, 0.45);
      graphics.fillCircle(x - size * 0.26, y - size * 0.3, size * 0.5);
    }
  }
}
