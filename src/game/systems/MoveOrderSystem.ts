import Phaser from 'phaser';
import { COLORS, WORLD_HEIGHT, WORLD_MARGIN, WORLD_WIDTH } from '../constants';
import type { Unit } from '../entities/Unit';
import { resolveFormation, resolveRigid, rigidFacing } from './Formation';
import type { Pathfinder } from './Pathfinder';
import type { Terrain } from './Terrain';

/** Приказы на движение: в точку и строем с заданным фронтом. */
export class MoveOrderSystem {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Container,
    private readonly terrain: Terrain,
    private readonly pathfinder: Pathfinder,
  ) {}

  /**
   * ПКМ-клик: строй переносится как есть — каждый отряд сохраняет своё место
   * относительно центра, поэтому готовое построение не перемешивается.
   * Если задан вектор, блок разворачивается фронтом по нему.
   */
  issueToPoint(
    units: readonly Unit[],
    target: Phaser.Math.Vector2,
    facing: Phaser.Math.Vector2 | null = null,
  ): void {
    if (units.length === 0) {
      return;
    }

    const safeTarget = new Phaser.Math.Vector2(
      Phaser.Math.Clamp(target.x, WORLD_MARGIN, WORLD_WIDTH - WORLD_MARGIN),
      Phaser.Math.Clamp(target.y, WORLD_MARGIN, WORLD_HEIGHT - WORLD_MARGIN),
    );

    this.spawnMarker(safeTarget.x, safeTarget.y);

    const angle = rigidFacing(units, facing);

    for (const placement of resolveRigid(units, safeTarget, this.terrain, facing)) {

      placement.unit.assignPost(placement.point, angle, placement.index);

      const path = this.pathfinder.findPath(
        placement.unit.x,
        placement.unit.y,
        placement.point.x,
        placement.point.y,
        placement.unit.unitType.id,
      );

      if (path.length > 0) {
        placement.unit.moveAlong(path, angle);
      } else {
        placement.unit.stop();
      }
    }
  }

  /** Якорь — центр переднего ряда, facing — куда смотрит строй. */
  issueFormation(
    units: readonly Unit[],
    origin: Phaser.Math.Vector2,
    facing: Phaser.Math.Vector2,
    columns?: number,
  ): void {
    if (units.length === 0) {
      return;
    }

    const safeOrigin = new Phaser.Math.Vector2(
      Phaser.Math.Clamp(origin.x, WORLD_MARGIN, WORLD_WIDTH - WORLD_MARGIN),
      Phaser.Math.Clamp(origin.y, WORLD_MARGIN, WORLD_HEIGHT - WORLD_MARGIN),
    );

    this.spawnMarker(safeOrigin.x, safeOrigin.y);

    const angle = Math.atan2(facing.y, facing.x);

    for (const placement of resolveFormation(units, safeOrigin, facing, this.terrain, columns)) {
      placement.unit.assignPost(placement.point, angle, placement.index);

      const path = this.pathfinder.findPath(
        placement.unit.x,
        placement.unit.y,
        placement.point.x,
        placement.point.y,
        placement.unit.unitType.id,
      );

      if (path.length > 0) {
        placement.unit.moveAlong(path, angle);
      } else {
        placement.unit.stop();
      }
    }
  }

  private spawnMarker(x: number, y: number): void {
    const marker = this.scene.add
      .circle(x, y, 12, COLORS.accent, 0.12)
      .setStrokeStyle(2, COLORS.accent, 0.9);

    this.layer.add(marker);

    this.scene.tweens.add({
      targets: marker,
      scale: 2.2,
      alpha: 0,
      duration: 450,
      ease: 'Cubic.easeOut',
      onComplete: () => marker.destroy(),
    });
  }
}
