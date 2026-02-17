// src/objects/Enemy.js
import Phaser from 'phaser';
import { CONFIG } from '../constants.js';

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'enemy');
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        this.setCollideWorldBounds(true);
        this._randomizePosition();
        this._setupAI();
        this._setupInteraction(scene);
    }

    _randomizePosition() {
        this.x = Phaser.Math.Between(150, CONFIG.WORLD.WIDTH - 150);
        this.y = Phaser.Math.Between(150, CONFIG.WORLD.HEIGHT - 150);
    }

    _setupAI() {
        this.speedX = Phaser.Math.Between(...CONFIG.ENEMY.SPEED_RANGE);
        this.speedY = Phaser.Math.Between(...CONFIG.ENEMY.SPEED_RANGE);
        this.changeTime = this.scene.time.now + Phaser.Math.Between(1000, 3000);
    }

    _setupInteraction(scene) {
        this.setInteractive();
        this.on('pointerdown', () => {
            // Событие для GameScene: снять выделение с игрока
            this.emit('enemy-clicked');
        });
    }

    update(time) {
        if (time > this.changeTime) {
            this.speedX = Phaser.Math.Between(...CONFIG.ENEMY.SPEED_RANGE);
            this.speedY = Phaser.Math.Between(...CONFIG.ENEMY.SPEED_RANGE);
            this.changeTime = time + Phaser.Math.Between(800, 2500);
        }
        this.setVelocity(this.speedX, this.speedY);
    }

    onCollisionWithPlayer(player) {
        // Отлет врага
        const dx = this.x - player.x;
        const dy = this.y - player.y;
        const angle = Math.atan2(dy, dx);
        const force = 150;
        
        this.setVelocity(
            Math.cos(angle) * force + Phaser.Math.Between(-30, 30),
            Math.sin(angle) * force + Phaser.Math.Between(-30, 30)
        );
    }
}