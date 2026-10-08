export interface Stats {
  dmg: number; cdr: number; hp: number; regen: number; speed: number; crit: number; critDmg: number;
  area: number; proj: number; steal: number; armor: number; xp: number; magnet: number; gold: number; drop: number;
}
export type StatKey = keyof Stats;

export const BASE_STATS: Stats = {
  dmg: 0, cdr: 0, hp: 0, regen: 0, speed: 0, crit: 0.05, critDmg: 0.5,
  area: 0, proj: 0, steal: 0, armor: 0, xp: 0, magnet: 0, gold: 0, drop: 0,
};

const PCT: StatKey[] = ['dmg', 'cdr', 'speed', 'crit', 'critDmg', 'area', 'steal', 'xp', 'magnet', 'gold', 'drop'];
export const STAT_LABEL: Record<StatKey, string> = {
  dmg: 'Obrażenia', cdr: 'Redukcja odnowienia', hp: 'Maks. życie', regen: 'Regeneracja /s', speed: 'Szybkość ruchu',
  crit: 'Szansa na krytyk', critDmg: 'Obrażenia krytyczne', area: 'Obszar działania', proj: 'Dodatkowe pociski',
  steal: 'Kradzież życia', armor: 'Pancerz', xp: 'Zdobywane XP', magnet: 'Zasięg zbierania', gold: 'Znalezione złoto', drop: 'Szansa na łup',
};
export function fmtStat(k: StatKey, v: number): string {
  const sign = v < 0 ? '' : '+';
  if (PCT.includes(k)) return `${sign}${Math.round(v * 1000) / 10}% ${STAT_LABEL[k]}`;
  return `${sign}${Math.round(v * 10) / 10} ${STAT_LABEL[k]}`;
}
export function fmtStats(s: Partial<Stats>): string[] {
  return (Object.keys(s) as StatKey[]).filter((k) => s[k]).map((k) => fmtStat(k, s[k] as number));
}

// ---------- umiejętności (aktywne, automatyczne) ----------
export type SkillId = 'blade' | 'orbs' | 'bolt' | 'nova' | 'chain' | 'meteor' | 'heal';
export const MAX_SKILL = 5;
export const SLOT_COUNT = 3;

export interface SkillDef {
  name: string; desc: string; color: number;
  catalyst: string; evolvedName: string; evolvedDesc: string;
}
export const SKILLS: Record<SkillId, SkillDef> = {
  blade: { name: 'Ostrze', desc: 'Półkolisty cios w najbliższego wroga', color: 0xdde6ff, catalyst: 'k_edge', evolvedName: 'Ostrze Burzy', evolvedDesc: 'Cios dookoła z odrzutem' },
  orbs: { name: 'Kule', desc: 'Kule krążą wokół bohatera', color: 0xffb347, catalyst: 'k_flame', evolvedName: 'Pierścień Ognia', evolvedDesc: 'Więcej, większych kul' },
  bolt: { name: 'Pocisk', desc: 'Strzela w najbliższego wroga', color: 0x6ee7ff, catalyst: 'k_arrow', evolvedName: 'Grad Strzał', evolvedDesc: 'Wachlarz przebijających pocisków' },
  nova: { name: 'Nova Lodu', desc: 'Fala mrozu rani i spowalnia wrogów', color: 0x9fd8ff, catalyst: 'k_frost', evolvedName: 'Zimowa Pustka', evolvedDesc: 'Większa fala, która zamraża' },
  chain: { name: 'Błyskawica', desc: 'Piorun przeskakuje między wrogami', color: 0xf7e56b, catalyst: 'k_storm', evolvedName: 'Burza Piorunów', evolvedDesc: 'Dużo więcej przeskoków' },
  meteor: { name: 'Meteor', desc: 'Spadający meteor z opóźnieniem', color: 0xff6a3d, catalyst: 'k_comet', evolvedName: 'Deszcz Meteorów', evolvedDesc: 'Trzy meteory naraz' },
  heal: { name: 'Aura Życia', desc: 'Co kilka sekund leczy bohatera', color: 0x6ee79a, catalyst: 'k_life', evolvedName: 'Źródło Życia', evolvedDesc: 'Leczy mocniej i rani pobliskich wrogów' },
};
export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];

// ---------- meta-progresja ----------
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
