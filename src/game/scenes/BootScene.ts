import Phaser from 'phaser';
import { VISION_BRUSH_SCALES, VISION_RADIUS, visionBrushKey } from '../constants';

const GRASS_TEXTURE_SIZE = 256;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.createGrassTexture();
    this.createVisionBrushTextures();
    this.scene.start('MenuScene');
  }

  /** Мягкие белые пятна разного размера: ими стирается туман вокруг отрядов. */
  private createVisionBrushTextures(): void {
    VISION_BRUSH_SCALES.forEach((scale, index) => {
      const key = visionBrushKey(index);

      if (this.textures.exists(key)) {
        return;
      }

      const radius = VISION_RADIUS * scale;
      const size = radius * 2;
      const texture = this.textures.createCanvas(key, size, size);

      if (!texture) {
        return;
      }

      const context = texture.context;
      const center = size / 2;
      const gradient = context.createRadialGradient(
        center,
        center,
        radius * 0.45,
        center,
        center,
        radius,
      );

      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.65, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);

      texture.refresh();
    });
  }

  private createGrassTexture(): void {
    if (this.textures.exists('grass')) {
      return;
    }

    const texture = this.textures.createCanvas(
      'grass',
      GRASS_TEXTURE_SIZE,
      GRASS_TEXTURE_SIZE,
    );

    if (!texture) {
      return;
    }

    const context = texture.context;
    const random = new Phaser.Math.RandomDataGenerator(['arena-grass']);
    const shades = ['#37603a', '#416e42', '#356037', '#447446', '#3a653c'];

    context.fillStyle = '#3c663d';
    context.fillRect(0, 0, GRASS_TEXTURE_SIZE, GRASS_TEXTURE_SIZE);

    for (let index = 0; index < 1700; index += 1) {
      context.fillStyle = shades[random.between(0, shades.length - 1)];
      context.fillRect(
        random.between(2, GRASS_TEXTURE_SIZE - 3),
        random.between(2, GRASS_TEXTURE_SIZE - 3),
        random.between(1, 3),
        random.between(1, 3),
      );
    }

    context.strokeStyle = 'rgba(122, 168, 108, 0.35)';
    context.lineWidth = 1;

    for (let index = 0; index < 140; index += 1) {
      const x = random.between(4, GRASS_TEXTURE_SIZE - 4);
      const y = random.between(7, GRASS_TEXTURE_SIZE - 4);

      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + random.between(-2, 2), y - random.between(3, 6));
      context.stroke();
    }

    texture.refresh();
  }
}
