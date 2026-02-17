// src/scenes/GameScene.js
import Phaser from 'phaser'

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene')
    }

    create() {
        this.add.text(100, 100, 'Игрок управляет здесь', { fontSize: '20px' })
        
        // Пример: через 3 секунды переходим в GameOver (которого пока нет)
        this.time.delayedCall(3000, () => {
            alert('Время вышло! Возврат в меню.')
            this.scene.start('MenuScene')
        })
    }

    update() {
        // Логика каждый кадр (движение, стрельба)
    }
}