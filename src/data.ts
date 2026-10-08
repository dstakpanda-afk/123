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
export type SkillId = 'blade' | 'orbs' | 'bolt' | 'nova' | 'chain' | 'meteor' | 'heal' | 'tentacles';
export const MAX_SKILL = 5;
export const SLOT_COUNT = 3;

export interface SkillDef {
  name: string; desc: string; color: number;
  catalyst: string; evolvedName: string; evolvedDesc: string;
}
export const SKILLS: Record<SkillId, SkillDef> = {
  blade: { name: 'Rytualne Cięcie', desc: 'Półkolisty cios sztyletem ofiarnym', color: 0xff6b81, catalyst: 'k_edge', evolvedName: 'Żniwo Krwi', evolvedDesc: 'Cios dookoła z odrzutem' },
  orbs: { name: 'Oczy Starszych', desc: 'Pradawne oczy krążą wokół ciebie', color: 0xb58cff, catalyst: 'k_flame', evolvedName: 'Krąg Spojrzeń', evolvedDesc: 'Więcej, większych i płonących oczu' },
  bolt: { name: 'Szept Pustki', desc: 'Pocisk z pustki w najbliższego wroga', color: 0x4ff0d2, catalyst: 'k_arrow', evolvedName: 'Chór Pustki', evolvedDesc: 'Wachlarz przebijających szeptów' },
  nova: { name: 'Tchnienie Głębin', desc: 'Fala zimna z głębin rani i spowalnia', color: 0x7fb7ff, catalyst: 'k_frost', evolvedName: 'Otchłań', evolvedDesc: 'Większa fala, która zamraża' },
  chain: { name: 'Gwiezdny Piorun', desc: 'Piorun z gwiazd przeskakuje między wrogami', color: 0xf7e56b, catalyst: 'k_storm', evolvedName: 'Burza Gwiazd', evolvedDesc: 'Dużo więcej przeskoków' },
  meteor: { name: 'Upadek Gwiazdy', desc: 'Spadająca gwiazda z opóźnieniem', color: 0xff9a4d, catalyst: 'k_comet', evolvedName: 'Gwiezdny Kataklizm', evolvedDesc: 'Trzy gwiazdy naraz' },
  heal: { name: 'Komunia z Głębią', desc: 'Co kilka sekund leczy bohatera', color: 0x6ee79a, catalyst: 'k_life', evolvedName: 'Uczta Pradawnych', evolvedDesc: 'Leczy mocniej i rani pobliskich wrogów' },
  tentacles: { name: 'Macki z Głębi', desc: 'Macki chwytają wrogów i przyciągają ich do ciebie', color: 0xc77dff, catalyst: 'k_deep', evolvedName: 'Wielka Macka', evolvedDesc: 'Więcej macek, które spowalniają' },
};
export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];

// ---------- klasy ----------
export type ClassId = 'blood' | 'star' | 'void' | 'deep';
export interface ClassDef {
  name: string; tagline: string; desc: string; color: number;
  skill: SkillId; stats: Partial<Stats>; startNode: string;
}
export const CLASSES: Record<ClassId, ClassDef> = {
  blood: { name: 'Kultysta Krwi', tagline: 'Zakon Szkarłatnej Ofiary', desc: 'Walczy z bliska. Rany wrogów leczą jego własne.', color: 0xff4d6d, skill: 'blade', stats: { dmg: 0.1, hp: 20, steal: 0.01 }, startNode: 'w1' },
  star: { name: 'Wyznawca Gwiazd', tagline: 'Obserwatorium Czarnej Gwiazdy', desc: 'Kruchy, ale jego moce odnawiają się szybciej i sięgają dalej.', color: 0xffd36b, skill: 'chain', stats: { cdr: 0.08, area: 0.08, hp: -10 }, startNode: 'm1' },
  void: { name: 'Łowca Pustki', tagline: 'Wędrowiec między światami', desc: 'Szybki i śmiertelny z dystansu, częściej trafia krytycznie.', color: 0x3fe0c5, skill: 'bolt', stats: { speed: 0.08, crit: 0.05 }, startNode: 'l1' },
  deep: { name: 'Strażnik Głębin', tagline: 'Sługa Pradawnych', desc: 'Wytrzymały, regeneruje się. Pilnują go oczy, które nigdy nie śpią.', color: 0xa77bff, skill: 'orbs', stats: { hp: 40, regen: 0.5, armor: 1 }, startNode: 'g1' },
};
export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];

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
