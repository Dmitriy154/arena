import Phaser from 'phaser';
import {
  CAMERA_START_ZOOM,
  COLORS,
  DRAG_THRESHOLD,
  FONT_FAMILY,
  FORMATION_SPACING,
  UNIT_SIZE,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  WORLD_HEIGHT,
  WORLD_MARGIN,
  WORLD_WIDTH,
} from '../constants';
import { Unit } from '../entities/Unit';
import { CameraController } from '../systems/CameraController';
import { FogOfWar } from '../systems/FogOfWar';
import { Pathfinder } from '../systems/Pathfinder';
import { Terrain } from '../systems/Terrain';
import { FACTIONS, UNIT_TYPES, type FactionDefinition, type UnitTypeId } from '../types';

const HINT_TEXT =
  'ЛКМ — выбор · Shift — добавить · ПКМ — приказ · колесо — зум · WASD / стрелки — камера · СКМ — панорама · Esc — сброс · M — меню';

const PLAYER_FORMATION: Array<{ type: UnitTypeId; offsetX: number; offsetY: number }> = [
  { type: 'LI', offsetX: -70, offsetY: -60 },
  { type: 'HI', offsetX: 70, offsetY: -60 },
  { type: 'SP', offsetX: -70, offsetY: 60 },
  { type: 'AR', offsetX: 70, offsetY: 60 },
  { type: 'LC', offsetX: -210, offsetY: 0 },
  { type: 'HC', offsetX: 210, offsetY: 0 },
];

const ENEMY_FORMATION: Array<{ type: UnitTypeId; x: number; y: number }> = [
  { type: 'SP', x: 1400, y: 420 },
  { type: 'SP', x: 1400, y: 545 },
  { type: 'HI', x: 1545, y: 470 },
  { type: 'AR', x: 1545, y: 600 },
];

export class BattleScene extends Phaser.Scene {
  private worldLayer!: Phaser.GameObjects.Container;
  private unitsLayer!: Phaser.GameObjects.Container;
  private uiLayer!: Phaser.GameObjects.Container;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private cameraController!: CameraController;
  private fog!: FogOfWar;
  private terrain!: Terrain;
  private pathfinder!: Pathfinder;
  private selectionBox!: Phaser.GameObjects.Graphics;
  private statsText!: Phaser.GameObjects.Text;
  private detailText!: Phaser.GameObjects.Text;
  private zoomText!: Phaser.GameObjects.Text;
  private shiftKey!: Phaser.Input.Keyboard.Key;

  private readonly units: Unit[] = [];
  private readonly selected = new Set<Unit>();
  private readonly hudBounds: Phaser.Geom.Rectangle[] = [];
  private readonly pointerDownScreen = new Phaser.Math.Vector2();
  private dragStart: Phaser.Math.Vector2 | null = null;
  private dragMoved = false;
  private lastZoomPercent = -1;
  private visibleEnemyCount = 0;
  private wasMoving = false;
  private leaving = false;

  constructor() {
    super('BattleScene');
  }

  create(): void {
    this.units.length = 0;
    this.selected.clear();
    this.hudBounds.length = 0;
    this.dragStart = null;
    this.dragMoved = false;
    this.lastZoomPercent = -1;
    this.visibleEnemyCount = 0;
    this.wasMoving = false;
    this.leaving = false;

    const camera = this.cameras.main;
    camera.setBackgroundColor(COLORS.background);
    camera.setZoom(CAMERA_START_ZOOM);
    camera.centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);

    this.worldLayer = this.add.container(0, 0);
    this.buildWorld();

    this.unitsLayer = this.add.container(0, 0);
    this.worldLayer.add(this.unitsLayer);
    this.spawnUnits();

    this.fog = new FogOfWar(this, this.worldLayer, WORLD_WIDTH, WORLD_HEIGHT, this.terrain);

    this.selectionBox = this.add.graphics();
    this.worldLayer.add(this.selectionBox);

    this.buildHud();
    this.setupCameras();

    this.cameraController = new CameraController(this, camera);
    this.setupInput();

    camera.fadeIn(280, 5, 14, 9);
    this.refreshHud();
    this.updateZoomHud();
  }

  update(_time: number, delta: number): void {
    if (this.leaving) {
      return;
    }

    this.cameraController.update(delta);

    let anyMoving = false;
    for (const unit of this.units) {
      unit.update(delta, this.terrain);
      anyMoving = anyMoving || unit.isMoving();
    }

    const separated = this.separateUnits();

    this.fog.update(this.units);
    this.refreshVisibleEnemies();

    if (anyMoving || this.wasMoving || separated) {
      this.unitsLayer.sort('y');
    }

    this.wasMoving = anyMoving;
    this.updateZoomHud();
  }

  private buildWorld(): void {
    const grass = this.add
      .tileSprite(0, 0, WORLD_WIDTH, WORLD_HEIGHT, 'grass')
      .setOrigin(0);
    this.worldLayer.add(grass);

    const random = new Phaser.Math.RandomDataGenerator(['arena-world']);
    const decorations = this.add.graphics();

    for (let index = 0; index < 30; index += 1) {
      decorations.fillStyle(random.pick([0x33592f, 0x4a7a42, 0x2f512c]), 0.16);
      decorations.fillEllipse(
        random.between(140, WORLD_WIDTH - 140),
        random.between(140, WORLD_HEIGHT - 140),
        random.between(100, 260),
        random.between(60, 170),
      );
    }

    for (let index = 0; index < 26; index += 1) {
      const x = random.between(120, WORLD_WIDTH - 120);
      const y = random.between(120, WORLD_HEIGHT - 120);

      decorations.fillStyle(0x6c6a58, 0.32);
      decorations.fillEllipse(x, y, random.between(8, 18), random.between(5, 11));
      decorations.fillStyle(0x8a8770, 0.2);
      decorations.fillEllipse(x - 2, y - 2, random.between(6, 12), random.between(4, 8));
    }

    this.worldLayer.add(decorations);
    this.drawBorder();
  }

  private drawBorder(): void {
    const border = this.add.graphics();
    const thickness = 26;
    const blockColors = [0x243326, 0x2b3b2c, 0x1f2b21, 0x2a3a2b];
    const random = new Phaser.Math.RandomDataGenerator(['arena-border']);

    border.fillStyle(COLORS.border, 1);
    border.fillRect(0, 0, WORLD_WIDTH, thickness);
    border.fillRect(0, WORLD_HEIGHT - thickness, WORLD_WIDTH, thickness);
    border.fillRect(0, 0, thickness, WORLD_HEIGHT);
    border.fillRect(WORLD_WIDTH - thickness, 0, thickness, WORLD_HEIGHT);

    for (let x = 0; x < WORLD_WIDTH; x += 54) {
      border.fillStyle(random.pick(blockColors), 0.95);
      border.fillRect(x + 1, 1, 52, thickness - 2);
      border.fillRect(x + 1, WORLD_HEIGHT - thickness + 1, 52, thickness - 2);
    }

    for (let y = thickness; y < WORLD_HEIGHT - thickness; y += 54) {
      border.fillStyle(random.pick(blockColors), 0.95);
      border.fillRect(1, y + 1, thickness - 2, 52);
      border.fillRect(WORLD_WIDTH - thickness + 1, y + 1, thickness - 2, 52);
    }

    border.lineStyle(2, 0x8fb47c, 0.22);
    border.strokeRect(
      thickness,
      thickness,
      WORLD_WIDTH - thickness * 2,
      WORLD_HEIGHT - thickness * 2,
    );

    border.lineStyle(6, 0x000000, 0.18);
    border.strokeRect(
      thickness + 2,
      thickness + 2,
      WORLD_WIDTH - thickness * 2 - 4,
      WORLD_HEIGHT - thickness * 2 - 4,
    );

    this.worldLayer.add(border);
    this.terrain = new Terrain(this, this.worldLayer);
    this.pathfinder = new Pathfinder(this.terrain, WORLD_WIDTH, WORLD_HEIGHT);
  }

  private spawnUnits(): void {
    const centerX = WORLD_WIDTH / 2;
    const centerY = WORLD_HEIGHT / 2;

    for (const spawn of PLAYER_FORMATION) {
      this.addUnit(
        centerX + spawn.offsetX,
        centerY + spawn.offsetY,
        spawn.type,
        FACTIONS.player,
      );
    }

    for (const spawn of ENEMY_FORMATION) {
      this.addUnit(spawn.x, spawn.y, spawn.type, FACTIONS.enemy);
    }
  }

  private addUnit(
    x: number,
    y: number,
    type: UnitTypeId,
    faction: FactionDefinition,
  ): void {
    const unit = new Unit(this, x, y, UNIT_TYPES[type], faction);

    this.unitsLayer.add(unit);
    this.units.push(unit);
  }

  private buildHud(): void {
    this.uiLayer = this.add.container(0, 0);

    const panel = this.add
      .rectangle(24, 24, 360, 116, COLORS.panel, 0.82)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x3f7f5b, 0.55);

    const accent = this.add
      .rectangle(24, 24, 4, 116, COLORS.accent, 0.9)
      .setOrigin(0, 0);

    const title = this.add.text(44, 34, 'ARENA', {
      fontFamily: FONT_FAMILY,
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#a8f0c6',
    });

    this.statsText = this.add.text(44, 66, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '14px',
      color: COLORS.text,
    });

    this.detailText = this.add.text(44, 92, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '13px',
      color: COLORS.textMuted,
    });

    const zoomPanel = this.add
      .rectangle(VIEW_WIDTH - 24, 24, 152, 40, COLORS.panel, 0.82)
      .setOrigin(1, 0)
      .setStrokeStyle(1, 0x3f7f5b, 0.55);

    this.zoomText = this.add
      .text(VIEW_WIDTH - 40, 44, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        color: COLORS.text,
      })
      .setOrigin(1, 0.5);

    const hint = this.add.text(0, 0, HINT_TEXT, {
      fontFamily: FONT_FAMILY,
      fontSize: '13px',
      color: '#9fbfae',
    });

    const hintPanel = this.add
      .rectangle(24, VIEW_HEIGHT - 20, hint.width + 32, 34, COLORS.panel, 0.8)
      .setOrigin(0, 1)
      .setStrokeStyle(1, 0x3f7f5b, 0.5);

    hint.setPosition(40, VIEW_HEIGHT - 37).setOrigin(0, 0.5);

    this.uiLayer.add([
      panel,
      accent,
      title,
      this.statsText,
      this.detailText,
      zoomPanel,
      this.zoomText,
      hintPanel,
      hint,
    ]);

    this.hudBounds.push(
      new Phaser.Geom.Rectangle(24, 24, 360, 116),
      new Phaser.Geom.Rectangle(VIEW_WIDTH - 24 - 152, 24, 152, 40),
      new Phaser.Geom.Rectangle(24, VIEW_HEIGHT - 20 - 34, hint.width + 32, 34),
    );
  }

  private setupCameras(): void {
    this.uiCamera = this.cameras.add(0, 0, VIEW_WIDTH, VIEW_HEIGHT, false, 'ui');
    this.uiCamera.setScroll(0, 0);
    this.uiCamera.transparent = true;

    this.cameras.main.ignore(this.uiLayer);
    this.uiCamera.ignore(this.worldLayer);
  }

  private setupInput(): void {
    this.input.mouse?.disableContextMenu();

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input is not available.');
    }

    this.shiftKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);
    this.input.on(Phaser.Input.Events.GAME_OUT, this.handleGameOut, this);

    keyboard.on('keydown-ESC', this.clearSelection, this);
    keyboard.on('keydown-M', this.returnToMenu, this);
    keyboard.on('keydown-A', (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        this.selectAll();
      }
    });
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (!pointer.leftButtonDown() || this.isPointerOverHud(pointer)) {
      return;
    }

    this.pointerDownScreen.set(pointer.x, pointer.y);
    this.dragStart = this.getPointerWorld(pointer);
    this.dragMoved = false;
    this.selectionBox.clear();
    this.selectionBox.setVisible(false);
    this.clearHover();
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragStart) {
      if (!pointer.isDown) {
        if (this.isPointerOverHud(pointer)) {
          this.clearHover();
        } else {
          this.updateHover(pointer);
        }
      }
      return;
    }

    if (!pointer.isDown || !pointer.leftButtonDown()) {
      return;
    }

    const screenDistance = Phaser.Math.Distance.Between(
      this.pointerDownScreen.x,
      this.pointerDownScreen.y,
      pointer.x,
      pointer.y,
    );

    if (!this.dragMoved && screenDistance <= DRAG_THRESHOLD) {
      return;
    }

    this.dragMoved = true;
    this.input.setDefaultCursor('crosshair');

    const current = this.getPointerWorld(pointer);
    this.drawSelectionBox(this.getSelectionRect(this.dragStart, current));
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.button === 2) {
      if (!this.dragStart && !this.isPointerOverHud(pointer)) {
        this.issueMoveCommand(this.getPointerWorld(pointer));
      }
      return;
    }

    if (pointer.button !== 0) {
      return;
    }

    const start = this.dragStart;
    const wasDragging = this.dragMoved;

    this.dragStart = null;
    this.dragMoved = false;
    this.selectionBox.clear();
    this.selectionBox.setVisible(false);
    this.input.setDefaultCursor('default');

    if (!start) {
      return;
    }

    if (wasDragging) {
      const rectangle = this.getSelectionRect(start, this.getPointerWorld(pointer));
      const additive = this.shiftKey.isDown;

      if (!additive) {
        this.clearSelection();
      }

      for (const unit of this.units) {
        if (
          !unit.isPlayerControlled ||
          !Phaser.Geom.Rectangle.Overlaps(rectangle, unit.getBounds())
        ) {
          continue;
        }

        if (!this.selected.has(unit)) {
          this.selected.add(unit);
          unit.setSelected(true);
        }
      }

      this.refreshHud();
      return;
    }

    const point = this.getPointerWorld(pointer);
    const hit = this.findPlayerUnitAt(point.x, point.y);

    if (!hit) {
      if (!this.shiftKey.isDown) {
        this.clearSelection();
      }
      return;
    }

    if (this.shiftKey.isDown) {
      this.toggleSelection(hit);
    } else {
      this.selectOnly(hit);
    }
  }

  private updateHover(pointer: Phaser.Input.Pointer): void {
    const point = this.getPointerWorld(pointer);
    const hovered = this.findPlayerUnitAt(point.x, point.y);

    this.input.setDefaultCursor(hovered ? 'pointer' : 'default');

    for (const unit of this.units) {
      unit.setHovered(unit === hovered);
    }
  }

  private clearHover(): void {
    this.input.setDefaultCursor('default');

    for (const unit of this.units) {
      unit.setHovered(false);
    }
  }

  private isPointerOverHud(pointer: Phaser.Input.Pointer): boolean {
    return this.hudBounds.some((bounds) => bounds.contains(pointer.x, pointer.y));
  }

  private handleGameOut(): void {
    this.dragStart = null;
    this.dragMoved = false;
    this.selectionBox.clear();
    this.selectionBox.setVisible(false);
    this.clearHover();
  }

  private separateUnits(): boolean {
    const minimumDistance = UNIT_SIZE + 6;
    let moved = false;

    for (let first = 0; first < this.units.length; first += 1) {
      for (let second = first + 1; second < this.units.length; second += 1) {
        const a = this.units[first];
        const b = this.units[second];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);

        if (distance >= minimumDistance) {
          continue;
        }

        const normalX = distance > 0.001 ? dx / distance : 1;
        const normalY = distance > 0.001 ? dy / distance : 0;

        // Расталкивание делится обратно пропорционально массе:
        // тяжелый отряд почти не сдвигается, легкий отлетает.
        const totalMass = a.stats.mass + b.stats.mass;
        const overlap = minimumDistance - distance;
        const pushA = overlap * (b.stats.mass / totalMass);
        const pushB = overlap * (a.stats.mass / totalMass);

        this.placeUnit(a, a.x - normalX * pushA, a.y - normalY * pushA);
        this.placeUnit(b, b.x + normalX * pushB, b.y + normalY * pushB);
        moved = true;
      }
    }

    return moved;
  }

  private placeUnit(unit: Unit, x: number, y: number): void {
    const nextX = Phaser.Math.Clamp(x, WORLD_MARGIN, WORLD_WIDTH - WORLD_MARGIN);
    const nextY = Phaser.Math.Clamp(y, WORLD_MARGIN, WORLD_HEIGHT - WORLD_MARGIN);

    // Расталкивание не должно заталкивать отряды в воду или конницу в лес.
    if (!this.terrain.isPassable(nextX, nextY, unit.unitType.id)) {
      return;
    }

    unit.setPosition(nextX, nextY);
  }

  private findPlayerUnitAt(worldX: number, worldY: number): Unit | null {
    for (let index = this.units.length - 1; index >= 0; index -= 1) {
      const unit = this.units[index];
      if (unit.isPlayerControlled && unit.containsPoint(worldX, worldY)) {
        return unit;
      }
    }

    return null;
  }

  private getPointerWorld(pointer: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    return this.cameras.main.getWorldPoint(pointer.x, pointer.y);
  }

  private getSelectionRect(
    start: Phaser.Math.Vector2,
    end: Phaser.Math.Vector2,
  ): Phaser.Geom.Rectangle {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);

    return new Phaser.Geom.Rectangle(x, y, Math.abs(end.x - start.x), Math.abs(end.y - start.y));
  }

  private drawSelectionBox(rectangle: Phaser.Geom.Rectangle): void {
    this.selectionBox.clear();
    this.selectionBox.setVisible(true);
    this.selectionBox.fillStyle(COLORS.accent, 0.08);
    this.selectionBox.fillRectShape(rectangle);
    this.selectionBox.lineStyle(1.5 / this.cameras.main.zoom, COLORS.accent, 0.9);
    this.selectionBox.strokeRectShape(rectangle);
  }

  private selectOnly(unit: Unit): void {
    for (const other of this.units) {
      other.setSelected(other === unit);
    }

    this.selected.clear();
    this.selected.add(unit);
    this.refreshHud();
  }

  private toggleSelection(unit: Unit): void {
    if (this.selected.has(unit)) {
      this.selected.delete(unit);
      unit.setSelected(false);
    } else {
      this.selected.add(unit);
      unit.setSelected(true);
    }

    this.refreshHud();
  }

  private clearSelection(): void {
    for (const unit of this.selected) {
      unit.setSelected(false);
    }

    this.selected.clear();
    this.refreshHud();
  }

  private selectAll(): void {
    for (const unit of this.units) {
      if (!unit.isPlayerControlled) {
        continue;
      }

      this.selected.add(unit);
      unit.setSelected(true);
    }

    this.refreshHud();
  }

  private issueMoveCommand(target: Phaser.Math.Vector2): void {
    if (this.selected.size === 0) {
      return;
    }

    const safeTarget = new Phaser.Math.Vector2(
      Phaser.Math.Clamp(target.x, WORLD_MARGIN, WORLD_WIDTH - WORLD_MARGIN),
      Phaser.Math.Clamp(target.y, WORLD_MARGIN, WORLD_HEIGHT - WORLD_MARGIN),
    );

    const ordered = [...this.selected].sort(
      (first, second) =>
        Phaser.Math.Distance.Squared(first.x, first.y, safeTarget.x, safeTarget.y) -
        Phaser.Math.Distance.Squared(second.x, second.y, safeTarget.x, safeTarget.y),
    );

    this.spawnMoveMarker(safeTarget.x, safeTarget.y);

    const slots = this.buildFormationSlots(ordered.length, safeTarget);
    const taken: Phaser.Math.Vector2[] = [];

    for (const unit of ordered) {
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;

      slots.forEach((slot, index) => {
        const distance = Phaser.Math.Distance.Squared(unit.x, unit.y, slot.x, slot.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });

      const [slot] = slots.splice(bestIndex, 1);
      // Слот в воде или в лесу для конницы переносится на ближайшую проходимую
      // точку, иначе отряд встаёт на краю препятствия и не доходит до строя.
      const slotTarget =
        this.terrain.nearestPassablePoint(slot.x, slot.y, unit.unitType.id, taken) ?? slot;

      taken.push(slotTarget);

      const path = this.pathfinder.findPath(
        unit.x,
        unit.y,
        slotTarget.x,
        slotTarget.y,
        unit.unitType.id,
      );

      if (path.length > 0) {
        unit.moveAlong(path);
      } else {
        unit.stop();
      }
    }
  }

  private buildFormationSlots(count: number, center: Phaser.Math.Vector2): Phaser.Math.Vector2[] {
    if (count <= 1) {
      return [center.clone()];
    }

    const columns = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / columns);
    const startX = center.x - ((columns - 1) * FORMATION_SPACING) / 2;
    const startY = center.y - ((rows - 1) * FORMATION_SPACING) / 2;
    const slots: Phaser.Math.Vector2[] = [];

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        slots.push(
          new Phaser.Math.Vector2(
            Phaser.Math.Clamp(
              startX + column * FORMATION_SPACING,
              WORLD_MARGIN,
              WORLD_WIDTH - WORLD_MARGIN,
            ),
            Phaser.Math.Clamp(
              startY + row * FORMATION_SPACING,
              WORLD_MARGIN,
              WORLD_HEIGHT - WORLD_MARGIN,
            ),
          ),
        );
      }
    }

    return slots.slice(0, count);
  }

  private spawnMoveMarker(x: number, y: number): void {
    const marker = this.add
      .circle(x, y, 12, COLORS.accent, 0.12)
      .setStrokeStyle(2, COLORS.accent, 0.9);

    this.worldLayer.add(marker);

    this.tweens.add({
      targets: marker,
      scale: 2.2,
      alpha: 0,
      duration: 450,
      ease: 'Cubic.easeOut',
      onComplete: () => marker.destroy(),
    });
  }

  private refreshVisibleEnemies(): void {
    let visible = 0;

    for (const unit of this.units) {
      if (!unit.isPlayerControlled && unit.visible) {
        visible += 1;
      }
    }

    if (visible === this.visibleEnemyCount) {
      return;
    }

    this.visibleEnemyCount = visible;
    this.refreshHud();
  }

  private refreshHud(): void {
    const playerCount = this.units.filter((unit) => unit.isPlayerControlled).length;
    const head = `Отрядов: ${playerCount}   ·   врагов в видимости: ${this.visibleEnemyCount}`;

    if (this.selected.size === 0) {
      this.statsText.setText(`${head}   ·   выбрано: 0`);
      this.detailText.setText('');
      return;
    }

    const selectedUnits = [...this.selected];
    const labels = [...new Set(selectedUnits.map((unit) => unit.unitType.label))].join(' ');
    this.statsText.setText(
      `${head}   ·   выбрано: ${this.selected.size} (${labels})`,
    );

    if (selectedUnits.length !== 1) {
      this.detailText.setText('');
      return;
    }

    const [unit] = selectedUnits;
    this.detailText.setText(
      `HP ${unit.hp}/${unit.maxHp}   ·   скорость ${unit.stats.speed}   ·   мораль ${unit.stats.morale}   ·   масса ${unit.stats.mass.toFixed(1)}`,
    );
  }

  private updateZoomHud(): void {
    const percent = Math.round(this.cameras.main.zoom * 100);
    if (percent === this.lastZoomPercent) {
      return;
    }

    this.lastZoomPercent = percent;
    this.zoomText.setText(`Зум ${percent}%`);
  }

  private returnToMenu(): void {
    if (this.leaving) {
      return;
    }

    this.leaving = true;
    this.cameras.main.fadeOut(200, 5, 10, 7);
    this.uiCamera.fadeOut(200, 5, 10, 7);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('MenuScene');
    });
  }
}
