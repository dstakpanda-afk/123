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

// ---------- umiejętności aktywne (gemy) ----------
export type SkillId = 'blade' | 'orbs' | 'bolt' | 'nova' | 'chain' | 'meteor' | 'heal' | 'tentacles' | 'spikes';
export const MAX_SKILL = 5;

export interface SkillDef { name: string; desc: string; color: number }
export const SKILLS: Record<SkillId, SkillDef> = {
  blade: { name: 'Rytualne Cięcie', desc: 'Półkolisty cios sztyletem ofiarnym', color: 0xff6b81 },
  orbs: { name: 'Oczy Starszych', desc: 'Pradawne oczy krążą wokół ciebie', color: 0xb58cff },
  bolt: { name: 'Szept Pustki', desc: 'Pocisk z pustki w najbliższego wroga', color: 0x4ff0d2 },
  nova: { name: 'Fala Koszmaru', desc: 'Fala snu rani i spowalnia wrogów dookoła', color: 0x7fb7ff },
  chain: { name: 'Gwiezdny Piorun', desc: 'Piorun z gwiazd przeskakuje między wrogami', color: 0xf7e56b },
  meteor: { name: 'Upadek Gwiazdy', desc: 'Spadająca gwiazda z opóźnieniem', color: 0xff9a4d },
  heal: { name: 'Komunia z Głębią', desc: 'Leczy cię i rani pobliskich wrogów', color: 0x6ee79a },
  tentacles: { name: 'Macki z Głębi', desc: 'Macki chwytają wrogów i przyciągają ich do ciebie', color: 0xc77dff },
  spikes: { name: 'Kościane Kolce', desc: 'Kolce wyrastają z ziemi pod wrogami', color: 0xe8dcc0 },
};
export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];

// ---------- supporty ----------
export type SupportId = 'multi' | 'power' | 'swift' | 'area' | 'pierce' | 'crit' | 'vamp' | 'chill' | 'echo' | 'burn' | 'knock' | 'focus';
/** dmg, cd, area mnożą się; reszta sumuje */
export interface Mods { dmg: number; cd: number; area: number; proj: number; pierce: number; crit: number; steal: number; slow: number; burn: number; knock: number; echo: number }
export const NO_MODS: Mods = { dmg: 1, cd: 1, area: 1, proj: 0, pierce: 0, crit: 0, steal: 0, slow: 0, burn: 0, knock: 0, echo: 0 };
export interface SupportDef { name: string; short: string; desc: string; color: number; mods: Partial<Mods> }
export const SUPPORTS: Record<SupportId, SupportDef> = {
  multi: { name: 'Wielokrotność', short: 'Wk', desc: '+2 pociski/cele/oczy/cięcia. -20% obrażeń', color: 0x4ff0d2, mods: { proj: 2, dmg: 0.8 } },
  power: { name: 'Zwiększona Moc', short: 'Mc', desc: '+30% obrażeń, +10% czasu odnowienia', color: 0xff6b81, mods: { dmg: 1.3, cd: 1.1 } },
  swift: { name: 'Pośpiech', short: 'Pś', desc: '-25% czasu odnowienia, -10% obrażeń', color: 0xffd36b, mods: { cd: 0.75, dmg: 0.9 } },
  area: { name: 'Rozległość', short: 'Rz', desc: '+35% obszaru, -10% obrażeń', color: 0x7fb7ff, mods: { area: 1.35, dmg: 0.9 } },
  pierce: { name: 'Przebicie', short: 'Pb', desc: 'Pociski przebijają +2 wrogów, piorun +2 skoki', color: 0xc77dff, mods: { pierce: 2 } },
  crit: { name: 'Śmiertelny Cios', short: 'Kr', desc: '+15% szansy na krytyk, -10% obrażeń', color: 0xffe066, mods: { crit: 0.15, dmg: 0.9 } },
  vamp: { name: 'Pijawka', short: 'Pj', desc: '+4% kradzieży życia z trafień', color: 0xe63946, mods: { steal: 0.04 } },
  chill: { name: 'Mroźny Dotyk', short: 'Mr', desc: 'Trafienia spowalniają na 2 s', color: 0x9fd8ff, mods: { slow: 2 } },
  echo: { name: 'Echo', short: 'Ec', desc: 'Umiejętność powtarza się po chwili (70% obrażeń), +10% odnowienia', color: 0xb58cff, mods: { echo: 1, cd: 1.1 } },
  burn: { name: 'Podpalenie', short: 'Pd', desc: 'Trafienia podpalają: 40% obrażeń przez 3 s', color: 0xff9a4d, mods: { burn: 0.4 } },
  knock: { name: 'Odrzut', short: 'Od', desc: 'Trafienia odpychają wrogów', color: 0xe8dcc0, mods: { knock: 1 } },
  focus: { name: 'Koncentracja', short: 'Kn', desc: '+50% obrażeń, -30% obszaru, +20% odnowienia', color: 0xf1a7ff, mods: { dmg: 1.5, area: 0.7, cd: 1.2 } },
};
export const SUPPORT_IDS = Object.keys(SUPPORTS) as SupportId[];
export function combineMods(ids: (SupportId | null)[]): Mods {
  const m: Mods = { ...NO_MODS };
  for (const id of ids) {
    if (!id) continue;
    const p = SUPPORTS[id].mods;
    (Object.keys(p) as (keyof Mods)[]).forEach((k) => {
      if (k === 'dmg' || k === 'cd' || k === 'area') m[k] *= p[k] as number;
      else m[k] += p[k] as number;
    });
  }
  return m;
}

// ---------- klasy ----------
export type ClassId = 'star' | 'dream' | 'void' | 'deep' | 'bone' | 'blood';
export interface ClassDef {
  name: string; tagline: string; desc: string; color: number;
  skill: SkillId; stats: Partial<Stats>; region: string;
}
export const CLASSES: Record<ClassId, ClassDef> = {
  blood: { name: 'Kultysta Krwi', tagline: 'Zakon Szkarłatnej Ofiary', desc: 'Walczy z bliska. Rany wrogów leczą jego własne.', color: 0xff4d6d, skill: 'blade', stats: { dmg: 0.1, hp: 20, steal: 0.01 }, region: 'Krew' },
  star: { name: 'Wyznawca Gwiazd', tagline: 'Obserwatorium Czarnej Gwiazdy', desc: 'Kruchy, lecz jego moce odnawiają się szybciej i sięgają dalej.', color: 0xffd36b, skill: 'chain', stats: { cdr: 0.08, area: 0.08, hp: -10 }, region: 'Gwiazdy' },
  void: { name: 'Łowca Pustki', tagline: 'Wędrowiec między światami', desc: 'Szybki i śmiertelny z dystansu, częściej trafia krytycznie.', color: 0x3fe0c5, skill: 'bolt', stats: { speed: 0.08, crit: 0.05 }, region: 'Pustka' },
  deep: { name: 'Strażnik Głębin', tagline: 'Sługa Pradawnych', desc: 'Wytrzymały i regeneruje się. Chwyta wrogów mackami.', color: 0xa77bff, skill: 'tentacles', stats: { hp: 40, regen: 0.5, armor: 1 }, region: 'Głębia' },
  dream: { name: 'Śniący', tagline: 'Podróżnik po cudzych koszmarach', desc: 'Szybki, uczy się szybciej. Usypia i spowalnia wrogów.', color: 0x6ec6ff, skill: 'nova', stats: { speed: 0.04, cdr: 0.04, xp: 0.08 }, region: 'Sny' },
  bone: { name: 'Kościany Kapłan', tagline: 'Opiekun Pochowanych', desc: 'Pancerz z kości i kolce z ziemi. Trudny do zabicia.', color: 0xe8dcc0, skill: 'spikes', stats: { armor: 2, dmg: 0.06, regen: 0.3 }, region: 'Kości' },
};
export const CLASS_IDS: ClassId[] = ['blood', 'star', 'void', 'deep', 'dream', 'bone'];
