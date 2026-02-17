// src/scenes/MenuScene.js
import Phaser from 'phaser';
import { CONFIG } from '../constants.js';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
    }

    create() {
        console.log('🎮 MenuScene: create() started');
        
        // === 1. СБРОС КАМЕРЫ (критически важно!) ===
        this.cameras.main.stopFollow(); // Отключаем слежение за игроком
        this.cameras.main.resetFX();    // Сбрасываем эффекты
        this.cameras.main.setBounds(0, 0, CONFIG.WORLD.WIDTH, CONFIG.WORLD.HEIGHT);
        this.cameras.main.centerOn(CONFIG.WORLD.WIDTH / 2, CONFIG.WORLD.HEIGHT / 2);
        this.cameras.main.setZoom(0.25); // Показываем ВЕСЬ мир сразу
        
        // === 2. ЗАЛИВКА ФОНА (на весь экран, а не мир) ===
        // Рисуем прямоугольник по размеру VIEWPORT, а не мира
        this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x0a031a, 0.98)
            .setOrigin(0)
            .setScrollFactor(0) // Не двигается при перемещении камеры!
            .setDepth(-10);     // Самый нижний слой
        
        // === 3. ЗАГОЛОВОК (по центру ВИДИМОЙ области) ===
        const title = this.add.text(
            this.cameras.main.width / 2, 
            180, 
            'SUPER GAME', 
            {
                fontSize: '72px',
                fontFamily: 'Arial, sans-serif',
                color: '#ffffff',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 8
            }
        )
        .setOrigin(0.5)
        .setScrollFactor(0) // Фиксируем относительно камеры
        .setDepth(1);
        
        // Пульсация
        this.tweens.add({
            targets: title,
            scale: { from: 1, to: 1.05 },
            yoyo: true,
            repeat: -1,
            duration: 1000,
            ease: 'Sine.easeInOut'
        });
        
        // === 4. КНОПКА START ===
        const startBtn = this.add.text(
            this.cameras.main.width / 2, 
            320, 
            '▶ НАЧАТЬ ИГРУ', 
            {
                fontSize: '36px',
                fontFamily: 'Arial, sans-serif',
                color: '#ffffff',
                backgroundColor: '#2d7a32',
                padding: { x: 40, y: 20 },
                stroke: '#1a5522',
                strokeThickness: 3
            }
        )
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0) // Фиксируем!
        .setDepth(1);
        
        // Эффекты кнопки
        startBtn.on('pointerover', () => {
            startBtn.setStyle({ backgroundColor: '#3d9a42' });
            startBtn.setScale(1.05);
        });
        startBtn.on('pointerout', () => {
            startBtn.setStyle({ backgroundColor: '#2d7a32' });
            startBtn.setScale(1);
        });
        startBtn.on('pointerdown', () => {
            console.log('🚀 MenuScene: переход в GameScene');
            this.scene.start('GameScene');
        });
        
        // === 5. КНОПКА SETTINGS ===
        const settingsBtn = this.add.text(
            this.cameras.main.width / 2, 
            410, 
            '⚙ НАСТРОЙКИ', 
            {
                fontSize: '28px',
                fontFamily: 'Arial, sans-serif',
                color: '#cccccc',
                backgroundColor: '#333333',
                padding: { x: 30, y: 15 }
            }
        )
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0)
        .setDepth(1);
        
        settingsBtn.on('pointerover', () => settingsBtn.setStyle({ color: '#ffffff' }));
        settingsBtn.on('pointerout', () => settingsBtn.setStyle({ color: '#cccccc' }));
        settingsBtn.on('pointerdown', () => {
            console.log('⚙ Settings clicked');
        });
        
        // === 6. ВЕРСИЯ ===
        this.add.text(
            this.cameras.main.width / 2, 
            this.cameras.main.height - 40, 
            'v1.0.0', 
            {
                fontSize: '16px',
                color: '#666666',
                fontFamily: 'monospace'
            }
        )
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(1);
        
        // === 7. УПРАВЛЕНИЕ КЛАВИАТУРОЙ ===
        if (this.input.keyboard) {
            this.input.keyboard.on('keydown-ENTER', () => {
                startBtn.emit('pointerdown');
            });
            this.input.keyboard.on('keydown-ESC', () => {
                console.log('ESC pressed in menu');
            });
        }
        
        console.log('✅ MenuScene: fully rendered');
        console.log('📷 Camera в MenuScene:', {
            x: this.cameras.main.x,
            y: this.cameras.main.y,
            zoom: this.cameras.main.zoom,
            scrollX: this.cameras.main.scrollX,
            scrollY: this.cameras.main.scrollY
        });
        
    }
}