// src/utils/textureGenerator.js
import Phaser from 'phaser';

export function generatePerlinGrassTexture(scene, key, size = 256) {
    const canvas = scene.textures.createCanvas(key, size, size);
    const ctx = canvas.context;
    
    // Фон
    ctx.fillStyle = '#2d7a32';
    ctx.fillRect(0, 0, size, size);
    
    // Травинки
    for (let i = 0; i < 1500; i++) {
        const x = Phaser.Math.Between(0, size - 1);
        const y = Phaser.Math.Between(0, size - 1);
        const g = Phaser.Math.Between(100, 160);
        ctx.fillStyle = `rgb(35, ${g}, 30)`;
        ctx.fillRect(x, y, 1, 1);
    }
    
    // Пятна
    for (let i = 0; i < 20; i++) {
        const x = Phaser.Math.Between(0, size);
        const y = Phaser.Math.Between(0, size);
        const radius = Phaser.Math.Between(5, 12);
        const opacity = Phaser.Math.FloatBetween(0.15, 0.25);
        
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, `rgba(50, 130, 40, ${opacity})`);
        gradient.addColorStop(1, 'rgba(50, 130, 40, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }
    
    canvas.refresh();
}