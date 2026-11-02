import Phaser from 'phaser';
import { FONT_FAMILY } from '../constants';

type ButtonVariant = 'primary' | 'secondary';

interface ButtonPalette {
  fill: number;
  fillHover: number;
  stroke: number;
  strokeHover: number;
  text: string;
  textHover: string;
}

const PALETTES: Record<ButtonVariant, ButtonPalette> = {
  primary: {
    fill: 0x2a8f5c,
    fillHover: 0x34a96c,
    stroke: 0x8cf2b5,
    strokeHover: 0xc4ffdc,
    text: '#04150c',
    textHover: '#04150c',
  },
  secondary: {
    fill: 0x0d2116,
    fillHover: 0x143122,
    stroke: 0x3f7f5b,
    strokeHover: 0x8cf2b5,
    text: '#dff7e8',
    textHover: '#ffffff',
  },
};

const BUTTON_WIDTH = 320;
const BUTTON_HEIGHT = 62;

export class MenuButton extends Phaser.GameObjects.Container {
  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private readonly palette: ButtonPalette;
  private readonly onActivate: () => void;
  private pressed = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    onActivate: () => void,
    variant: ButtonVariant = 'primary',
  ) {
    super(scene, x, y);

    this.palette = PALETTES[variant];
    this.onActivate = onActivate;

    this.background = scene.add
      .rectangle(0, 0, BUTTON_WIDTH, BUTTON_HEIGHT, this.palette.fill, 1)
      .setStrokeStyle(2, this.palette.stroke, 0.9);

    const accent = scene.add
      .rectangle(-BUTTON_WIDTH / 2 + 18, 0, 3, 30, 0xffffff, variant === 'primary' ? 0.45 : 0.25)
      .setOrigin(0.5);

    this.label = scene.add
      .text(8, 0, text, {
        fontFamily: FONT_FAMILY,
        fontSize: '21px',
        fontStyle: 'bold',
        color: this.palette.text,
      })
      .setOrigin(0.5);

    this.add([this.background, accent, this.label]);
    this.setSize(BUTTON_WIDTH, BUTTON_HEIGHT);
    this.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(
        -BUTTON_WIDTH / 2,
        -BUTTON_HEIGHT / 2,
        BUTTON_WIDTH,
        BUTTON_HEIGHT,
      ),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });

    this.on(Phaser.Input.Events.POINTER_OVER, this.handlePointerOver, this);
    this.on(Phaser.Input.Events.POINTER_OUT, this.handlePointerOut, this);
    this.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
    this.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);

    scene.add.existing(this);
  }

  private handlePointerOver(): void {
    this.background.setFillStyle(this.palette.fillHover, 1);
    this.background.setStrokeStyle(2, this.palette.strokeHover, 1);
    this.label.setColor(this.palette.textHover);
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      scale: 1.035,
      duration: 130,
      ease: 'Quad.easeOut',
    });
  }

  private handlePointerOut(): void {
    this.pressed = false;
    this.background.setFillStyle(this.palette.fill, 1);
    this.background.setStrokeStyle(2, this.palette.stroke, 0.9);
    this.label.setColor(this.palette.text);
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      scale: 1,
      duration: 130,
      ease: 'Quad.easeOut',
    });
  }

  private handlePointerDown(): void {
    this.pressed = true;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      scale: 0.985,
      duration: 70,
      ease: 'Quad.easeOut',
    });
  }

  private handlePointerUp(): void {
    const wasPressed = this.pressed;
    this.pressed = false;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      scale: 1.035,
      duration: 90,
      ease: 'Quad.easeOut',
    });

    if (wasPressed) {
      this.onActivate();
    }
  }
}
