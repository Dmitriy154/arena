import Phaser from 'phaser';
import { FONT_FAMILY, UNIT_SIZE } from '../constants';
import type { Terrain } from '../systems/Terrain';
import type { FactionDefinition, UnitStats, UnitTypeDefinition } from '../types';

const HIT_SIZE = UNIT_SIZE + 8;
const TYPE_STRIPE_WIDTH = UNIT_SIZE - 14;
const TYPE_STRIPE_HEIGHT = 4;

export class Unit extends Phaser.GameObjects.Container {
  readonly unitType: UnitTypeDefinition;
  readonly faction: FactionDefinition;
  readonly maxHp: number;

  hp: number;

  private readonly selectionFrame: Phaser.GameObjects.Rectangle;
  private readonly hoverFrame: Phaser.GameObjects.Rectangle;
  private readonly path: Phaser.Math.Vector2[] = [];
  private selected = false;
  private hovered = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    unitType: UnitTypeDefinition,
    faction: FactionDefinition,
  ) {
    super(scene, x, y);

    this.unitType = unitType;
    this.faction = faction;
    this.maxHp = unitType.stats.hp;
    this.hp = unitType.stats.hp;

    const shadow = scene.add.rectangle(3, 4, UNIT_SIZE, UNIT_SIZE, 0x000000, 0.28);

    const body = scene.add.rectangle(0, 0, UNIT_SIZE, UNIT_SIZE, faction.color, 1);
    body.setStrokeStyle(2, faction.stroke, 0.9);

    const typeStripe = scene.add
      .rectangle(0, -UNIT_SIZE / 2 + 6, TYPE_STRIPE_WIDTH, TYPE_STRIPE_HEIGHT, unitType.color, 0.95)
      .setOrigin(0.5);

    this.hoverFrame = scene.add
      .rectangle(0, 0, UNIT_SIZE + 10, UNIT_SIZE + 10, 0x000000, 0)
      .setStrokeStyle(2, 0xa8f0c6, 0.55)
      .setVisible(false);

    this.selectionFrame = scene.add
      .rectangle(0, 0, UNIT_SIZE + 14, UNIT_SIZE + 14, 0xffffff, 0.06)
      .setStrokeStyle(2, 0xffffff, 0.95)
      .setVisible(false);

    const label = scene.add
      .text(0, 2, unitType.label, {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#0b1a10',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    this.add([shadow, body, typeStripe, this.hoverFrame, this.selectionFrame, label]);
    this.setSize(UNIT_SIZE, UNIT_SIZE);

    scene.add.existing(this);
  }

  get stats(): UnitStats {
    return this.unitType.stats;
  }

  get isPlayerControlled(): boolean {
    return this.faction.playable;
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

  /** Приказ на движение по точкам маршрута. */
  moveAlong(points: readonly Phaser.Math.Vector2[]): void {
    this.path.length = 0;

    for (const point of points) {
      this.path.push(new Phaser.Math.Vector2(point.x, point.y));
    }
  }

  stop(): void {
    this.path.length = 0;
  }

  isMoving(): boolean {
    return this.path.length > 0;
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

  update(delta: number, terrain: Terrain): void {
    const target = this.path[0];

    if (!target) {
      return;
    }

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.hypot(dx, dy);

    if (distance < 0.5) {
      this.path.shift();
      return;
    }

    const speed = this.stats.speed * terrain.speedMultiplier(this.x, this.y);
    const step = Math.min((speed * delta) / 1000, distance);
    const nextX = this.x + (dx / distance) * step;
    const nextY = this.y + (dy / distance) * step;

    // Отряд, уже стоящий в непроходимой точке, должен иметь возможность выйти.
    const stuck = !terrain.isPassable(this.x, this.y, this.unitType.id);

    if (!stuck && !terrain.isPassable(nextX, nextY, this.unitType.id)) {
      this.stop();
      return;
    }

    this.setPosition(nextX, nextY);

    if (step >= distance) {
      this.path.shift();
    }
  }
}
