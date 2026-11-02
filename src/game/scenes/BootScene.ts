import Phaser from 'phaser';

const GRASS_TEXTURE_SIZE = 256;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.createGrassTexture();
    this.scene.start('MenuScene');
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
