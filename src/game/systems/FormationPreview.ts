import Phaser from 'phaser';
import {
  COLORS,
  FORMATION_PREVIEW_FILL_ALPHA,
  FORMATION_PREVIEW_LINE_ALPHA,
  FORMATION_PREVIEW_LINE_WIDTH,
  FORMATION_RIGID_DRAG,
  UNIT_SIZE,
} from '../constants';
import type { Unit } from '../entities/Unit';
import {
  buildFormationSlots,
  columnsForDrag,
  directionFrom,
  previewQuad,
  resolveFormation,
  rigidGhost,
} from './Formation';
import type { Terrain } from './Terrain';

const FRONT_EDGE_WIDTH = 2.5;
const SLOT_DOT_RADIUS = 3;
const ANCHOR_RADIUS = 10;

/** Призрак строя: линия протяжки, повёрнутый габарит и точки слотов. */
export class FormationPreview {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private key = '';
  private shown = false;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Container) {
    this.graphics = scene.add.graphics().setVisible(false);
    layer.add(this.graphics);
  }

  update(
    origin: Phaser.Math.Vector2,
    cursor: Phaser.Math.Vector2,
    units: readonly Unit[],
    terrain: Terrain,
    zoom: number,
  ): void {
    const facing = directionFrom(origin, cursor);
    const key = [
      Math.round(origin.x),
      Math.round(origin.y),
      Math.round(cursor.x),
      Math.round(cursor.y),
      units.length,
      Math.round(zoom * 100),
    ].join('|');

    if (this.shown && key === this.key) {
      return;
    }

    this.key = key;
    this.shown = true;
    this.graphics.setVisible(true);
    this.draw(origin, cursor, facing, units, terrain, zoom);
  }

  hide(): void {
    if (!this.shown) {
      return;
    }

    this.shown = false;
    this.key = '';
    this.graphics.clear();
    this.graphics.setVisible(false);
  }

  /** Призрак переноса: те же места, что занимают отряды сейчас. */
  private drawGhost(
    target: Phaser.Math.Vector2,
    units: readonly Unit[],
    scale: number,
    facing: Phaser.Math.Vector2 | null,
  ): void {
    const graphics = this.graphics;
    const half = UNIT_SIZE / 2;

    graphics.fillStyle(COLORS.rigid, 0.14);
    graphics.lineStyle(1.2 * scale, COLORS.rigid, 0.75);

    for (const point of rigidGhost(units, target, facing)) {
      graphics.fillRect(point.x - half, point.y - half, UNIT_SIZE, UNIT_SIZE);
      graphics.strokeRect(point.x - half, point.y - half, UNIT_SIZE, UNIT_SIZE);
    }
  }

  private draw(
    origin: Phaser.Math.Vector2,
    cursor: Phaser.Math.Vector2,
    facing: Phaser.Math.Vector2 | null,
    units: readonly Unit[],
    terrain: Terrain,
    zoom: number,
  ): void {
    const graphics = this.graphics;
    // Толщины делятся на зум, иначе на 0.55 линии волосяные, а на 2.4 — жирные.
    const scale = 1 / zoom;

    graphics.clear();

    const dragLength = Phaser.Math.Distance.Between(origin.x, origin.y, cursor.x, cursor.y);
    // Голубая линия — строй переедет как есть, зелёная — начнёт перестраиваться.
    const rigid = dragLength < FORMATION_RIGID_DRAG;
    const color = rigid ? COLORS.rigid : COLORS.accent;

    graphics.lineStyle(1.5 * scale, color, 0.7);
    graphics.strokeCircle(origin.x, origin.y, ANCHOR_RADIUS * scale);

    graphics.lineStyle(1.5 * scale, color, 0.5);
    graphics.lineBetween(origin.x, origin.y, cursor.x, cursor.y);

    if (rigid) {
      this.drawGhost(origin, units, scale, facing);
      return;
    }

    if (!facing) {
      return;
    }

    const columns = columnsForDrag(units.length, dragLength - FORMATION_RIGID_DRAG);
    const slots = buildFormationSlots(units.length, origin, facing, columns);
    const quad = previewQuad(slots, origin, facing);

    if (quad.length === 4) {
      graphics.fillStyle(COLORS.accent, FORMATION_PREVIEW_FILL_ALPHA);
      graphics.fillPoints(quad, true);
      graphics.lineStyle(
        FORMATION_PREVIEW_LINE_WIDTH * scale,
        COLORS.accent,
        FORMATION_PREVIEW_LINE_ALPHA,
      );
      graphics.strokePoints(quad, true);

      // Передняя кромка толще — видно, куда смотрит строй.
      graphics.lineStyle(FRONT_EDGE_WIDTH * scale, COLORS.accent, 0.95);
      graphics.lineBetween(quad[0].x, quad[0].y, quad[1].x, quad[1].y);
    }

    // Точки — те же, куда реально пойдут отряды: призрак не врёт у воды и леса.
    graphics.fillStyle(COLORS.accent, 0.9);

    for (const placement of resolveFormation(units, origin, facing, terrain, columns)) {
      graphics.fillCircle(placement.point.x, placement.point.y, SLOT_DOT_RADIUS * scale);
    }
  }
}
