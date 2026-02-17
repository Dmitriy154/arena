// src/config.js
import Phaser from 'phaser';
import { CONFIG } from './constants.js';

export const gameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: true // Включите true для отладки коллизий (Показывает хитбоксы и векторы движения)
        }
    },
    // Сцены подключим в main.js
};