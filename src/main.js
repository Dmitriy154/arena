// src/main.js
import Phaser from 'phaser'

// ИМПОРТ наших сцен из отдельных файлов
import PreloadScene from './scenes/PreloadScene'
import MenuScene from './scenes/MenuScene'
import GameScene from './scenes/GameScene'

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    // Вставляем классы сцен в массив
    scene: [PreloadScene, MenuScene, GameScene] 
}

const game = new Phaser.Game(config)