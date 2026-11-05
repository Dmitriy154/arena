import Phaser from 'phaser';
import {
  CAMERA_START_ZOOM,
  COLORS,
  DRAG_THRESHOLD,
  FONT_FAMILY,
  FORMATION_RIGID_DRAG,
  FORMATION_RIGID_MIN_TURN,
  FORMATION_SPACING,
  FORMATION_SETTLE_COOLDOWN,
  FORMATION_SETTLE_RANGE,
  FORMATION_SETTLE_TOLERANCE,
  UNIT_SIZE,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  WORLD_HEIGHT,
  WORLD_MARGIN,
  WORLD_WIDTH,
} from '../constants';
import { Unit } from '../entities/Unit';
import { CameraController } from '../systems/CameraController';
import { CursorView } from '../systems/CursorView';
import { FogOfWar } from '../systems/FogOfWar';
import { columnsForDrag, directionFrom } from '../systems/Formation';
import { FormationPreview } from '../systems/FormationPreview';
import { MoveOrderSystem } from '../systems/MoveOrderSystem';
import { Pathfinder } from '../systems/Pathfinder';
import { Terrain } from '../systems/Terrain';
import { FACTIONS, UNIT_TYPES, type FactionDefinition, type UnitTypeId } from '../types';

const HINT_TEXT = [
  'ЛКМ — выбор и рамка · Shift — добавить · ПКМ — приказ · ПКМ с протяжкой — строй с поворотом',
  'R — вернуть в строй · камера — стрелки, WASD, край экрана · колесо — зум · Esc — сброс · M — меню',
].join('\n');

/** Что делает зажатая кнопка: ЛКМ — рамка, ПКМ — приказ или строй. */
type PointerMode = 'idle' | 'box' | 'order';

/** Точки развёртывания: игрок в левой четверти мира, враг — в правой. */
const PLAYER_CENTER = new Phaser.Math.Vector2(WORLD_WIDTH * 0.25, WORLD_HEIGHT * 0.5);
const ENEMY_CENTER = new Phaser.Math.Vector2(WORLD_WIDTH * 0.75, WORLD_HEIGHT * 0.5);

/** Строй игрока: пехота в линии, стрелки за центром, конница на флангах. */
const PLAYER_FORMATION: Array<{ type: UnitTypeId; offsetX: number; offsetY: number }> = [
  { type: 'LI', offsetX: -350, offsetY: 90 },
  { type: 'LI', offsetX: -210, offsetY: 90 },
  { type: 'SP', offsetX: 0, offsetY: 90 },
  { type: 'HI', offsetX: 210, offsetY: 90 },
  { type: 'HI', offsetX: 350, offsetY: 90 },
  { type: 'SP', offsetX: -140, offsetY: 250 },
  { type: 'AR', offsetX: 140, offsetY: 250 },
  { type: 'AR', offsetX: 0, offsetY: 250 },
  { type: 'LC', offsetX: -470, offsetY: 30 },
  { type: 'HC', offsetX: 470, offsetY: 30 },
];

const ENEMY_FORMATION: Array<{ type: UnitTypeId; offsetX: number; offsetY: number }> = [
  { type: 'SP', offsetX: -160, offsetY: 90 },
  { type: 'SP', offsetX: 160, offsetY: 90 },
  { type: 'HI', offsetX: 0, offsetY: 90 },
  { type: 'AR', offsetX: 0, offsetY: 250 },
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
  private fpsText!: Phaser.GameObjects.Text;
  private shiftKey!: Phaser.Input.Keyboard.Key;

  private readonly units: Unit[] = [];
  private readonly selected = new Set<Unit>();
  private readonly settleCooldown = new Map<Unit, number>();
  private readonly hudBounds: Phaser.Geom.Rectangle[] = [];
  private readonly pressScreen = new Phaser.Math.Vector2();
  private formationPreview!: FormationPreview;
  private moveOrders!: MoveOrderSystem;
  private cursorView!: CursorView;
  private pointerInsideCanvas = true;
  private pressWorld: Phaser.Math.Vector2 | null = null;
  private pointerMode: PointerMode = 'idle';
  private lastZoomPercent = -1;
  private visibleEnemyCount = 0;
  private fpsFrames = 0;
  private fpsElapsed = 0;
  private worstFrame = 0;
  private fogMs = 0;
  private unitMs = 0;
  private wasMoving = false;
  private leaving = false;

  constructor() {
    super('BattleScene');
  }

  create(): void {
    this.units.length = 0;
    this.selected.clear();
    this.hudBounds.length = 0;
    this.pressWorld = null;
    this.pointerMode = 'idle';
    this.lastZoomPercent = -1;
    this.visibleEnemyCount = 0;
    this.wasMoving = false;
    this.fpsFrames = 0;
    this.fpsElapsed = 0;
    this.leaving = false;

    const camera = this.cameras.main;
    camera.setBackgroundColor(COLORS.background);
    camera.setZoom(CAMERA_START_ZOOM);
    camera.centerOn(PLAYER_CENTER.x, PLAYER_CENTER.y);

    this.worldLayer = this.add.container(0, 0);
    this.buildWorld();

    this.unitsLayer = this.add.container(0, 0);
    this.worldLayer.add(this.unitsLayer);
    this.spawnUnits();

    this.fog = new FogOfWar(this, this.worldLayer, WORLD_WIDTH, WORLD_HEIGHT, this.terrain);

    this.selectionBox = this.add.graphics();
    this.worldLayer.add(this.selectionBox);

    // Призрак добавляется после тумана и рамки, иначе дымка его перекрывает.
    this.formationPreview = new FormationPreview(this, this.worldLayer);
    this.moveOrders = new MoveOrderSystem(this, this.worldLayer, this.terrain, this.pathfinder);

    this.buildHud();
    this.setupCameras();

    this.cursorView = new CursorView(this, this.uiLayer);
    // Системный курсор прячем: свой рисует размер и цвет по состоянию.
    this.input.setDefaultCursor('none');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.setDefaultCursor('default');
    });

    this.cameraController = new CameraController(this, camera, {
      isPointerBlocked: (pointer) => this.isPointerOverHud(pointer),
    });
    this.setupInput();

    camera.fadeIn(280, 5, 14, 9);
    this.refreshHud();
    this.updateZoomHud();
  }

  update(time: number, delta: number): void {
    if (this.leaving) {
      return;
    }

    this.cameraController.update(delta);
    this.updatePointerState();
    this.updateCursor(time);

    const unitsStarted = performance.now();
    let anyMoving = false;
    for (const unit of this.units) {
      unit.update(delta, this.terrain);
      anyMoving = anyMoving || unit.isMoving();
    }

    const separated = this.separateUnits();
    this.settleUnits();
    this.unitMs += performance.now() - unitsStarted;

    const fogStarted = performance.now();
    this.fog.update(this.units);
    this.fogMs += performance.now() - fogStarted;
    this.refreshVisibleEnemies();

    if (anyMoving || this.wasMoving || separated) {
      this.unitsLayer.sort('y');
    }

    this.wasMoving = anyMoving;
    this.updateZoomHud();
    this.updateFpsHud(delta);
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
    for (const spawn of PLAYER_FORMATION) {
      this.addUnit(
        PLAYER_CENTER.x + spawn.offsetX,
        PLAYER_CENTER.y + spawn.offsetY,
        spawn.type,
        FACTIONS.player,
      );
    }

    for (const spawn of ENEMY_FORMATION) {
      this.addUnit(
        ENEMY_CENTER.x + spawn.offsetX,
        ENEMY_CENTER.y + spawn.offsetY,
        spawn.type,
        FACTIONS.enemy,
      );
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
      .rectangle(VIEW_WIDTH - 24, 24, 152, 64, COLORS.panel, 0.82)
      .setOrigin(1, 0)
      .setStrokeStyle(1, 0x3f7f5b, 0.55);

    this.zoomText = this.add
      .text(VIEW_WIDTH - 40, 44, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        color: COLORS.text,
      })
      .setOrigin(1, 0.5);    this.fpsText = this.add
      .text(VIEW_WIDTH - 40, 68, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        color: COLORS.textMuted,
      })
      .setOrigin(1, 0.5);

    const hint = this.add.text(0, 0, HINT_TEXT, {
      fontFamily: FONT_FAMILY,
      fontSize: '13px',
      color: '#9fbfae',
    });

    const hintHeight = hint.height + 16;

    const hintPanel = this.add
      .rectangle(24, VIEW_HEIGHT - 20, hint.width + 32, hintHeight, COLORS.panel, 0.8)
      .setOrigin(0, 1)
      .setStrokeStyle(1, 0x3f7f5b, 0.5);

    hint.setPosition(40, VIEW_HEIGHT - 20 - hintHeight / 2).setOrigin(0, 0.5);

    this.uiLayer.add([
      panel,
      accent,
      title,
      this.statsText,
      this.detailText,
      zoomPanel,
      this.zoomText,
      this.fpsText,
      hintPanel,
      hint,
    ]);

    this.hudBounds.push(
      new Phaser.Geom.Rectangle(24, 24, 360, 116),
      new Phaser.Geom.Rectangle(VIEW_WIDTH - 24 - 152, 24, 152, 64),
      new Phaser.Geom.Rectangle(24, VIEW_HEIGHT - 20 - hintHeight, hint.width + 32, hintHeight),
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
    this.input.on(Phaser.Input.Events.GAME_OVER, this.handleGameOver, this);
    this.game.events.on(Phaser.Core.Events.BLUR, this.handleBlur, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, this.handleBlur, this);
    });

    keyboard.on('keydown-ESC', this.handleEscape, this);
    keyboard.on('keydown-R', this.reseatSelection, this);
    keyboard.on('keydown-M', this.returnToMenu, this);
    keyboard.on('keydown-A', (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        this.selectAll();
      }
    });
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.isPointerOverHud(pointer)) {
      return;
    }

    const left = pointer.leftButtonDown();
    const right = pointer.rightButtonDown();

    if (!left && !right) {
      return;
    }

    this.pressScreen.set(pointer.x, pointer.y);
    this.pressWorld = this.getPointerWorld(pointer);
    this.pointerMode = left ? 'box' : 'order';
    this.selectionBox.clear();
    this.selectionBox.setVisible(false);
    this.clearHover();
  }

  private pressDistance(pointer: Phaser.Input.Pointer): number {
    return Phaser.Math.Distance.Between(
      this.pressScreen.x,
      this.pressScreen.y,
      pointer.x,
      pointer.y,
    );
  }

  /** Курсор: размер и цвет зависят от того, что сейчас произойдёт по клику. */
  private updateCursor(time: number): void {
    const pointer = this.input.activePointer;

    if (!this.pointerInsideCanvas) {
      this.cursorView.hide();
      return;
    }

    if (this.pointerMode === 'order' && this.pressWorld) {
      const cursor = this.getPointerWorld(pointer);
      const dragLength = Phaser.Math.Distance.Between(
        this.pressWorld.x,
        this.pressWorld.y,
        cursor.x,
        cursor.y,
      );

      if (dragLength < FORMATION_RIGID_DRAG) {
        this.cursorView.update(pointer.x, pointer.y, 'rigid', 0, time);
        return;
      }

      this.cursorView.update(
        pointer.x,
        pointer.y,
        'order',
        (dragLength - FORMATION_RIGID_DRAG) / FORMATION_SPACING,
        time,
      );
      return;
    }

    if (this.pointerMode === 'box') {
      this.cursorView.update(pointer.x, pointer.y, 'box', 1, time);
      return;
    }

    const world = this.getPointerWorld(pointer);
    const hovered = this.findPlayerUnitAt(world.x, world.y);

    this.cursorView.update(pointer.x, pointer.y, hovered ? 'hover' : 'default', 1, time);
  }

  /** Рамка и призрак строя перерисовываются каждый кадр: камера едет сама. */
  private updatePointerState(): void {
    if (!this.pressWorld) {
      return;
    }

    const pointer = this.input.activePointer;

    if (this.pointerMode === 'box') {
      if (this.pressDistance(pointer) <= DRAG_THRESHOLD) {
        return;
      }

      this.drawSelectionBox(this.getSelectionRect(this.pressWorld, this.getPointerWorld(pointer)));
      return;
    }

    if (this.pointerMode === 'order') {
      this.formationPreview.update(
        this.pressWorld,
        this.getPointerWorld(pointer),
        [...this.selected],
        this.terrain,
        this.cameras.main.zoom,
      );
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.pointerMode === 'idle') {
      if (!pointer.isDown) {
        if (this.isPointerOverHud(pointer)) {
          this.clearHover();
        } else {
          this.updateHover(pointer);
        }
      }
      return;
    }

    if (!pointer.isDown) {
      return;
    }

    // Курсор рисует CursorView: системный спрятан на всё время боя.
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.button === 2) {
      const start = this.pressWorld;
      const mode = this.pointerMode;

      this.resetPointerState();

      if (mode !== 'order' || !start || this.isPointerOverHud(pointer)) {
        return;
      }

      const cursor = this.getPointerWorld(pointer);
      const dragLength = Phaser.Math.Distance.Between(start.x, start.y, cursor.x, cursor.y);
      const facing = dragLength >= FORMATION_RIGID_DRAG ? directionFrom(start, cursor) : null;

      if (facing) {
        // Вектор длиннее минимального: строй перестраивается, ряд за рядом.
        this.moveOrders.issueFormation(
          [...this.selected],
          start,
          facing,
          columnsForDrag(this.selected.size, dragLength - FORMATION_RIGID_DRAG),
        );
      } else {
        // Короткий вектор — перенос как есть, с сохранением взаимных положений.
        // Вектор длиннее дрожания руки ещё и разворачивает блок по своему направлению.
        const turn = dragLength >= FORMATION_RIGID_MIN_TURN ? directionFrom(start, cursor) : null;

        this.moveOrders.issueToPoint([...this.selected], start, turn);
      }

      return;
    }

    if (pointer.button !== 0) {
      return;
    }

    const mode = this.pointerMode;
    const start = this.pressWorld;
    const screenDistance = this.pressDistance(pointer);

    this.resetPointerState();

    if (!start) {
      return;
    }

    if (mode === 'box' && screenDistance > DRAG_THRESHOLD) {
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

    for (const unit of this.units) {
      unit.setHovered(unit === hovered);
    }
  }

  private clearHover(): void {
    for (const unit of this.units) {
      unit.setHovered(false);
    }
  }

  private isPointerOverHud(pointer: Phaser.Input.Pointer): boolean {
    return this.hudBounds.some((bounds) => bounds.contains(pointer.x, pointer.y));
  }

  private resetPointerState(): void {
    this.pointerMode = 'idle';
    this.pressWorld = null;
    this.selectionBox.clear();
    this.selectionBox.setVisible(false);
    this.formationPreview.hide();
  }

  private handleEscape(): void {
    this.resetPointerState();
    this.clearSelection();
  }

  /**
   * Отряд, которого столкнул сосед, сам возвращается на своё место в строю.
   * Догоняем только рядом со слотом: далёкий отряд — это уже другой приказ.
   */
  private settleUnits(): void {
    const now = this.time.now;

    for (const unit of this.units) {
      const post = unit.post;

      if (!post || unit.isMoving()) {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(unit.x, unit.y, post.x, post.y);

      if (distance <= FORMATION_SETTLE_TOLERANCE || distance > FORMATION_SETTLE_RANGE) {
        continue;
      }

      if (!this.isPostReachable(unit, post)) {
        continue;
      }

      // Пауза между попытками: иначе два отряда могут бесконечно дёргать друг друга.
      const last = this.settleCooldown.get(unit) ?? 0;

      if (now - last < FORMATION_SETTLE_COOLDOWN) {
        continue;
      }

      this.settleCooldown.set(unit, now);
      unit.moveAlong([post], unit.postFacing);
    }
  }

  /**
   * Своё место свободно и достижимо по прямой. Если слот занят соседом или
   * отрезан водой/лесом, отряд остаётся стоять, а не толкается туда вечно.
   */
  private isPostReachable(unit: Unit, post: Phaser.Math.Vector2): boolean {
    const minimum = UNIT_SIZE + 6;

    for (const other of this.units) {
      if (
        other !== unit &&
        Phaser.Math.Distance.Squared(other.x, other.y, post.x, post.y) < minimum * minimum
      ) {
        return false;
      }
    }

    const dx = post.x - unit.x;
    const dy = post.y - unit.y;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 20));

    for (let step = 1; step <= steps; step += 1) {
      if (
        !this.terrain.isPassable(
          unit.x + (dx * step) / steps,
          unit.y + (dy * step) / steps,
          unit.unitType.id,
        )
      ) {
        return false;
      }
    }

    return true;
  }

  /** Вернуть выделенные отряды на их места в строю, если их столкнули. */
  private reseatSelection(): void {
    for (const unit of this.selected) {
      const post = unit.post;

      if (!post || Phaser.Math.Distance.Between(unit.x, unit.y, post.x, post.y) < 1) {
        continue;
      }

      const path = this.pathfinder.findPath(unit.x, unit.y, post.x, post.y, unit.unitType.id);

      if (path.length > 0) {
        unit.moveAlong(path, unit.postFacing);
      }
    }
  }

  private handleGameOut(): void {
    this.pointerInsideCanvas = false;
    this.cursorView.hide();
    this.resetPointerState();
    this.clearHover();
  }

  private handleGameOver(): void {
    this.pointerInsideCanvas = true;
  }

  private handleBlur(): void {
    this.cursorView.hide();
    this.resetPointerState();
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

  /** Счётчик гладкости: обновляем дважды в секунду, чтобы не дёргать текст каждый кадр. */
  private updateFpsHud(delta: number): void {
    this.fpsFrames += 1;
    this.fpsElapsed += delta;
    this.worstFrame = Math.max(this.worstFrame, delta);

    if (this.fpsElapsed < 500) {
      return;
    }

    const fps = Math.round((this.fpsFrames * 1000) / this.fpsElapsed);
    const frameMs = (this.fpsElapsed / this.fpsFrames).toFixed(1);
    const worst = Math.round(this.worstFrame);
    const fog = (this.fogMs / this.fpsFrames).toFixed(1);
    const units = (this.unitMs / this.fpsFrames).toFixed(1);

    // Разбивка по кадру: видно, что именно съедает время — туман или отряды.
    this.fpsText.setText(`FPS ${fps} · ${frameMs} мс · макс ${worst} · туман ${fog} · отряды ${units}`);
    this.fpsFrames = 0;
    this.fpsElapsed = 0;
    this.worstFrame = 0;
    this.fogMs = 0;
    this.unitMs = 0;
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
    this.cursorView.hide();
    this.cameras.main.fadeOut(200, 5, 10, 7);
    this.uiCamera.fadeOut(200, 5, 10, 7);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('MenuScene');
    });
  }
}
