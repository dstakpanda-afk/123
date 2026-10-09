export interface Stats {
  dmg: number; cdr: number; hp: number; regen: number; speed: number; crit: number; critDmg: number;
  area: number; proj: number; steal: number; armor: number; xp: number; magnet: number; gold: number; drop: number;
}
export type StatKey = keyof Stats;

export const BASE_STATS: Stats = {
  dmg: 0, cdr: 0, hp: 0, regen: 0.4, speed: 0, crit: 0.05, critDmg: 0.5,
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

const SHORT: Record<StatKey, string> = {
  dmg: 'obrażenia', cdr: 'odnowienie', hp: 'życie', regen: 'regen./s', speed: 'szybkość', crit: 'krytyk', critDmg: 'obr. kryt.',
  area: 'obszar', proj: 'pociski', steal: 'kradz. życia', armor: 'pancerz', xp: 'XP', magnet: 'zbieranie', gold: 'złoto', drop: 'łup',
};
/** krótki zapis bonusów, np. „+10% obrażenia · +20 życie” */
export function fmtShort(s: Partial<Stats>): string {
  return (Object.keys(s) as StatKey[]).filter((k) => s[k]).map((k) => {
    const v = s[k] as number, sign = v < 0 ? '' : '+';
    return PCT.includes(k) ? `${sign}${Math.round(v * 100)}% ${SHORT[k]}` : `${sign}${Math.round(v * 10) / 10} ${SHORT[k]}`;
  }).join(' · ');
}

// ---------- gemy: ataki (sloty główne) i pomocnicze (sloty poboczne) ----------
export type SkillKind = 'attack' | 'aura' | 'buff' | 'minion';
export type SkillId =
  | 'blade' | 'orbs' | 'bolt' | 'nova' | 'chain' | 'meteor' | 'tentacles' | 'spikes' | 'rift' | 'lance' | 'scythe' | 'swarm'
  | 'heal' | 'frenzy' | 'ward' | 'haste'
  | 'a_fury' | 'a_haste' | 'a_guard' | 'a_sight'
  | 'm_eye' | 'm_servant';
export const MAX_SKILL = 5;

export interface SkillDef { name: string; desc: string; color: number; kind: SkillKind }
export const SKILLS: Record<SkillId, SkillDef> = {
  blade: { kind: 'attack', name: 'Rytualne Cięcie', desc: 'Półkolisty cios sztyletem ofiarnym', color: 0xff6b81 },
  orbs: { kind: 'attack', name: 'Oczy Starszych', desc: 'Pradawne oczy krążą wokół ciebie', color: 0xb58cff },
  bolt: { kind: 'attack', name: 'Szept Pustki', desc: 'Pocisk z pustki w najbliższego wroga', color: 0x4ff0d2 },
  nova: { kind: 'attack', name: 'Fala Koszmaru', desc: 'Fala snu rani i spowalnia wrogów dookoła', color: 0x7fb7ff },
  chain: { kind: 'attack', name: 'Gwiezdny Piorun', desc: 'Piorun z gwiazd przeskakuje między wrogami', color: 0xf7e56b },
  meteor: { kind: 'attack', name: 'Upadek Gwiazdy', desc: 'Spadająca gwiazda z opóźnieniem', color: 0xff9a4d },
  tentacles: { kind: 'attack', name: 'Macki z Głębi', desc: 'Macki chwytają wrogów i przyciągają ich do ciebie', color: 0xc77dff },
  spikes: { kind: 'attack', name: 'Kościane Kolce', desc: 'Kolce wyrastają z ziemi pod wrogami', color: 0xe8dcc0 },
  rift: { kind: 'attack', name: 'Szczelina Światów', desc: 'Pęknięcie w świecie rani wrogów w strefie przez kilka sekund', color: 0xd36bff },
  lance: { kind: 'attack', name: 'Włócznia Gwiazd', desc: 'Szybka włócznia przebija całe szeregi wrogów', color: 0xfff2a8 },
  scythe: { kind: 'attack', name: 'Kosa Żniwiarza', desc: 'Kosa leci przed siebie i wraca, tnąc w obie strony', color: 0xff5470 },
  swarm: { kind: 'attack', name: 'Rój Szeptów', desc: 'Naprowadzane widma ścigają wrogów', color: 0x6ee7ff },
  heal: { kind: 'buff', name: 'Komunia z Głębią', desc: 'Co kilka sekund leczy cię i rani pobliskich wrogów', color: 0x6ee79a },
  frenzy: { kind: 'buff', name: 'Szał Ofiarny', desc: 'Co kilka sekund: +obrażenia i +szybkość na krótko', color: 0xff6b3d },
  ward: { kind: 'buff', name: 'Tarcza Pradawnych', desc: 'Co kilka sekund: tarcza pochłaniająca obrażenia', color: 0x8fd3ff },
  haste: { kind: 'buff', name: 'Wypaczenie Czasu', desc: 'Co kilka sekund: twoje moce odnawiają się szybciej', color: 0xffe066 },
  a_fury: { kind: 'aura', name: 'Aura Furii', desc: 'Stała premia do obrażeń', color: 0xff4d6d },
  a_haste: { kind: 'aura', name: 'Aura Czasu', desc: 'Stała premia do odnowienia i szybkości ruchu', color: 0xffd36b },
  a_guard: { kind: 'aura', name: 'Aura Straży', desc: 'Stała premia do pancerza i regeneracji', color: 0xa77bff },
  a_sight: { kind: 'aura', name: 'Aura Wizji', desc: 'Stała premia do krytyków i obszaru', color: 0x3fe0c5 },
  m_eye: { kind: 'minion', name: 'Latające Oko', desc: 'Oko krąży przy tobie i strzela do wrogów', color: 0xc9a4ff },
  m_servant: { kind: 'minion', name: 'Sługa Głębin', desc: 'Sługa goni wrogów i gryzie ich', color: 0x8f6bd6 },
};
export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];
export const ATTACK_IDS = SKILL_IDS.filter((id) => SKILLS[id].kind === 'attack');
export const UTILITY_IDS = SKILL_IDS.filter((id) => SKILLS[id].kind !== 'attack');
export const KIND_NAME: Record<SkillKind, string> = { attack: 'atak', aura: 'aura', buff: 'buff', minion: 'sługa' };

// ---------- poziomy postaci ----------
/** XP potrzebne do wejścia z poziomu L na L+1 (rośnie mocno) */
export const xpNeed = (level: number): number => Math.round(30 * Math.pow(1.22, level - 1));

// ---------- tryby wypraw ----------
export type ModeId = 'quick' | 'long';
export interface ModeDef {
  name: string; desc: string; target: number; hpMul: number; dmgMul: number; xpMul: number; goldMul: number;
  eliteEvery: number; boss: boolean; size: number; ramp: number; color: number;
}
export const MODES: Record<ModeId, ModeDef> = {
  quick: { name: 'SZYBKA WYPRAWA', desc: 'ok. 1–3 min · 120 wrogów na mapie', target: 120, hpMul: 0.6, dmgMul: 0.6, xpMul: 1, goldMul: 1, eliteEvery: 30, boss: false, size: 52, ramp: 0.4, color: 0x4ade80 },
  long: { name: 'WIELKA WYPRAWA', desc: 'ok. 4–6 min · 500 wrogów i boss\ntrudniejsza, ale ×2 XP i ×3 złota', target: 500, hpMul: 1.9, dmgMul: 1.5, xpMul: 2, goldMul: 3, eliteEvery: 35, boss: true, size: 76, ramp: 0.9, color: 0xff4d6d },
};

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

// ---------- bossowie i osiągnięcia (jednorazowe punkty drzewka) ----------
export type BossMove = 'slam' | 'ring' | 'quake' | 'charge';
export interface BossDef { id: string; name: string; minLevel: number; hpMul: number; dmgMul: number; scale: number; tint: number; moves: BossMove[] }
export const BOSSES: BossDef[] = [
  { id: 'guard', name: 'Strażnik Progu', minLevel: 1, hpMul: 1, dmgMul: 1, scale: 1.7, tint: 0xff7070, moves: ['slam', 'charge'] },
  { id: 'devourer', name: 'Pożeracz Gwiazd', minLevel: 10, hpMul: 1.5, dmgMul: 1.2, scale: 1.9, tint: 0xffd36b, moves: ['ring', 'charge', 'slam'] },
  { id: 'mother', name: 'Matka Otchłani', minLevel: 20, hpMul: 2.2, dmgMul: 1.4, scale: 2.1, tint: 0xc77dff, moves: ['quake', 'ring', 'slam'] },
  { id: 'nameless', name: 'Bezimienny', minLevel: 30, hpMul: 3.2, dmgMul: 1.7, scale: 2.3, tint: 0x6ee7ff, moves: ['quake', 'ring', 'charge', 'slam'] },
];
export const BOSS_POINTS = 3;
/** pierwszy jeszcze niepokonany boss dostępny na tym poziomie, a gdy wszystkie pokonane: najwyższy dostępny */
export function pickBoss(level: number, killed: Record<string, boolean>): BossDef {
  const ok = BOSSES.filter((b) => b.minLevel <= level);
  return ok.find((b) => !killed[b.id]) ?? ok[ok.length - 1];
}

export interface Totals { kills: number; runs: number; wins: number; longWins: number; gems: number; legendary: number; maxSkill: number }
export const NO_TOTALS: Totals = { kills: 0, runs: 0, wins: 0, longWins: 0, gems: 0, legendary: 0, maxSkill: 0 };
export interface Achievement { id: string; name: string; desc: string; pts: number; goal: number; value: (t: Totals, level: number) => number }
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'kill100', name: 'Pierwsza krew', desc: 'Pokonaj 100 wrogów', pts: 1, goal: 100, value: (t) => t.kills },
  { id: 'kill1000', name: 'Żniwiarz', desc: 'Pokonaj 1000 wrogów', pts: 2, goal: 1000, value: (t) => t.kills },
  { id: 'kill5000', name: 'Plaga', desc: 'Pokonaj 5000 wrogów', pts: 3, goal: 5000, value: (t) => t.kills },
  { id: 'win1', name: 'Pierwsze zwycięstwo', desc: 'Wygraj wyprawę', pts: 1, goal: 1, value: (t) => t.wins },
  { id: 'win10', name: 'Weteran', desc: 'Wygraj 10 wypraw', pts: 2, goal: 10, value: (t) => t.wins },
  { id: 'win40', name: 'Niezłomny', desc: 'Wygraj 40 wypraw', pts: 3, goal: 40, value: (t) => t.wins },
  { id: 'long1', name: 'Zdobywca Otchłani', desc: 'Wygraj wielką wyprawę', pts: 3, goal: 1, value: (t) => t.longWins },
  { id: 'long5', name: 'Pogromca', desc: 'Wygraj 5 wielkich wypraw', pts: 3, goal: 5, value: (t) => t.longWins },
  { id: 'lvl10', name: 'Adept', desc: 'Osiągnij poziom 10', pts: 1, goal: 10, value: (_t, l) => l },
  { id: 'lvl20', name: 'Mistrz', desc: 'Osiągnij poziom 20', pts: 2, goal: 20, value: (_t, l) => l },
  { id: 'lvl30', name: 'Arcymistrz', desc: 'Osiągnij poziom 30', pts: 3, goal: 30, value: (_t, l) => l },
  { id: 'gems10', name: 'Kolekcjoner', desc: 'Znajdź 10 gemów', pts: 1, goal: 10, value: (t) => t.gems },
  { id: 'gems50', name: 'Skarbiec', desc: 'Znajdź 50 gemów', pts: 2, goal: 50, value: (t) => t.gems },
  { id: 'legend', name: 'Legenda', desc: 'Znajdź legendarny przedmiot', pts: 2, goal: 1, value: (t) => t.legendary },
  { id: 'maxgem', name: 'Wyszkolony', desc: 'Rozwiń gem do maks. poziomu', pts: 2, goal: 1, value: (t) => t.maxSkill },
];
