import Phaser from 'phaser';
import {
  FORMATION_SPACING,
  UNIT_SIZE,
  WORLD_HEIGHT,
  WORLD_MARGIN,
  WORLD_WIDTH,
} from '../constants';
import type { Unit } from '../entities/Unit';
import type { Terrain } from './Terrain';

const EPSILON = 1e-6;
const DEFAULT_FACING = new Phaser.Math.Vector2(0, 1);

export interface FormationPlacement {
  readonly unit: Unit;
  readonly point: Phaser.Math.Vector2;
  readonly snapped: boolean;
  /** Место в строю по порядку чтения: ряд за рядом, слева направо. */
  readonly index: number;
}

/** Единичное направление от якоря к точке; null, если точки совпали. */
export function directionFrom(
  origin: Phaser.Math.Vector2,
  point: Phaser.Math.Vector2,
): Phaser.Math.Vector2 | null {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const length = Math.hypot(dx, dy);

  if (length < EPSILON) {
    return null;
  }

  return new Phaser.Math.Vector2(dx / length, dy / length);
}

/** Фронт строя для приказа в точку: от центроида отрядов к цели. */
export function facingFromCentroid(
  units: readonly { readonly x: number; readonly y: number }[],
  target: Phaser.Math.Vector2,
): Phaser.Math.Vector2 {
  if (units.length === 0) {
    return DEFAULT_FACING.clone();
  }

  let sumX = 0;
  let sumY = 0;

  for (const unit of units) {
    sumX += unit.x;
    sumY += unit.y;
  }

  const centroid = new Phaser.Math.Vector2(sumX / units.length, sumY / units.length);

  return directionFrom(centroid, target) ?? DEFAULT_FACING.clone();
}

function normalizeFacing(facing: Phaser.Math.Vector2): Phaser.Math.Vector2 {
  return facing.lengthSq() < EPSILON ? DEFAULT_FACING.clone() : facing.clone().normalize();
}

/** Поперечные смещения в шагах: 0, +1, -1, +2, -2, ... */
function crossOffset(index: number): number {
  if (index === 0) {
    return 0;
  }

  if (index % 2 === 1) {
    return (index + 1) / 2;
  }

  return -(index / 2);
}

function clampToWorld(x: number, y: number): Phaser.Math.Vector2 {
  return new Phaser.Math.Vector2(
    Phaser.Math.Clamp(x, WORLD_MARGIN, WORLD_WIDTH - WORLD_MARGIN),
    Phaser.Math.Clamp(y, WORLD_MARGIN, WORLD_HEIGHT - WORLD_MARGIN),
  );
}

/**
 * Ширина строя по умолчанию: шеренги примерно равны друг другу.
 * 5 отрядов — 3 + 2, 6 — 3 + 3, 10 — 4 + 3 + 3, 12 — 4 + 4 + 4.
 */
export function balancedColumns(count: number): number {
  if (count <= 1) {
    return Math.max(count, 0);
  }

  const rows = Math.max(1, Math.round(Math.sqrt(count)));

  return Math.ceil(count / rows);
}

/**
 * Ширина, нарисованная протяжкой: длина линии — это глубина строя.
 * Короткий вектор даёт одну широкую шеренгу, длинный — колонну:
 * каждые `FORMATION_SPACING` px протяжки добавляют ряд.
 */
export function columnsForDrag(count: number, dragLength: number): number {
  if (count <= 1) {
    return Math.max(count, 0);
  }

  const rows = Phaser.Math.Clamp(1 + Math.floor(dragLength / FORMATION_SPACING), 1, count);

  return Math.ceil(count / rows);
}

/** Сколько отрядов в каждом ряду: остаток размазывается по передним рядам. */
function rowSizes(count: number, columns: number): number[] {
  const rows = Math.ceil(count / columns);
  const base = Math.floor(count / rows);
  const remainder = count - base * rows;
  const sizes: number[] = [];

  for (let row = 0; row < rows; row += 1) {
    sizes.push(base + (row < remainder ? 1 : 0));
  }

  return sizes;
}

/**
 * Точки строя: ряд 0 — на якоре, остальные уходят назад вдоль -facing.
 * Чётный ряд сдвигается на полшага, чтобы стоять симметрично.
 */
export function buildFormationSlots(
  count: number,
  origin: Phaser.Math.Vector2,
  facing: Phaser.Math.Vector2,
  columns = balancedColumns(count),
): Phaser.Math.Vector2[] {
  const slots: Phaser.Math.Vector2[] = [];

  if (count <= 0) {
    return slots;
  }

  const direction = normalizeFacing(facing);
  const right = new Phaser.Math.Vector2(-direction.y, direction.x);
  const width = Phaser.Math.Clamp(columns, 1, count);
  const sizes = rowSizes(count, width);

  sizes.forEach((inRow, row) => {
    const shift = inRow % 2 === 0 ? -0.5 : 0;
    const depth = row * FORMATION_SPACING;

    for (let index = 0; index < inRow; index += 1) {
      const lateral = (shift + crossOffset(index)) * FORMATION_SPACING;

      slots.push(
        clampToWorld(
          origin.x + right.x * lateral - direction.x * depth,
          origin.y + right.y * lateral - direction.y * depth,
        ),
      );
    }
  });

  return slots;
}

interface RowUnit {
  readonly unit: Unit;
  readonly lateral: number;
  readonly depth: number;
}

/** Порядок чтения строя: ряд за рядом от фронта, внутри ряда слева направо. */
function readingOrder(
  slots: readonly Phaser.Math.Vector2[],
  origin: Phaser.Math.Vector2,
  facing: Phaser.Math.Vector2,
): Phaser.Math.Vector2[] {
  const direction = normalizeFacing(facing);
  const right = new Phaser.Math.Vector2(-direction.y, direction.x);
  const lateralOf = (point: { readonly x: number; readonly y: number }): number =>
    (point.x - origin.x) * right.x + (point.y - origin.y) * right.y;
  const depthOf = (point: { readonly x: number; readonly y: number }): number =>
    (point.x - origin.x) * direction.x + (point.y - origin.y) * direction.y;

  return [...slots].sort((first, second) => {
    const delta = depthOf(second) - depthOf(first);

    // Ряды разнесены на шаг строя, внутри ряда глубина одинаковая.
    if (Math.abs(delta) > 1) {
      return delta;
    }

    return lateralOf(first) - lateralOf(second);
  });
}

/**
 * Раздача мест построчно: отряды сортируются по глубине, передние забирают
 * передний ряд, а внутри ряда — по поперечной оси. Поэтому копейщики,
 * стоявшие впереди, остаются впереди, стрелки — сзади, конница — на флангах.
 *
 * Если у всех отрядов уже есть место в строю, порядок сохраняется как был:
 * обычный приказ без протяжки не перемешивает готовый строй.
 */
function assignSlots(
  units: readonly Unit[],
  slots: readonly Phaser.Math.Vector2[],
  origin: Phaser.Math.Vector2,
  facing: Phaser.Math.Vector2,
  columns: number,
): Array<{ unit: Unit; slot: Phaser.Math.Vector2; index: number }> {
  const direction = normalizeFacing(facing);
  const right = new Phaser.Math.Vector2(-direction.y, direction.x);
  const lateralOf = (point: { readonly x: number; readonly y: number }): number =>
    (point.x - origin.x) * right.x + (point.y - origin.y) * right.y;
  const depthOf = (point: { readonly x: number; readonly y: number }): number =>
    (point.x - origin.x) * direction.x + (point.y - origin.y) * direction.y;

  const known = units.every((unit) => unit.postIndex >= 0);

  if (known) {
    const kept = [...units].sort(
      (first, second) => first.postIndex - second.postIndex || lateralOf(first) - lateralOf(second),
    );

    return kept.map((unit, index) => ({ unit, slot: slots[index], index }));
  }

  const ordered: RowUnit[] = units
    .map((unit) => ({ unit, lateral: lateralOf(unit), depth: depthOf(unit) }))
    .sort((first, second) => second.depth - first.depth || first.lateral - second.lateral);

  const sizes = rowSizes(units.length, columns);
  const pairs: Array<{ unit: Unit; slot: Phaser.Math.Vector2; index: number }> = [];
  let unitIndex = 0;
  let slotIndex = 0;

  for (const size of sizes) {
    const rowSlots = slots.slice(slotIndex, slotIndex + size);
    const rowUnits = ordered.slice(unitIndex, unitIndex + size);

    rowSlots.sort((first, second) => lateralOf(first) - lateralOf(second));
    rowUnits.sort((first, second) => first.lateral - second.lateral);

    rowSlots.forEach((slot, index) => {
      const rowUnit = rowUnits[index];

      if (rowUnit) {
        pairs.push({ unit: rowUnit.unit, slot, index: slotIndex + index });
      }
    });

    unitIndex += size;
    slotIndex += size;
  }

  return pairs;
}

/** Слоты + раздача отрядам, с переносом непроходимых точек на ближайшие. */
export function resolveFormation(
  units: readonly Unit[],
  origin: Phaser.Math.Vector2,
  facing: Phaser.Math.Vector2,
  terrain: Terrain,
  columns = balancedColumns(units.length),
): FormationPlacement[] {
  const slots = readingOrder(
    buildFormationSlots(units.length, origin, facing, columns),
    origin,
    facing,
  );
  const taken: Phaser.Math.Vector2[] = [];
  const placements: FormationPlacement[] = [];

  for (const pair of assignSlots(units, slots, origin, facing, columns)) {
    // Слот в воде или в лесу для конницы переносится на ближайшую проходимую
    // точку, иначе отряд встаёт на краю препятствия и не доходит до строя.
    const point =
      terrain.nearestPassablePoint(pair.slot.x, pair.slot.y, pair.unit.unitType.id, taken) ??
      pair.slot.clone();

    taken.push(point);
    placements.push({
      unit: pair.unit,
      point,
      snapped: !point.equals(pair.slot),
      index: pair.index,
    });
  }

  return placements;
}

function centroidOf(units: readonly { readonly x: number; readonly y: number }[]): Phaser.Math.Vector2 {
  if (units.length === 0) {
    return new Phaser.Math.Vector2();
  }

  let sumX = 0;
  let sumY = 0;

  for (const unit of units) {
    sumX += unit.x;
    sumY += unit.y;
  }

  return new Phaser.Math.Vector2(sumX / units.length, sumY / units.length);
}

/**
 * Насколько повернуть строй: вектор задаёт новое направление фронта.
 * Без вектора (обычный клик) строй остаётся как стоял.
 */
function rigidRotation(
  units: readonly { readonly facing?: number }[],
  facing: Phaser.Math.Vector2 | null,
): number {
  if (!facing) {
    return 0;
  }

  const current = units[0]?.facing ?? 0;

  return Phaser.Math.Angle.Wrap(Math.atan2(facing.y, facing.x) - current);
}

/** Итоговый угол фронта после переноса: текущий фронт плюс поворот по вектору. */
export function rigidFacing(
  units: readonly { readonly facing?: number }[],
  facing: Phaser.Math.Vector2 | null,
): number {
  return (units[0]?.facing ?? 0) + rigidRotation(units, facing);
}

function rotateOffset(
  dx: number,
  dy: number,
  delta: number,
): { readonly x: number; readonly y: number } {
  if (delta === 0) {
    return { x: dx, y: dy };
  }

  const cos = Math.cos(delta);
  const sin = Math.sin(delta);

  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

/**
 * Перенос строя как есть: каждый отряд сохраняет своё смещение от центра,
 * поэтому строй переезжает целиком, не перестраиваясь. Если задан вектор,
 * блок ещё и разворачивается на его направление.
 */
export function resolveRigid(
  units: readonly Unit[],
  target: Phaser.Math.Vector2,
  terrain: Terrain,
  facing: Phaser.Math.Vector2 | null = null,
): FormationPlacement[] {
  const centroid = centroidOf(units);
  const delta = rigidRotation(units, facing);
  const taken: Phaser.Math.Vector2[] = [];
  const placements: FormationPlacement[] = [];

  units.forEach((unit, index) => {
    const offset = rotateOffset(unit.x - centroid.x, unit.y - centroid.y, delta);
    const desired = clampToWorld(target.x + offset.x, target.y + offset.y);
    const point =
      terrain.nearestPassablePoint(desired.x, desired.y, unit.unitType.id, taken) ?? desired;

    taken.push(point);
    placements.push({
      unit,
      point,
      snapped: !point.equals(desired),
      index: unit.postIndex >= 0 ? unit.postIndex : index,
    });
  });

  return placements;
}

/** Куда встанут отряды при переносе как есть — для призрака. */
export function rigidGhost(
  units: readonly Unit[],
  target: Phaser.Math.Vector2,
  facing: Phaser.Math.Vector2 | null = null,
): Phaser.Math.Vector2[] {
  const centroid = centroidOf(units);
  const delta = rigidRotation(units, facing);

  return units.map((unit) => {
    const offset = rotateOffset(unit.x - centroid.x, unit.y - centroid.y, delta);

    return clampToWorld(target.x + offset.x, target.y + offset.y);
  });
}

/** Четыре угла габарита строя в мировых координатах: фронт — первые два. */
export function previewQuad(
  slots: readonly Phaser.Math.Vector2[],
  origin: Phaser.Math.Vector2,
  facing: Phaser.Math.Vector2,
): Phaser.Math.Vector2[] {
  if (slots.length === 0) {
    return [];
  }

  const direction = normalizeFacing(facing);
  const right = new Phaser.Math.Vector2(-direction.y, direction.x);

  let minLateral = Number.POSITIVE_INFINITY;
  let maxLateral = Number.NEGATIVE_INFINITY;
  let minDepth = Number.POSITIVE_INFINITY;
  let maxDepth = Number.NEGATIVE_INFINITY;

  for (const slot of slots) {
    const lateral = (slot.x - origin.x) * right.x + (slot.y - origin.y) * right.y;
    const depth = (slot.x - origin.x) * direction.x + (slot.y - origin.y) * direction.y;

    minLateral = Math.min(minLateral, lateral);
    maxLateral = Math.max(maxLateral, lateral);
    minDepth = Math.min(minDepth, depth);
    maxDepth = Math.max(maxDepth, depth);
  }

  const half = UNIT_SIZE / 2;
  const corner = (lateral: number, depth: number): Phaser.Math.Vector2 =>
    new Phaser.Math.Vector2(
      origin.x + right.x * lateral + direction.x * depth,
      origin.y + right.y * lateral + direction.y * depth,
    );

  return [
    corner(minLateral - half, maxDepth + half),
    corner(maxLateral + half, maxDepth + half),
    corner(maxLateral + half, minDepth - half),
    corner(minLateral - half, minDepth - half),
  ];
}
