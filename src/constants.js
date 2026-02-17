// src/constants.js

export const GAME_STATE = {
    MENU: 'menu',
    PLAYING: 'playing', 
    PAUSED: 'paused',
    GAME_OVER: 'gameover'
};


export const CONFIG = {
    WORLD: {
        WIDTH: 3200,
        HEIGHT: 2400,
        BORDER_THICKNESS: 100
    },
    PLAYER: {
        WIDTH: 40,
        HEIGHT: 40,
        SPEED: 300,
        COLOR: 0x00ff00
    },
    ENEMY: {
        WIDTH: 35,
        HEIGHT: 35,
        COUNT: 10,
        SPEED_RANGE: [-70, 70],
        COLOR: 0xff5555
    },
    ROCK: {
        RADIUS: 25,
        COLOR: 0x7a7a7a
    },
    CAMERA: {
        MIN_ZOOM: 0.4,
        MAX_ZOOM: 2.5,
        FOLLOW_SMOOTHING: 0.1
    }
};

