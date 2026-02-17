// src/scenes/GameScene.js
import Phaser from 'phaser';
import { CONFIG } from '../constants.js';
import Player from '../objects/Player.js';
import Enemy from '../objects/Enemy.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.collisionCount = 0;
    }

    create() {
        console.log('🌍 Создаём мир с модульной архитектурой...');
    
        // === ВАЖНО: Устанавливаем границы физики на размер ВСЕГО мира ===
        this.physics.world.setBounds(0, 0, CONFIG.WORLD.WIDTH, CONFIG.WORLD.HEIGHT);

        this._setupBackground();
        this._setupWorldBounds();
        this._setupPlayer();
        this._setupEnemies();
        this._setupRocks();
        this._setupCamera();
        this._setupCollisions();
        this._setupUI();
        this._setupInput();
    }

    _setupBackground() {
        this.background = this.add.tileSprite(
            0, 0, 
            CONFIG.WORLD.WIDTH, 
            CONFIG.WORLD.HEIGHT, 
            'grassPattern'
        ).setOrigin(0, 0);
    }

    _setupWorldBounds() {
        const { WIDTH, HEIGHT, BORDER_THICKNESS } = CONFIG.WORLD;
        
        // Массив границ: [x, y, width, height]
        const borders = [
            { x: WIDTH/2, y: BORDER_THICKNESS/2, w: WIDTH, h: BORDER_THICKNESS },       // Top
            { x: WIDTH/2, y: HEIGHT - BORDER_THICKNESS/2, w: WIDTH, h: BORDER_THICKNESS }, // Bottom
            { x: BORDER_THICKNESS/2, y: HEIGHT/2, w: BORDER_THICKNESS, h: HEIGHT },       // Left
            { x: WIDTH - BORDER_THICKNESS/2, y: HEIGHT/2, w: BORDER_THICKNESS, h: HEIGHT } // Right
        ];
        
        borders.forEach(bounds => {
            const rect = this.add.rectangle(bounds.x, bounds.y, bounds.w, bounds.h, 0x0a031a)
                .setOrigin(0.5)
                .setStrokeStyle(6, 0xff00ff);
            
            // Static body для физики (не двигается)
            this.physics.add.existing(rect, true);
        });
    }

    _setupPlayer() {
        this.player = new Player(this, 400, 300);
    }

    _setupEnemies() {
        this.enemies = this.physics.add.group();
        
        for (let i = 0; i < CONFIG.ENEMY.COUNT; i++) {
            const enemy = new Enemy(this, 300, 300);
            this.enemies.add(enemy);
            
            // Подписка на клик по врагу
            enemy.on('enemy-clicked', () => this._onEnemyClicked());
        }
    }

    _setupRocks() {
        this.rocks = this.physics.add.staticGroup();
        
        const positions = [
            {x: 400, y: 300}, {x: 1000, y: 600}, {x: 1600, y: 400},
            {x: 600, y: 1100}, {x: 1300, y: 900}, {x: 2100, y: 1300},
            {x: 800, y: 1600}, {x: 1900, y: 1100}, {x: 500, y: 800},
            {x: 2500, y: 500}, {x: 2800, y: 1800}, {x: 300, y: 2000}
        ];
        
        positions.forEach(pos => {
            this.rocks.create(pos.x, pos.y, 'rock');
        });
    }

    _setupCamera() {
        // Границы камеры = границам мира (не зависят от зума!)
        this.cameras.main.setBounds(0, 0, CONFIG.WORLD.WIDTH, CONFIG.WORLD.HEIGHT);
        
        // Плавное слежение за игроком
        this.cameras.main.startFollow(
            this.player, 
            true, 
            CONFIG.CAMERA.FOLLOW_SMOOTHING, 
            CONFIG.CAMERA.FOLLOW_SMOOTHING
        );
        
        this.cameras.main.setZoom(1);
        this.cameras.main.setRoundPixels(true); // Чёткая картинка при зуме
    }
    

    _setupCollisions() {
        // Игрок с камнями
        this.physics.add.collider(this.player, this.rocks);
        
        // Игрок с врагами
        this.physics.add.collider(
            this.player, 
            this.enemies, 
            (player, enemy) => this._onPlayerEnemyCollision(player, enemy)
        );
    }

    _setupUI() {
        this.collisionText = this.add.text(20, 20, 'Столкновений: 0', { 
            font: '24px Arial', 
            fill: '#ff5555',
            backgroundColor: '#000000aa',
            padding: { x: 10, y: 5 }
        }).setScrollFactor(0);
    }

    _setupInput() {
        // === Клик по игроку ===
        this.player.setInteractive();
        this.player.on('pointerdown', () => {
            const selected = this.player.toggleSelect();
            if (!selected) {
                this.player.targetX = null;
                this.player.targetY = null;
                this.player.setVelocity(0, 0);
            }
        });
        
        // === Клик по полю — установка цели ===
        this.input.on('pointerdown', (pointer) => {
            // Игнорируем клики по UI-элементам и интерактивным объектам
            if (pointer.targetObject && pointer.targetObject !== this.player) return;
            
            // getWorldPoint УЖЕ учитывает зум и позицию камеры!
            const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
            this.player.setTarget(worldPoint);
        });
        
        // === Плавный зум колёсиком ===
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
            // Целевой уровень зума
            const targetZoom = Phaser.Math.Clamp(
                this.cameras.main.zoom + deltaY * -0.0015, // Чувствительность
                CONFIG.CAMERA.MIN_ZOOM,
                CONFIG.CAMERA.MAX_ZOOM
            );
            
            // Плавное изменение зума камеры (200мс)
            this.cameras.main.zoomTo(targetZoom, 200, 'Linear');
            
            // Синхронное изменение масштаба фона (чтобы не «плыл»)
            this.tweens.add({
                targets: this.background,
                tileScaleX: 1 / targetZoom,
                tileScaleY: 1 / targetZoom,
                duration: 200,
                ease: 'Linear'
            });
        });
    }

    _onEnemyClicked() {
        if (this.player.getData('isSelected')) {
            this.player.toggleSelect();
            this.player.targetX = null;
            this.player.targetY = null;
            this.player.setVelocity(0, 0);
            console.log('⚠️ Клик по врагу. Выделение снято');
        }
    }

    _onPlayerEnemyCollision(player, enemy) {
        if (player.getData('isSelected')) {
            this.collisionCount++;
            console.log(`💥 СТОЛКНОВЕНИЕ #${this.collisionCount} с врагом!`);
            
            enemy.onCollisionWithPlayer(player);
            
            // Снимаем выделение
            player.toggleSelect();
            player.targetX = null;
            player.targetY = null;
            player.setVelocity(0, 0);
            
            // Обновляем UI
            this.collisionText.setText(`Столкновений: ${this.collisionCount}`);
        }
    }

    update(time, delta) {
        this.player.update();
        this.enemies.children.iterate(enemy => enemy?.update(time));
    }
}