export type PassiveId = 'might' | 'haste' | 'vigor' | 'boots';
export type WeaponId = 'blade' | 'orbs' | 'bolt';

export const MAX_LEVEL = 5;

export const PASSIVES: Record<PassiveId, { name: string; desc: string }> = {
  might: { name: 'Siła', desc: '+25% obrażeń' },
  haste: { name: 'Szybkość ataku', desc: '-10% czasu odnowienia' },
  vigor: { name: 'Witalność', desc: '+20 maks. HP' },
  boots: { name: 'Buty', desc: '+10% szybkości ruchu' },
};

export interface WeaponDef {
  name: string;
  desc: string;
  evolvesWith: PassiveId;
  evolvedName: string;
  evolvedDesc: string;
  color: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  blade: {
    name: 'Ostrze', desc: 'Półkolisty cios w stronę wroga', evolvesWith: 'might',
    evolvedName: 'Ostrze Burzy', evolvedDesc: 'Cios dookoła z odrzutem', color: 0xdde6ff,
  },
  orbs: {
    name: 'Kule', desc: 'Kule krążą wokół bohatera', evolvesWith: 'haste',
    evolvedName: 'Pierścień Ognia', evolvedDesc: 'Więcej, większych i szybszych kul', color: 0xffb347,
  },
  bolt: {
    name: 'Pocisk', desc: 'Strzela w najbliższego wroga', evolvesWith: 'vigor',
    evolvedName: 'Grad Strzał', evolvedDesc: 'Wachlarz przebijających pocisków', color: 0x6ee7ff,
  },
};

export interface MetaState { gold: number; hp: number; dmg: number; spd: number }
const KEY = 'evo-arpg-meta-v1';

export function loadMeta(): MetaState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { gold: 0, hp: 0, dmg: 0, spd: 0, ...JSON.parse(raw) };
  } catch { /* brak dostępu do storage */ }
  return { gold: 0, hp: 0, dmg: 0, spd: 0 };
}
export function saveMeta(m: MetaState): void {
  try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* ignoruj */ }
}
