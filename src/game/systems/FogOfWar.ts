import Phaser from 'phaser';
import {
  COLORS,
  FOG_EXPLORE_STEP,
  FOG_SHROUD_ALPHA,
  VISION_BRUSH_SCALES,
  VISION_RADIUS,
  visionBrushKey,
} from '../constants';
import type { Unit } from '../entities/Unit';
import type { Terrain } from './Terrain';

const EXPLORE_STEP_SQUARED = FOG_EXPLORE_STEP * FOG_EXPLORE_STEP;

/**
 * Два слоя тумана поверх мира:
 * 1. unexplored — сплошная тьма, стирается навсегда там, где уже были свои отряды;
 * 2. shroud — полупрозрачная дымка, перерисовывается каждый кадр по текущему обзору.
 * Отряды противника вне текущего обзора просто скрываются.
 *
 * Требует WebGL: стирание идёт через blend mode ERASE.
 */
export class FogOfWar {
  private readonly unexplored: Phaser.GameObjects.RenderTexture;
  private readonly shroud: Phaser.GameObjects.RenderTexture;
  private readonly lastReveal = new Map<Unit, Phaser.Math.Vector2>();
  private readonly players: Unit[] = [];
  private readonly terrain: Terrain;

  constructor(
    scene: Phaser.Scene,
    layer: Phaser.GameObjects.Container,
    width: number,
    height: number,
    terrain: Terrain,
  ) {
    this.terrain = terrain;

    this.unexplored = scene.add.renderTexture(0, 0, width, height).setOrigin(0);
    this.unexplored.fill(COLORS.fog, 1);

    this.shroud = scene.add.renderTexture(0, 0, width, height).setOrigin(0);

    layer.add([this.unexplored, this.shroud]);
  }

  update(units: readonly Unit[]): void {
    this.players.length = 0;

    for (const unit of units) {
      if (unit.isPlayerControlled) {
        this.players.push(unit);
      }
    }

    this.shroud.clear();
    this.shroud.fill(COLORS.fog, FOG_SHROUD_ALPHA);

    for (const unit of this.players) {
      const radius = this.visionRadiusOf(unit);
      this.eraseCircle(this.shroud, unit.x, unit.y, radius);
      this.reveal(unit, radius);
    }

    for (const unit of units) {
      if (!unit.isPlayerControlled) {
        unit.setVisible(this.isPointVisible(unit.x, unit.y));
      }
    }
  }

  /** Обзор отряда с учётом того, насколько глубоко он стоит в лесу. */
  private visionRadiusOf(unit: Unit): number {
    return VISION_RADIUS * this.terrain.visionMultiplier(unit.x, unit.y);
  }

  isPointVisible(x: number, y: number): boolean {
    for (const unit of this.players) {
      // В лесу цель замечают только вблизи.
      const radius = this.terrain.concealmentRadius(this.visionRadiusOf(unit), x, y);

      if (Phaser.Math.Distance.Squared(unit.x, unit.y, x, y) > radius * radius) {
        continue;
      }

      // Лес перекрывает луч: цель за чащей не видна, даже если она в радиусе.
      if (this.terrain.blocksSight(unit.x, unit.y, x, y)) {
        continue;
      }

      return true;
    }

    return false;
  }

  /** Постоянное открытие карты: стираем тьму только когда отряд отошёл достаточно далеко. */
  private reveal(unit: Unit, radius: number): void {
    const last = this.lastReveal.get(unit);

    if (last) {
      if (Phaser.Math.Distance.Squared(last.x, last.y, unit.x, unit.y) < EXPLORE_STEP_SQUARED) {
        return;
      }

      last.set(unit.x, unit.y);
    } else {
      this.lastReveal.set(unit, new Phaser.Math.Vector2(unit.x, unit.y));
    }

    this.eraseCircle(this.unexplored, unit.x, unit.y, radius);
  }

  private eraseCircle(
    target: Phaser.GameObjects.RenderTexture,
    x: number,
    y: number,
    radius: number,
  ): void {
    const brushIndex = this.brushIndexFor(radius);
    const brushRadius = VISION_RADIUS * VISION_BRUSH_SCALES[brushIndex];

    // Для текстуры координаты draw/erase — левый верхний угол, а не центр.
    target.erase(visionBrushKey(brushIndex), x - brushRadius, y - brushRadius);
  }

  /** Ближайшая по масштабу кисть: обзор в чаще меньше, круг тумана тоже. */
  private brushIndexFor(radius: number): number {
    const last = VISION_BRUSH_SCALES.length - 1;
    const minScale = VISION_BRUSH_SCALES[last];
    const ratio = Phaser.Math.Clamp(radius / VISION_RADIUS, minScale, 1);
    const position = ((1 - ratio) / (1 - minScale)) * last;

    return Phaser.Math.Clamp(Math.round(position), 0, last);
  }
}
