import Phaser from 'phaser';
import {
  COLORS,
  FOG_EXPLORE_STEP,
  FOG_RESOLUTION,
  FOG_SHROUD_ALPHA,
  VISION_BRUSH_SCALES,
  VISION_RADIUS,
  visionBrushKey,
} from '../constants';
import type { Unit } from '../entities/Unit';
import type { Terrain } from './Terrain';

const EXPLORE_STEP_SQUARED = FOG_EXPLORE_STEP * FOG_EXPLORE_STEP;

/**
 * Туман войны двумя слоями в разрешении FOG_RESOLUTION от мира:
 * 1. explored — «уже видели»: чёрная пелена, стирается навсегда там, где прошли свои;
 * 2. shroud — полупрозрачная дымка по текущему обзору, перерисовывается при движении.
 *
 * Оба слоя привязаны к миру, а не к кадру: при панораме пересчитывать нечего,
 * поэтому дымка не может отставать от камеры или дёргаться на её краях.
 *
 * Круги обзора стираются одним пакетом (beginDraw → batchDrawFrame → endDraw):
 * каждый отдельный erase — это полный blit текстуры, и на шесть отрядов он
 * стоил дороже всего кадра.
 *
 * Требует WebGL: стирание идёт через blend mode ERASE.
 */
export class FogOfWar {
  private readonly explored: Phaser.GameObjects.RenderTexture;
  private readonly shroud: Phaser.GameObjects.RenderTexture;
  private readonly lastReveal = new Map<Unit, Phaser.Math.Vector2>();
  private readonly lastBuild: Phaser.Math.Vector2[] = [];
  private readonly players: Unit[] = [];
  private readonly terrain: Terrain;

  private built = false;

  constructor(
    scene: Phaser.Scene,
    layer: Phaser.GameObjects.Container,
    width: number,
    height: number,
    terrain: Terrain,
  ) {
    this.terrain = terrain;

    this.explored = scene.add
      .renderTexture(0, 0, Math.ceil(width * FOG_RESOLUTION), Math.ceil(height * FOG_RESOLUTION))
      .setOrigin(0)
      .setScale(1 / FOG_RESOLUTION);
    this.explored.fill(COLORS.fog, 1);

    this.shroud = scene.add
      .renderTexture(0, 0, Math.ceil(width * FOG_RESOLUTION), Math.ceil(height * FOG_RESOLUTION))
      .setOrigin(0)
      .setScale(1 / FOG_RESOLUTION);

    layer.add([this.explored, this.shroud]);
  }

  update(units: readonly Unit[]): void {
    this.players.length = 0;

    for (const unit of units) {
      if (unit.isPlayerControlled) {
        this.players.push(unit);
      }
    }

    if (this.built && !this.hasMoved()) {
      return;
    }

    // fill сам очищает текстуру при привязке — отдельный clear не нужен.
    this.shroud.fill(COLORS.fog, FOG_SHROUD_ALPHA);
    this.shroud.beginDraw();

    for (const unit of this.players) {
      this.stampBrush(this.shroud, unit.x, unit.y, this.visionRadiusOf(unit));
    }

    this.shroud.endDraw(true);

    this.revealExplored();

    for (const unit of units) {
      if (!unit.isPlayerControlled) {
        unit.setVisible(this.isPointVisible(unit.x, unit.y));
      }
    }

    this.rememberPositions();
    this.built = true;
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

  /** Сдвинулся ли хоть один свой отряд с момента последней перерисовки. */
  private hasMoved(): boolean {
    if (this.lastBuild.length !== this.players.length) {
      return true;
    }

    for (let index = 0; index < this.players.length; index += 1) {
      const unit = this.players[index];
      const last = this.lastBuild[index];

      if (Math.abs(unit.x - last.x) > 1 || Math.abs(unit.y - last.y) > 1) {
        return true;
      }
    }

    return false;
  }

  private rememberPositions(): void {
    this.lastBuild.length = this.players.length;

    for (let index = 0; index < this.players.length; index += 1) {
      const unit = this.players[index];
      const slot = this.lastBuild[index] ?? new Phaser.Math.Vector2();

      slot.set(unit.x, unit.y);
      this.lastBuild[index] = slot;
    }
  }

  /**
   * Постоянное открытие карты: стираем тьму только когда отряд отошёл
   * достаточно далеко, и одним пакетом на всех, кто сдвинулся.
   */
  private revealExplored(): void {
    let pending = false;

    for (const unit of this.players) {
      const last = this.lastReveal.get(unit);

      if (last) {
        if (Phaser.Math.Distance.Squared(last.x, last.y, unit.x, unit.y) < EXPLORE_STEP_SQUARED) {
          continue;
        }

        last.set(unit.x, unit.y);
      } else {
        this.lastReveal.set(unit, new Phaser.Math.Vector2(unit.x, unit.y));
      }

      if (!pending) {
        this.explored.beginDraw();
        pending = true;
      }

      this.stampBrush(this.explored, unit.x, unit.y, this.visionRadiusOf(unit));
    }

    if (pending) {
      this.explored.endDraw(true);
    }
  }

  /** Кисть обзора в пакете: координаты — левый верхний угол, не центр. */
  private stampBrush(
    texture: Phaser.GameObjects.RenderTexture,
    x: number,
    y: number,
    radius: number,
  ): void {
    const brushIndex = this.brushIndexFor(radius);
    const brushRadius = VISION_RADIUS * VISION_BRUSH_SCALES[brushIndex] * FOG_RESOLUTION;

    texture.batchDrawFrame(
      visionBrushKey(brushIndex),
      undefined,
      x * FOG_RESOLUTION - brushRadius,
      y * FOG_RESOLUTION - brushRadius,
    );
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
