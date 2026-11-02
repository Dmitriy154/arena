import Phaser from 'phaser';
import { COLORS, FONT_FAMILY } from '../constants';
import { UNIT_TYPES, type UnitTypeId } from '../types';
import { MenuButton } from '../ui/MenuButton';

const PREVIEW_TYPES: UnitTypeId[] = ['LI', 'HI', 'SP', 'AR'];

export class MenuScene extends Phaser.Scene {
  private starting = false;
  private notice!: Phaser.GameObjects.Text;

  constructor() {
    super('MenuScene');
  }

  create(): void {
    this.starting = false;

    const width = this.scale.width;
    const height = this.scale.height;

    this.cameras.main.setBackgroundColor(COLORS.background);
    this.cameras.main.fadeIn(280, 4, 10, 7);

    this.createBackground(width, height);
    this.createPreview(width / 2, 378);
    this.createText(width, height);

    new MenuButton(this, width / 2, 462, 'Играть', () => this.startGame(), 'primary');
    new MenuButton(this, width / 2, 542, 'Выход', () => this.exitGame(), 'secondary');

    this.notice = this.add
      .text(
        width / 2,
        628,
        'Браузер не позволяет закрыть вкладку — закройте её вручную.',
        {
          fontFamily: FONT_FAMILY,
          fontSize: '13px',
          color: '#e8b86d',
        },
      )
      .setOrigin(0.5)
      .setVisible(false);

    this.add
      .text(width - 24, height - 18, 'v0.1', {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        color: '#3f5f4c',
      })
      .setOrigin(1, 1);

    this.input.keyboard?.on('keydown-ENTER', this.startGame, this);
  }

  private createBackground(width: number, height: number): void {
    const background = this.add.graphics();
    background.fillGradientStyle(0x0e2618, 0x0e2618, 0x050e09, 0x050e09, 1);
    background.fillRect(0, 0, width, height);

    const grid = this.add.graphics();
    grid.lineStyle(1, 0x2d6b4a, 0.06);
    for (let x = 0; x <= width; x += 80) {
      grid.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y <= height; y += 80) {
      grid.lineBetween(0, y, width, y);
    }

    const glow = this.add.graphics();
    glow.fillStyle(0x2fbf71, 0.045);
    glow.fillCircle(width / 2, 270, 380);
    glow.fillStyle(0x2fbf71, 0.05);
    glow.fillCircle(width / 2, 270, 260);

    for (let radius = 130; radius <= 780; radius += 70) {
      glow.lineStyle(1, 0x3f8f66, radius % 140 === 0 ? 0.14 : 0.07);
      glow.strokeCircle(width / 2, 270, radius);
    }
  }

  private createPreview(x: number, y: number): void {
    const preview = this.add.container(x, y);
    const gap = 54;

    PREVIEW_TYPES.forEach((typeId, index) => {
      const type = UNIT_TYPES[typeId];
      const offset = (index - (PREVIEW_TYPES.length - 1) / 2) * gap;

      const square = this.add
        .rectangle(offset, 0, 36, 36, type.color, 0.95)
        .setStrokeStyle(2, 0x08110c, 0.9);

      const label = this.add
        .text(offset, 1, type.label, {
          fontFamily: FONT_FAMILY,
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#0b1a10',
          strokeThickness: 2,
        })
        .setOrigin(0.5);

      preview.add([square, label]);
    });

    this.tweens.add({
      targets: preview,
      y: y + 8,
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createText(width: number, height: number): void {
    this.add
      .text(width / 2, 232, 'ARENA', {
        fontFamily: FONT_FAMILY,
        fontSize: '112px',
        fontStyle: 'bold',
        color: '#eafff3',
      })
      .setOrigin(0.5)
      .setShadow(0, 0, '#2fbf71', 32, true, true);

    this.add
      .text(width / 2, 312, 'ТАКТИЧЕСКИЕ СРАЖЕНИЯ', {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        color: '#7fae93',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 602, 'Enter — начать игру', {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        color: '#5f8a70',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height - 18, 'Phaser 3', {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        color: '#3f5f4c',
      })
      .setOrigin(0.5, 1);
  }

  private startGame(): void {
    if (this.starting) {
      return;
    }

    this.starting = true;
    this.cameras.main.fadeOut(220, 4, 10, 7);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('BattleScene');
    });
  }

  private exitGame(): void {
    window.close();
    this.notice.setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.notice);
    this.tweens.add({
      targets: this.notice,
      alpha: 0,
      duration: 500,
      delay: 2600,
      onComplete: () => this.notice.setVisible(false),
    });
  }
}
