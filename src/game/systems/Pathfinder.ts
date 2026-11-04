import Phaser from 'phaser';
import { PATH_CELL_SIZE } from '../constants';
import type { UnitTypeId } from '../types';
import type { Terrain } from './Terrain';

const DIAGONAL_COST = Math.SQRT2;
const NEIGHBOR_SEARCH_RINGS = 8;

interface PassabilityGrid {
  blocked: Uint8Array;
  /** Цена входа в клетку: 1 для открытой земли, больше для леса. */
  cost: Float32Array;
}

/**
 * A* по сетке проходимости, отдельная сетка на каждый тип отряда
 * (конница не входит в лес, поэтому ей нужна своя карта).
 * Путь сглаживается прямой видимостью, чтобы отряды не шли по «лесенке».
 */
/** Двоичная куча по приоритету: A* достаёт лучший узел за O(log n). */
class MinHeap {
  private readonly nodes: number[] = [];
  private readonly priorities: number[] = [];

  get size(): number {
    return this.nodes.length;
  }

  push(node: number, priority: number): void {
    this.nodes.push(node);
    this.priorities.push(priority);
    this.bubbleUp(this.nodes.length - 1);
  }

  pop(): number {
    const top = this.nodes[0];
    const lastNode = this.nodes.pop() as number;
    const lastPriority = this.priorities.pop() as number;

    if (this.nodes.length > 0) {
      this.nodes[0] = lastNode;
      this.priorities[0] = lastPriority;
      this.sinkDown(0);
    }

    return top;
  }

  private bubbleUp(start: number): void {
    let index = start;

    while (index > 0) {
      const parent = (index - 1) >> 1;

      if (this.priorities[parent] <= this.priorities[index]) {
        return;
      }

      this.swap(parent, index);
      index = parent;
    }
  }

  private sinkDown(start: number): void {
    let index = start;
    const length = this.nodes.length;

    for (;;) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;

      if (left < length && this.priorities[left] < this.priorities[smallest]) {
        smallest = left;
      }

      if (right < length && this.priorities[right] < this.priorities[smallest]) {
        smallest = right;
      }

      if (smallest === index) {
        return;
      }

      this.swap(index, smallest);
      index = smallest;
    }
  }

  private swap(a: number, b: number): void {
    const node = this.nodes[a];
    const priority = this.priorities[a];

    this.nodes[a] = this.nodes[b];
    this.priorities[a] = this.priorities[b];
    this.nodes[b] = node;
    this.priorities[b] = priority;
  }
}

export class Pathfinder {
  private readonly terrain: Terrain;
  private readonly cols: number;
  private readonly rows: number;
  private readonly grids = new Map<UnitTypeId, PassabilityGrid>();

  constructor(terrain: Terrain, width: number, height: number) {
    this.terrain = terrain;
    this.cols = Math.ceil(width / PATH_CELL_SIZE);
    this.rows = Math.ceil(height / PATH_CELL_SIZE);
  }

  /**
   * Возвращает точки маршрута в мировых координатах.
   * Если цель недостижима — путь до ближайшей достижимой к ней точки.
   */
  findPath(
    startX: number,
    startY: number,
    goalX: number,
    goalY: number,
    type: UnitTypeId,
  ): Phaser.Math.Vector2[] {
    const grid = this.gridFor(type);
    const startIndex = this.indexAt(startX, startY);
    const goalIndex = this.indexAt(goalX, goalY);
    const goalBlocked = grid.blocked[goalIndex] === 1;
    const searchGoal = goalBlocked ? this.nearestPassable(goalIndex, grid) : goalIndex;

    if (searchGoal < 0) {
      return [];
    }

    const cells = this.search(startIndex, searchGoal, grid);

    if (cells.length === 0) {
      return [];
    }

    const points = cells.map((index) => this.centerOf(index));

    points[0] = new Phaser.Math.Vector2(startX, startY);

    const last = cells[cells.length - 1];
    if (!goalBlocked && last === goalIndex) {
      points[points.length - 1] = new Phaser.Math.Vector2(goalX, goalY);
    }

    return this.smooth(points, type);
  }

  private gridFor(type: UnitTypeId): PassabilityGrid {
    const cached = this.grids.get(type);

    if (cached) {
      return cached;
    }

    const size = this.cols * this.rows;
    const grid: PassabilityGrid = {
      blocked: new Uint8Array(size),
      cost: new Float32Array(size),
    };

    for (let row = 0; row < this.rows; row += 1) {
      for (let column = 0; column < this.cols; column += 1) {
        const index = row * this.cols + column;
        const x = (column + 0.5) * PATH_CELL_SIZE;
        const y = (row + 0.5) * PATH_CELL_SIZE;

        // Проходимость с габаритом: иначе конница срезает кромку леса корпусом.
        grid.blocked[index] = this.terrain.isAreaPassable(x, y, type) ? 0 : 1;
        grid.cost[index] = this.terrain.moveCost(x, y);
      }
    }

    this.grids.set(type, grid);

    return grid;
  }

  private search(startIndex: number, goalIndex: number, grid: PassabilityGrid): number[] {
    const size = this.cols * this.rows;
    const gScore = new Float32Array(size).fill(Number.POSITIVE_INFINITY);
    const fScore = new Float32Array(size).fill(Number.POSITIVE_INFINITY);
    const cameFrom = new Int32Array(size).fill(-1);
    const closed = new Uint8Array(size);
    // Куча вместо перебора открытого списка: на сетке 96x54 линейный поиск
    // минимума давал сотни миллисекунд на один приказ отряду.
    const open = new MinHeap();

    gScore[startIndex] = 0;
    fScore[startIndex] = this.heuristic(startIndex, goalIndex);
    open.push(startIndex, fScore[startIndex]);

    let bestIndex = startIndex;
    let bestEstimate = fScore[startIndex];

    while (open.size > 0) {
      const current = open.pop();

      if (closed[current]) {
        continue;
      }

      closed[current] = 1;

      if (current === goalIndex) {
        return this.reconstruct(cameFrom, current);
      }

      const estimate = this.heuristic(current, goalIndex);
      if (estimate < bestEstimate) {
        bestEstimate = estimate;
        bestIndex = current;
      }

      const column = current % this.cols;
      const row = Math.floor(current / this.cols);

      for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
        for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
          if (rowOffset === 0 && columnOffset === 0) {
            continue;
          }

          const nextColumn = column + columnOffset;
          const nextRow = row + rowOffset;

          if (
            nextColumn < 0 ||
            nextRow < 0 ||
            nextColumn >= this.cols ||
            nextRow >= this.rows
          ) {
            continue;
          }

          const next = nextRow * this.cols + nextColumn;

          // Стартовая клетка считается проходимой: отряд мог быть зажат в ней.
          if (next !== startIndex && grid.blocked[next]) {
            continue;
          }

          const diagonal = rowOffset !== 0 && columnOffset !== 0;

          if (diagonal) {
            const sideA = row * this.cols + nextColumn;
            const sideB = nextRow * this.cols + column;
            const blockedA = sideA !== startIndex && grid.blocked[sideA] === 1;
            const blockedB = sideB !== startIndex && grid.blocked[sideB] === 1;

            // Срез угла запрещён: иначе отряды проскакивают между двумя препятствиями.
            if (blockedA || blockedB) {
              continue;
            }
          }

          if (closed[next]) {
            continue;
          }

          const stepCost = grid.cost[next] * (diagonal ? DIAGONAL_COST : 1);
          const tentative = gScore[current] + stepCost;

          if (tentative >= gScore[next]) {
            continue;
          }

          cameFrom[next] = current;
          gScore[next] = tentative;
          fScore[next] = tentative + this.heuristic(next, goalIndex);
          open.push(next, fScore[next]);
        }
      }
    }

    // Цель недостижима — идём к ближайшей по эвристике точке.
    return this.reconstruct(cameFrom, bestIndex);
  }

  private reconstruct(cameFrom: Int32Array, endIndex: number): number[] {
    const cells: number[] = [];
    let current = endIndex;

    while (current !== -1) {
      cells.push(current);
      current = cameFrom[current];
    }

    return cells.reverse();
  }

  /** Сглаживание: из текущей точки прыгаем сразу на самый дальний видимый узел. */
  private smooth(
    points: Phaser.Math.Vector2[],
    type: UnitTypeId,
  ): Phaser.Math.Vector2[] {
    if (points.length <= 2) {
      return points;
    }

    const result: Phaser.Math.Vector2[] = [];
    let anchor = 0;

    while (anchor < points.length - 1) {
      let next = points.length - 1;

      while (next > anchor + 1 && !this.hasLineOfSight(points[anchor], points[next], type)) {
        next -= 1;
      }

      result.push(points[next]);
      anchor = next;
    }

    return result;
  }

  private hasLineOfSight(
    from: Phaser.Math.Vector2,
    to: Phaser.Math.Vector2,
    type: UnitTypeId,
  ): boolean {
    const distance = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    const steps = Math.max(1, Math.ceil(distance / (PATH_CELL_SIZE / 2)));

    for (let step = 1; step < steps; step += 1) {
      const ratio = step / steps;
      const x = from.x + (to.x - from.x) * ratio;
      const y = from.y + (to.y - from.y) * ratio;

      if (!this.terrain.isAreaPassable(x, y, type)) {
        return false;
      }

      // Лес не срезаем даже пехотой: иначе сглаживание съедает обход,
      // который выбрал A* по штрафу за лес, и отряд идёт напрямик.
      if (this.terrain.isConcealing(x, y)) {
        return false;
      }
    }

    return true;
  }

  private nearestPassable(index: number, grid: PassabilityGrid): number {
    const column = index % this.cols;
    const row = Math.floor(index / this.cols);

    for (let radius = 1; radius <= NEIGHBOR_SEARCH_RINGS; radius += 1) {
      let best = -1;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (let rowOffset = -radius; rowOffset <= radius; rowOffset += 1) {
        for (let columnOffset = -radius; columnOffset <= radius; columnOffset += 1) {
          if (Math.max(Math.abs(rowOffset), Math.abs(columnOffset)) !== radius) {
            continue;
          }

          const candidateColumn = column + columnOffset;
          const candidateRow = row + rowOffset;

          if (
            candidateColumn < 0 ||
            candidateRow < 0 ||
            candidateColumn >= this.cols ||
            candidateRow >= this.rows
          ) {
            continue;
          }

          const candidate = candidateRow * this.cols + candidateColumn;

          if (grid.blocked[candidate]) {
            continue;
          }

          const distance = columnOffset * columnOffset + rowOffset * rowOffset;

          if (distance < bestDistance) {
            bestDistance = distance;
            best = candidate;
          }
        }
      }

      if (best >= 0) {
        return best;
      }
    }

    return -1;
  }

  private heuristic(from: number, to: number): number {
    const columnDelta = Math.abs((from % this.cols) - (to % this.cols));
    const rowDelta = Math.abs(Math.floor(from / this.cols) - Math.floor(to / this.cols));

    return (
      Math.max(columnDelta, rowDelta) + (DIAGONAL_COST - 1) * Math.min(columnDelta, rowDelta)
    );
  }

  private indexAt(x: number, y: number): number {
    const column = Phaser.Math.Clamp(Math.floor(x / PATH_CELL_SIZE), 0, this.cols - 1);
    const row = Phaser.Math.Clamp(Math.floor(y / PATH_CELL_SIZE), 0, this.rows - 1);

    return row * this.cols + column;
  }

  private centerOf(index: number): Phaser.Math.Vector2 {
    const column = index % this.cols;
    const row = Math.floor(index / this.cols);

    return new Phaser.Math.Vector2(
      (column + 0.5) * PATH_CELL_SIZE,
      (row + 0.5) * PATH_CELL_SIZE,
    );
  }
}
