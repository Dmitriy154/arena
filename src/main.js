// src/main.js
import Phaser from 'phaser';
import { gameConfig } from './config.js';
import PreloadScene from './scenes/PreloadScene.js';
import MenuScene from './scenes/MenuScene.js';  
import GameScene from './scenes/GameScene.js';

// Временно запускаем GameScene первой для теста
gameConfig.scene = [PreloadScene, GameScene, MenuScene];

// Запускаем игру
const game = new Phaser.Game(gameConfig);

// Для отладки: делаем игру доступной в консоли браузера
if (import.meta.env.DEV) {
    window.PHASER_GAME = game;
    console.log('🔧 Debug mode: game доступна как window.PHASER_GAME');
}