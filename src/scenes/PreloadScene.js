// src/scenes/PreloadScene.js
import Phaser from 'phaser';
import { generatePerlinGrassTexture } from '../utils/textureGenerator.js';

export default class PreloadScene extends Phaser.Scene {
    constructor() {
        super('PreloadScene');
    }

    preload() {
        // Генерация текстур
        generatePerlinGrassTexture(this, 'grassPattern', 256);
        
        // Генерация спрайтов программно
        this._generateSprite('player', 40, 40, 0x00ff00);
        this._generateSprite('enemy', 35, 35, 0xff5555);
        this._generateCircle('rock', 50, 50, 25, 0x7a7a7a);

        // После загрузки всех ассетов идём в меню, а не сразу в игру
        this.scene.start('MenuScene');
    }

    _generateSprite(key, width, height, color) {
        const gfx = this.add.graphics();
        gfx.fillStyle(color, 1);
        gfx.fillRect(0, 0, width, height);
        gfx.generateTexture(key, width, height);
        gfx.destroy();
    }

    _generateCircle(key, width, height, radius, color) {
        const gfx = this.add.graphics();
        gfx.fillStyle(color, 1);
        gfx.fillCircle(width/2, height/2, radius);
        gfx.generateTexture(key, width, height);
        gfx.destroy();
    }

    create() {
        this.scene.start('GameScene');
    }
}