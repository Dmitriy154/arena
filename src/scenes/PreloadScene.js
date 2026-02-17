// src/scenes/PreloadScene.js
import Phaser from 'phaser'

export default class PreloadScene extends Phaser.Scene {
    constructor() {
        super('PreloadScene') // Уникальное имя сцены
    }

    preload() {
        // Имитация загрузки (полоска)
        const progressBar = this.add.graphics()
        const progressBox = this.add.graphics()
        progressBox.fillStyle(0x222222, 0.8)
        progressBox.fillRect(240, 270, 320, 50)

        this.load.on('progress', function (value) {
            progressBar.clear()
            progressBar.fillStyle(0xffffff, 1)
            progressBar.fillRect(250, 280, 300 * value, 30)
        })

        // Загружаем реальные файлы (положите их в public/assets)
        // this.load.image('player', '/assets/player.png')
    }

    create() {
        // Когда всё загрузилось, идем в Меню
        this.scene.start('MenuScene')
    }
}