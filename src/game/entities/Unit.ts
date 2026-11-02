import Phaser from 'phaser';
import { FONT_FAMILY, UNIT_SIZE } from '../constants';
import type { UnitTypeDefinition } from '../types';

const HIT_SIZE = UNIT_SIZE + 8;

export class Unit extends Phaser.GameObjects.Container {
  readonly unitType: UnitTypeDefinition;

  private readonly selectionFrame: Phaser.GameObjects.Rectangle;
  private readonly hoverFrame: Phaser.GameObjects.Rectangle;
  private readonly destination = new Phaser.Math.Vector2();
  private moving = false;
  private selected = false;
  private hovered = false;

  constructor(scene: Phaser.Scene, x: number, y: number, unitType: UnitTypeDefinition) {
    super(scene, x, y);

    this.unitType = unitType;

    const shadow = scene.add.rectangle(3, 4, UNIT_SIZE, UNIT_SIZE, 0x000000, 0.28);

    const body = scene.add.rectangle(0, 0, UNIT_SIZE, UNIT_SIZE, unitType.color, 1);
    body.setStrokeStyle(2, 0x0c1510, 0.85);

    this.hoverFrame = scene.add
      .rectangle(0, 0, UNIT_SIZE + 10, UNIT_SIZE + 10, 0x000000, 0)
      .setStrokeStyle(2, 0xa8f0c6, 0.55)
      .setVisible(false);

    this.selectionFrame = scene.add
      .rectangle(0, 0, UNIT_SIZE + 14, UNIT_SIZE + 14, 0xffffff, 0.06)
      .setStrokeStyle(2, 0xffffff, 0.95)
      .setVisible(false);

    const label = scene.add
      .text(0, 1, unitType.label, {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#0b1a10',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    this.add([shadow, body, this.hoverFrame, this.selectionFrame, label]);
    this.setSize(UNIT_SIZE, UNIT_SIZE);

    scene.add.existing(this);
  }

  setSelected(selected: boolean): void {
    this.selected = selected;
    this.refreshFrames();
  }

  setHovered(hovered: boolean): void {
    this.hovered = hovered;
    this.refreshFrames();
  }

  private refreshFrames(): void {
    this.selectionFrame.setVisible(this.selected);
    this.hoverFrame.setVisible(this.hovered && !this.selected);
  }

  moveToPosition(x: number, y: number): void {
    this.destination.set(x, y);
    this.moving = true;
  }

  stop(): void {
    this.moving = false;
  }

  isMoving(): boolean {
    return this.moving;
  }

  containsPoint(worldX: number, worldY: number): boolean {
    const half = HIT_SIZE / 2;
    return (
      worldX >= this.x - half &&
      worldX <= this.x + half &&
      worldY >= this.y - half &&
      worldY <= this.y + half
    );
  }

  getBounds(): Phaser.Geom.Rectangle {
    const half = HIT_SIZE / 2;
    return new Phaser.Geom.Rectangle(this.x - half, this.y - half, HIT_SIZE, HIT_SIZE);
  }

  update(delta: number): void {
    if (!this.moving) {
      return;
    }

    const dx = this.destination.x - this.x;
    const dy = this.destination.y - this.y;
    const distance = Math.hypot(dx, dy);
    const step = (this.unitType.speed * delta) / 1000;

    if (distance <= step || distance === 0) {
      this.setPosition(this.destination.x, this.destination.y);
      this.moving = false;
      return;
    }

    this.x += (dx / distance) * step;
    this.y += (dy / distance) * step;
  }
}
