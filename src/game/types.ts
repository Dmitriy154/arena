export type UnitTypeId = 'LI' | 'HI' | 'SP' | 'AR' | 'LC' | 'HC';

export type FactionId = 'player' | 'enemy';

/**
 * Боевые свойства отряда.
 * Единицы измерения: hp — очки, speed — пиксели мира в секунду,
 * morale — 0..100, mass — условная масса (1.0 — эталон пехоты).
 */
export interface UnitStats {
  hp: number;
  speed: number;
  morale: number;
  mass: number;
}

export interface UnitTypeDefinition {
  id: UnitTypeId;
  label: string;
  name: string;
  /** Акцентный цвет типа: тонкая полоса на юните, не путать с цветом нации. */
  color: number;
  stats: UnitStats;
}

export interface FactionDefinition {
  id: FactionId;
  name: string;
  /** Основной цвет юнитов нации. */
  color: number;
  /** Тёмный оттенок для обводки. */
  stroke: number;
  /** true — отряды управляются игроком. */
  playable: boolean;
}

export const UNIT_TYPES: Record<UnitTypeId, UnitTypeDefinition> = {
  LI: {
    id: 'LI',
    label: 'ЛП',
    name: 'Легкая пехота',
    color: 0x4a86e8,
    stats: { hp: 90, speed: 215, morale: 70, mass: 1.0 },
  },
  HI: {
    id: 'HI',
    label: 'ТП',
    name: 'Тяжелая пехота',
    color: 0x9b59b6,
    stats: { hp: 140, speed: 150, morale: 85, mass: 1.6 },
  },
  SP: {
    id: 'SP',
    label: 'КП',
    name: 'Копейщики',
    color: 0xe67e22,
    stats: { hp: 100, speed: 175, morale: 75, mass: 1.2 },
  },
  AR: {
    id: 'AR',
    label: 'СТ',
    name: 'Стрелки',
    color: 0x2ecc71,
    stats: { hp: 70, speed: 190, morale: 60, mass: 0.9 },
  },
  LC: {
    id: 'LC',
    label: 'ЛК',
    name: 'Легкая конница',
    color: 0x1abc9c,
    stats: { hp: 85, speed: 320, morale: 65, mass: 1.1 },
  },
  HC: {
    id: 'HC',
    label: 'ТК',
    name: 'Тяжелая конница',
    color: 0xe74c3c,
    stats: { hp: 160, speed: 265, morale: 80, mass: 2.0 },
  },
};

export const FACTIONS: Record<FactionId, FactionDefinition> = {
  player: {
    id: 'player',
    name: 'Империя',
    color: 0x4a86e8,
    stroke: 0x1b3f7a,
    playable: true,
  },
  enemy: {
    id: 'enemy',
    name: 'Орда',
    color: 0xc0392b,
    stroke: 0x5e1a12,
    playable: false,
  },
};
