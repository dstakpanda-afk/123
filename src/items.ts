import { Stats, StatKey } from './data';

export type Slot = 'weapon' | 'armor' | 'amulet' | 'ring' | 'boots';
export const SLOTS: Slot[] = ['weapon', 'armor', 'amulet', 'ring', 'boots'];
export const SLOT_NAME: Record<Slot, string> = { weapon: 'Broń', armor: 'Zbroja', amulet: 'Amulet', ring: 'Pierścień', boots: 'Buty' };
export const RARITY_NAME = ['Zwykły', 'Magiczny', 'Rzadki', 'Legendarny'];
export const RARITY_COLOR = [0xbbbbbb, 0x4da3ff, 0xffd24d, 0xff7a2f];

export interface Item { id: number; slot: Slot; rarity: 0 | 1 | 2 | 3; name: string; ilvl: number; stats: Partial<Stats> }

const BASE: Record<Slot, [StatKey, number]> = {
  weapon: ['dmg', 0.08], armor: ['hp', 15], amulet: ['crit', 0.03], ring: ['cdr', 0.03], boots: ['speed', 0.05],
};
const NOUN: Record<Slot, string[]> = {
  weapon: ['Sztylet Rytualny', 'Kostur Szeptów', 'Kosa', 'Szpon'], armor: ['Szata Kultysty', 'Skóra Głębinowca', 'Pancerz z Chityny', 'Całun'],
  amulet: ['Oko Pradawnego', 'Znak Starszych', 'Talizman'], ring: ['Sygnet Kultu', 'Pierścień Macki', 'Obrączka Szaleńca'], boots: ['Buty Wędrowca', 'Stopy Cienia', 'Sandały Mgły'],
};
const LEGEND: Record<Slot, string[]> = {
  weapon: ['Kostur Czarnej Gwiazdy', 'Dziesiąty Szept'], armor: ['Całun Śniącego', 'Skóra Bezimiennego'],
  amulet: ['Serce Gwiazdy', 'Oko Bezdennej Nocy'], ring: ['Pętla Szaleństwa', 'Pierścień Siódmej Pieczęci'], boots: ['Kroki Pomiędzy', 'Buty Wędrowca Snów'],
};
const SUFFIX = ['Szaleństwa', 'Pustki', 'Głębin', 'Krwi', 'Gwiazd', 'Cienia', 'Szeptów', 'Zagłady'];
const AFFIX: { k: StatKey; min: number; max: number }[] = [
  { k: 'dmg', min: 0.04, max: 0.12 }, { k: 'cdr', min: 0.02, max: 0.06 }, { k: 'hp', min: 8, max: 30 },
  { k: 'regen', min: 0.2, max: 0.8 }, { k: 'speed', min: 0.02, max: 0.06 }, { k: 'crit', min: 0.01, max: 0.05 },
  { k: 'critDmg', min: 0.08, max: 0.25 }, { k: 'area', min: 0.04, max: 0.12 }, { k: 'steal', min: 0.005, max: 0.015 },
  { k: 'armor', min: 1, max: 3 }, { k: 'xp', min: 0.04, max: 0.12 }, { k: 'magnet', min: 0.1, max: 0.3 },
  { k: 'gold', min: 0.05, max: 0.2 }, { k: 'drop', min: 0.04, max: 0.12 },
];
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
let uid = 1;

export function makeItem(ilvl: number, minRarity = 0, slot?: Slot): Item {
  const roll = Math.random() * 100;
  let rarity = (roll < 55 ? 0 : roll < 85 ? 1 : roll < 97 ? 2 : 3) as 0 | 1 | 2 | 3;
  if (rarity < minRarity) rarity = minRarity as 0 | 1 | 2 | 3;
  const sl = slot ?? pick(SLOTS);
  const scale = 1 + ilvl * 0.04;
  const stats: Partial<Stats> = {};
  const add = (k: StatKey, v: number) => { stats[k] = (stats[k] ?? 0) + v; };
  const [bk, bv] = BASE[sl];
  add(bk, bv * (1 + ilvl * 0.05) * (rarity === 3 ? 1.6 : 1));
  const pool = AFFIX.slice();
  for (let i = 0; i < rarity; i++) {
    const a = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    add(a.k, a.min + (a.max - a.min) * Math.random() * scale);
  }
  if (rarity === 3 && Math.random() < 0.5) add('proj', 1);
  (Object.keys(stats) as StatKey[]).forEach((k) => {
    const v = stats[k] as number;
    stats[k] = k === 'hp' || k === 'armor' ? Math.max(1, Math.round(v)) : k === 'proj' ? v : Math.round(v * 1000) / 1000;
  });
  const name = rarity === 3 ? pick(LEGEND[sl]) : `${pick(NOUN[sl])}${rarity > 0 ? ' ' + pick(SUFFIX) : ''}`;
  return { id: uid++, slot: sl, rarity, name, ilvl, stats };
}
export const sellValue = (it: Item): number => 5 + it.rarity * 15 + it.ilvl;
