import Phaser from 'phaser';
import { VIEW_HEIGHT, VIEW_WIDTH } from './game/constants';
import { BattleScene } from './game/scenes/BattleScene';
import { BootScene } from './game/scenes/BootScene';
import { MenuScene } from './game/scenes/MenuScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW_WIDTH,
  height: VIEW_HEIGHT,
  backgroundColor: '#07110c',
  render: {
    antialias: true,
    powerPreference: 'high-performance',
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
  },
  scene: [BootScene, MenuScene, BattleScene],
};

new Phaser.Game(config);
