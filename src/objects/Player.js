// src/objects/Player.js
import Phaser from 'phaser';
import { CONFIG } from '../constants.js';

export default class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'player');
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        this.setCollideWorldBounds(true);
        this.setData('isSelected', false);
        
        // Рамка выделения
        this.border = scene.add.rectangle(0, 0, 52, 52, 0x000000, 0)
            .setOrigin(0.5)
            .setStrokeStyle(3, 0xffffff)
            .setVisible(false)
            .setDepth(1);
        
        this.targetX = null;
        this.targetY = null;
    }

    update() {
        this._updateBorder();
        this._handleMovement();
    }

    _updateBorder() {
        if (this.border?.visible) {
            this.border.x = this.x;
            this.border.y = this.y;
        }
    }

    _handleMovement() {
        if (this.getData('isSelected') && this.targetX !== null) {
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Уменьшили порог остановки с 15 до 5 для точности
            if (distance > 5) {
                const targetSpeedX = (dx / distance) * CONFIG.PLAYER.SPEED;
                const targetSpeedY = (dy / distance) * CONFIG.PLAYER.SPEED;
                
                this.setVelocity(
                    Phaser.Math.Linear(this.body.velocity.x, targetSpeedX, 0.1),
                    Phaser.Math.Linear(this.body.velocity.y, targetSpeedY, 0.1)
                );
            } else {
                this.setVelocity(0, 0);
                this.targetX = null;
                this.targetY = null;
                console.log('🏁 Цель достигнута!');
            }
        } else {
            // Плавная остановка
            this.setVelocity(
                Phaser.Math.Linear(this.body.velocity.x, 0, 0.1),
                Phaser.Math.Linear(this.body.velocity.y, 0, 0.1)
            );
        }
    }

    toggleSelect() {
        const selected = !this.getData('isSelected');
        this.setData('isSelected', selected);
        this.border.setVisible(selected);
        return selected;
    }

    setTarget(worldPoint) {
        if (!this.getData('isSelected')) return;
        
        // Отступ от границ мира (половина размера игрока)
        const padding = CONFIG.PLAYER.WIDTH / 2;
        
        // КЛАМПИМ по ВСЕМУ МИРУ, а не по видимой области!
        this.targetX = Phaser.Math.Clamp(
            worldPoint.x, 
            padding, 
            CONFIG.WORLD.WIDTH - padding
        );
        this.targetY = Phaser.Math.Clamp(
            worldPoint.y, 
            padding, 
            CONFIG.WORLD.HEIGHT - padding
        );
        
        console.log(`📍 Цель: (${this.targetX.toFixed(0)}, ${this.targetY.toFixed(0)})`);
        console.log('🎯 setTarget:', {
            raw: worldPoint,
            clamped: { x: this.targetX, y: this.targetY },
            playerPos: { x: this.x, y: this.y }
        });
    }

    destroy(fromScene) {
        this.border?.destroy();
        super.destroy(fromScene);
    }
}