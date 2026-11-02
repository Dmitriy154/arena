import Phaser from 'phaser';
import {
  CAMERA_MAX_ZOOM,
  CAMERA_MIN_ZOOM,
  CAMERA_PAN_SPEED,
  CAMERA_ZOOM_SMOOTHING,
  CAMERA_ZOOM_STEP,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../constants';

interface MovementKeys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  arrowUp: Phaser.Input.Keyboard.Key;
  arrowDown: Phaser.Input.Keyboard.Key;
  arrowLeft: Phaser.Input.Keyboard.Key;
  arrowRight: Phaser.Input.Keyboard.Key;
}

export class CameraController {
  private readonly scene: Phaser.Scene;
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly keys: MovementKeys;
  private readonly anchor = new Phaser.Math.Vector2(0, 0);

  private targetZoom: number;
  private panning = false;
  private lastPanX = 0;
  private lastPanY = 0;
  private modifierDown = false;

  constructor(scene: Phaser.Scene, camera: Phaser.Cameras.Scene2D.Camera) {
    this.scene = scene;
    this.camera = camera;
    this.targetZoom = camera.zoom;
    this.anchor.set(camera.width * 0.5, camera.height * 0.5);

    const keyboard = scene.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input is not available.');
    }

    const keys = keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;

    this.keys = {
      up: keys.W,
      down: keys.S,
      left: keys.A,
      right: keys.D,
      arrowUp: keys.UP,
      arrowDown: keys.DOWN,
      arrowLeft: keys.LEFT,
      arrowRight: keys.RIGHT,
    };

    keyboard.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.onKeyDown, this);
    keyboard.on(Phaser.Input.Keyboard.Events.ANY_KEY_UP, this.onKeyUp, this);
    scene.game.events.on(Phaser.Core.Events.BLUR, this.resetModifier, this);

    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  update(delta: number): void {
    this.updateKeyboardPan(delta);
    this.updateZoom(delta);
    this.clampScroll();
  }

  private updateKeyboardPan(delta: number): void {
    const right = this.keys.right.isDown || this.keys.arrowRight.isDown;
    // Ctrl/Cmd + A is reserved for selecting all units in BattleScene, so the
    // A key must not pan the camera while a modifier is held.
    const left =
      !this.modifierDown && (this.keys.left.isDown || this.keys.arrowLeft.isDown);
    const down = this.keys.down.isDown || this.keys.arrowDown.isDown;
    const up = this.keys.up.isDown || this.keys.arrowUp.isDown;

    let dx = (right ? 1 : 0) - (left ? 1 : 0);
    let dy = (down ? 1 : 0) - (up ? 1 : 0);

    if (dx === 0 && dy === 0) {
      return;
    }

    const length = Math.hypot(dx, dy);
    dx /= length;
    dy /= length;

    const step = (CAMERA_PAN_SPEED / this.camera.zoom) * (delta / 1000);
    this.camera.scrollX += dx * step;
    this.camera.scrollY += dy * step;
  }

  private updateZoom(delta: number): void {
    const difference = this.targetZoom - this.camera.zoom;

    if (Math.abs(difference) < 0.0001) {
      return;
    }

    const before = this.screenToWorld(this.anchor.x, this.anchor.y);

    const easing =
      Math.abs(difference) < 0.001 ? 1 : 1 - Math.exp(-CAMERA_ZOOM_SMOOTHING * (delta / 1000));

    const nextZoom = Phaser.Math.Linear(this.camera.zoom, this.targetZoom, easing);
    this.camera.setZoom(nextZoom);

    const after = this.screenToWorld(this.anchor.x, this.anchor.y);
    this.camera.scrollX += before.x - after.x;
    this.camera.scrollY += before.y - after.y;
  }

  private screenToWorld(screenX: number, screenY: number): Phaser.Math.Vector2 {
    const originX = this.camera.width * this.camera.originX;
    const originY = this.camera.height * this.camera.originY;

    return new Phaser.Math.Vector2(
      (screenX - originX) / this.camera.zoom + originX + this.camera.scrollX,
      (screenY - originY) / this.camera.zoom + originY + this.camera.scrollY,
    );
  }

  private clampScroll(): void {
    const viewWidth = this.camera.width / this.camera.zoom;
    const viewHeight = this.camera.height / this.camera.zoom;
    const halfWidth = this.camera.width * 0.5;
    const halfHeight = this.camera.height * 0.5;

    if (viewWidth >= WORLD_WIDTH) {
      this.camera.scrollX = WORLD_WIDTH * 0.5 - halfWidth;
    } else {
      const minimumX = (viewWidth - this.camera.width) * 0.5;
      const maximumX = WORLD_WIDTH - halfWidth - viewWidth * 0.5;
      this.camera.scrollX = Phaser.Math.Clamp(this.camera.scrollX, minimumX, maximumX);
    }

    if (viewHeight >= WORLD_HEIGHT) {
      this.camera.scrollY = WORLD_HEIGHT * 0.5 - halfHeight;
    } else {
      const minimumY = (viewHeight - this.camera.height) * 0.5;
      const maximumY = WORLD_HEIGHT - halfHeight - viewHeight * 0.5;
      this.camera.scrollY = Phaser.Math.Clamp(this.camera.scrollY, minimumY, maximumY);
    }
  }

  private onWheel(
    pointer: Phaser.Input.Pointer,
    _objects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void {
    this.anchor.set(pointer.x, pointer.y);

    const factor = deltaY > 0 ? 1 / CAMERA_ZOOM_STEP : CAMERA_ZOOM_STEP;
    this.targetZoom = Phaser.Math.Clamp(
      this.targetZoom * factor,
      CAMERA_MIN_ZOOM,
      CAMERA_MAX_ZOOM,
    );
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!pointer.middleButtonDown()) {
      return;
    }

    this.panning = true;
    this.lastPanX = pointer.x;
    this.lastPanY = pointer.y;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.panning) {
      return;
    }

    if (!pointer.middleButtonDown()) {
      this.panning = false;
      return;
    }

    this.camera.scrollX -= (pointer.x - this.lastPanX) / this.camera.zoom;
    this.camera.scrollY -= (pointer.y - this.lastPanY) / this.camera.zoom;
    this.lastPanX = pointer.x;
    this.lastPanY = pointer.y;
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.button === 1) {
      this.panning = false;
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    this.modifierDown = event.ctrlKey || event.metaKey;
  }

  private onKeyUp(event: KeyboardEvent): void {
    this.modifierDown = event.ctrlKey || event.metaKey;
  }

  private resetModifier(): void {
    this.modifierDown = false;
  }

  private destroy(): void {
    this.scene.input.keyboard?.off(
      Phaser.Input.Keyboard.Events.ANY_KEY_DOWN,
      this.onKeyDown,
      this,
    );
    this.scene.input.keyboard?.off(
      Phaser.Input.Keyboard.Events.ANY_KEY_UP,
      this.onKeyUp,
      this,
    );
    this.scene.game.events.off(Phaser.Core.Events.BLUR, this.resetModifier, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
  }
}
