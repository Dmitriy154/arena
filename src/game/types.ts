export type UnitTypeId = 'LI' | 'HI' | 'SP' | 'AR' | 'LC' | 'HC';

export interface UnitTypeDefinition {
  id: UnitTypeId;
  label: string;
  name: string;
  color: number;
  speed: number;
}

export const UNIT_TYPES: Record<UnitTypeId, UnitTypeDefinition> = {
  LI: {
    id: 'LI',
    label: 'ЛП',
    name: 'Легкая пехота',
    color: 0x4a86e8,
    speed: 215,
  },
  HI: {
    id: 'HI',
    label: 'ТП',
    name: 'Тяжелая пехота',
    color: 0x9b59b6,
    speed: 150,
  },
  SP: {
    id: 'SP',
    label: 'КП',
    name: 'Копейщики',
    color: 0xe67e22,
    speed: 175,
  },
  AR: {
    id: 'AR',
    label: 'СТ',
    name: 'Стрелки',
    color: 0x2ecc71,
    speed: 190,
  },
  LC: {
    id: 'LC',
    label: 'ЛК',
    name: 'Легкая конница',
    color: 0x1abc9c,
    speed: 320,
  },
  HC: {
    id: 'HC',
    label: 'ТК',
    name: 'Тяжелая конница',
    color: 0xe74c3c,
    speed: 265,
  },
};
