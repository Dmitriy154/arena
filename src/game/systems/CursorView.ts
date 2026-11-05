import Phaser from 'phaser';
import { COLORS, EDGE_HINT_MARGIN, VIEW_HEIGHT, VIEW_WIDTH } from '../constants';

/** Что сейчас делает игрок — от этого зависят украшения вокруг стрелки. */
export type CursorState = 'default' | 'hover' | 'box' | 'order' | 'rigid';

const WOOD_FILL = 0xc08a55;
const WOOD_EDGE = 0x4a2f18;
const WOOD_HIGHLIGHT = 0xf0c99c;
const WOOD_GRAIN = 0x8f5f33;
/** Общий масштаб стрелки: на экране она должна читаться, но не закрывать отряды. */
const ARROW_SCALE = 1.35;
const PULSE_SPEED = 0.006;

/** Классическая стрелка остриём в (0, 0), вниз-вправо хвост. */
const ARROW: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0, 17],
  [4.1, 12.9],
  [7.1, 19.6],
  [9.9, 18.4],
  [6.8, 11.8],
  [12.6, 11.8],
];

/** Центр «тела» стрелки — вокруг него рисуются кольца режимов. */
const BODY_X = 6;
const BODY_Y = 10;

/**
 * Свой курсор вместо системного: деревянная стрелка, а вокруг неё —
 * индикаторы режима и подсказка «камера поедет к краю».
 */
export class CursorView {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private shown = false;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Container) {
    this.graphics = scene.add.graphics();
    layer.add(this.graphics);
  }

  /** progress: 0..1 — насколько протяжка доросла до минимальной. */
  update(x: number, y: number, state: CursorState, progress: number, time: number): void {
    const graphics = this.graphics;

    if (!this.shown) {
      this.shown = true;
      graphics.setVisible(true);
    }

    const edge = this.edgeDirection(x, y);
    const nearEdge = edge.x !== 0 || edge.y !== 0;

    graphics.setPosition(x, y);
    graphics.setScale(ARROW_SCALE * (nearEdge ? 1.12 : 1));
    graphics.clear();

    this.drawArrow();

    if (state === 'hover') {
      this.drawHover(time);
    } else if (state === 'box') {
      this.drawBox();
    } else if (state === 'order') {
      this.drawOrder(progress, time);
    } else if (state === 'rigid') {
      this.drawRigid();
    }

    if (nearEdge) {
      this.drawEdgeHints(edge, time);
    }
  }

  hide(): void {
    if (!this.shown) {
      return;
    }

    this.shown = false;
    this.graphics.clear();
    this.graphics.setVisible(false);
  }

  /** -1 / 0 / 1 по каждой оси: к какому краю прижался курсор. */
  private edgeDirection(x: number, y: number): { x: number; y: number } {
    const horizontal = x <= EDGE_HINT_MARGIN ? -1 : x >= VIEW_WIDTH - EDGE_HINT_MARGIN ? 1 : 0;
    const vertical = y <= EDGE_HINT_MARGIN ? -1 : y >= VIEW_HEIGHT - EDGE_HINT_MARGIN ? 1 : 0;

    return { x: horizontal, y: vertical };
  }

  private drawArrow(): void {
    const graphics = this.graphics;
    const points = ARROW.map(([px, py]) => new Phaser.Math.Vector2(px, py));

    graphics.fillStyle(WOOD_FILL, 1);
    graphics.fillPoints(points, true);

    graphics.lineStyle(1.4, WOOD_EDGE, 0.95);
    graphics.strokePoints(points, true);

    // Светлая кромка слева — объём «дерева».
    graphics.lineStyle(1, WOOD_HIGHLIGHT, 0.6);
    graphics.lineBetween(1.3, 2.6, 1.3, 13.6);
    graphics.lineBetween(5.2, 13.4, 8.4, 16.6);

    // Пара штрихов-волокон: без них заливка выглядит пластиковой.
    graphics.lineStyle(0.8, WOOD_GRAIN, 0.45);
    graphics.lineBetween(3, 4.5, 3, 10.5);
    graphics.lineBetween(4.8, 6.8, 4.8, 10.2);
    graphics.lineBetween(8.2, 14.2, 9.2, 17.2);
  }

  /** Над своим отрядом: кольцо акцента с пульсацией. */
  private drawHover(time: number): void {
    const graphics = this.graphics;
    const radius = 15 * (1 + Math.sin(time * PULSE_SPEED) * 0.08);

    graphics.lineStyle(2, COLORS.accent, 0.9);
    graphics.strokeCircle(BODY_X, BODY_Y, radius);

    graphics.lineStyle(2, COLORS.accent, 0.6);

    for (let index = 0; index < 4; index += 1) {
      const angle = (Math.PI / 2) * index;
      const inner = radius + 3;
      const outer = radius + 6;

      graphics.lineBetween(
        BODY_X + Math.cos(angle) * inner,
        BODY_Y + Math.sin(angle) * inner,
        BODY_X + Math.cos(angle) * outer,
        BODY_Y + Math.sin(angle) * outer,
      );
    }
  }

  private drawBox(): void {
    const graphics = this.graphics;

    graphics.lineStyle(1.5, COLORS.accent, 0.85);
    graphics.strokeCircle(BODY_X, BODY_Y, 13);
    graphics.lineBetween(BODY_X - 18, BODY_Y, BODY_X - 13, BODY_Y);
    graphics.lineBetween(BODY_X + 13, BODY_Y, BODY_X + 18, BODY_Y);
    graphics.lineBetween(BODY_X, BODY_Y - 18, BODY_X, BODY_Y - 13);
    graphics.lineBetween(BODY_X, BODY_Y + 13, BODY_X, BODY_Y + 18);
  }

  /** Короткий вектор: строй просто переедет, круг спокойный и голубой. */
  private drawRigid(): void {
    const graphics = this.graphics;

    graphics.fillStyle(COLORS.rigid, 0.14);
    graphics.fillCircle(BODY_X, BODY_Y, 12);
    graphics.lineStyle(2, COLORS.rigid, 0.9);
    graphics.strokeCircle(BODY_X, BODY_Y, 12);
  }

  /** Перестроение: круг растёт с числом рядов, которые набегают. */
  private drawOrder(progress: number, time: number): void {
    const graphics = this.graphics;
    const grow = Math.min(progress, 3);
    const radius = (11 + grow * 6) * (1 + Math.sin(time * PULSE_SPEED) * 0.04);

    graphics.fillStyle(COLORS.accent, 0.16);
    graphics.fillCircle(BODY_X, BODY_Y, radius);
    graphics.lineStyle(2, COLORS.accent, 0.95);
    graphics.strokeCircle(BODY_X, BODY_Y, radius);
  }

  /** У края экрана: шевроны в сторону, куда поедет камера. */
  private drawEdgeHints(edge: { x: number; y: number }, time: number): void {
    const graphics = this.graphics;
    const alpha = 0.55 + Math.sin(time * PULSE_SPEED * 1.6) * 0.3;

    graphics.lineStyle(2, COLORS.accent, alpha);

    if (edge.x !== 0) {
      this.chevron(edge.x < 0 ? -9 : 21, BODY_Y, edge.x, 0);
    }

    if (edge.y !== 0) {
      this.chevron(BODY_X, edge.y < 0 ? -9 : 29, 0, edge.y);
    }
  }

  /** Двойной шеврон остриём в (dx, dy). */
  private chevron(x: number, y: number, dx: number, dy: number): void {
    const graphics = this.graphics;
    const size = 5;
    const perpendicularX = -dy;
    const perpendicularY = dx;

    for (let step = 0; step < 2; step += 1) {
      const tipX = x + dx * step * 6;
      const tipY = y + dy * step * 6;
      const backX = tipX - dx * size;
      const backY = tipY - dy * size;

      graphics.lineBetween(
        backX + perpendicularX * size,
        backY + perpendicularY * size,
        tipX,
        tipY,
      );
      graphics.lineBetween(
        tipX,
        tipY,
        backX - perpendicularX * size,
        backY - perpendicularY * size,
      );
    }
  }
}
