// src/scenes/MenuScene.js
import Phaser from 'phaser'

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene')
    }

    create() {
        this.add.text(400, 200, 'СУПЕР ИГРА', { fontSize: '64px' }).setOrigin(0.5)

        const startBtn = this.add.text(400, 400, 'НАЧАТЬ', { 
            fontSize: '32px', 
            backgroundColor: '#ff0000',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive()

        // Клик по кнопке запускает сцену игры
        startBtn.on('pointerdown', () => {
            this.scene.start('GameScene')
        })
    }
}