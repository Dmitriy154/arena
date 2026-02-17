// src/scenes/MenuScene.js
import Phaser from 'phaser';
// Если нужен CONFIG — раскомментируйте строку ниже:
// import { CONFIG } from '../constants.js';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
    }

    create() {
        console.log('🎮 MenuScene: create() started');
        
        // === 1. СБРОС КАМЕРЫ ===
        this.cameras.main.stopFollow();
        this.cameras.main.resetFX();
        this.cameras.main.setZoom(1);
        this.cameras.main.centerOn(400, 300); // Центр экрана 800×600
        
        // === 2. ФОН МЕНЮ (фиксированный, на весь экран) ===
        this.add.rectangle(0, 0, 800, 600, 0x0a031a, 0.98)
            .setOrigin(0)
            .setScrollFactor(0)  // 🔑 НЕ двигается с камерой!
            .setDepth(-10);
        
        // === 3. ЗАГОЛОВОК ===
        this.add.text(400, 150, 'SUPER GAME', {
            fontSize: '64px',
            fontFamily: 'Arial, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        })
        .setOrigin(0.5)
        .setScrollFactor(0)  // 🔑 Фиксируем относительно камеры!
        .setDepth(1);
        
        // === 4. КНОПКА START ===
        const startBtn = this.add.text(400, 300, '▶ НАЧАТЬ ИГРУ', {
            fontSize: '32px',
            fontFamily: 'Arial, sans-serif',
            color: '#ffffff',
            backgroundColor: '#2d7a32',
            padding: { x: 30, y: 15 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0)  // 🔑 Обязательно!
        .setDepth(1)
        .on('pointerover', () => {
            startBtn.setStyle({ backgroundColor: '#3d9a42' });
            startBtn.setScale(1.05);
        })
        .on('pointerout', () => {
            startBtn.setStyle({ backgroundColor: '#2d7a32' });
            startBtn.setScale(1);
        })
        .on('pointerdown', () => {
            console.log('🚀 MenuScene: переход в GameScene');
            this.scene.start('GameScene');
        });
        
        // === 5. КНОПКА SETTINGS (заглушка) ===
        const settingsBtn = this.add.text(400, 380, '⚙ НАСТРОЙКИ', {
            fontSize: '24px',
            fontFamily: 'Arial, sans-serif',
            color: '#cccccc',
            backgroundColor: '#333333',
            padding: { x: 20, y: 10 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0)
        .setDepth(1)
        .on('pointerover', () => settingsBtn.setStyle({ color: '#ffffff' }))
        .on('pointerout', () => settingsBtn.setStyle({ color: '#cccccc' }))
        .on('pointerdown', () => {
            console.log('⚙ Settings clicked (заглушка)');
        });
        
        // === 6. ВЕРСИЯ ===
        this.add.text(400, 570, 'v1.0.0', {
            fontSize: '14px',
            color: '#666666',
            fontFamily: 'monospace'
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(1);
        
        // === 7. УПРАВЛЕНИЕ КЛАВИАТУРОЙ ===
        this.input.keyboard?.on('keydown-ENTER', () => {
            startBtn.emit('pointerdown');
        });
        
        console.log('✅ MenuScene: fully rendered');
    }
}