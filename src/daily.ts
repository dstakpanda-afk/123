/** zadania dzienne i seria logowań: powody, by wracać codziennie */
export type Track = 'kills' | 'wins' | 'runs' | 'bosses' | 'gems' | 'floors' | 'elites';
export interface QuestDef { id: string; name: string; track: Track; goal: number; gold: number; xp: number; gem?: boolean }
export const QUESTS: QuestDef[] = [
  { id: 'k150', name: 'Pokonaj 150 wrogów', track: 'kills', goal: 150, gold: 120, xp: 0.25 },
  { id: 'k400', name: 'Pokonaj 400 wrogów', track: 'kills', goal: 400, gold: 260, xp: 0.5 },
  { id: 'w1', name: 'Wygraj wyprawę', track: 'wins', goal: 1, gold: 100, xp: 0.2 },
  { id: 'w3', name: 'Wygraj 3 wyprawy', track: 'wins', goal: 3, gold: 260, xp: 0.5 },
  { id: 'r3', name: 'Odbądź 3 wyprawy', track: 'runs', goal: 3, gold: 110, xp: 0.25 },
  { id: 'b1', name: 'Pokonaj bossa', track: 'bosses', goal: 1, gold: 300, xp: 0.6, gem: true },
  { id: 'g3', name: 'Znajdź 3 gemy', track: 'gems', goal: 3, gold: 150, xp: 0.3 },
  { id: 'f3', name: 'Dotrzyj do 3. piętra (tryb wolny)', track: 'floors', goal: 3, gold: 220, xp: 0.4, gem: true },
  { id: 'e8', name: 'Pokonaj 8 elit', track: 'elites', goal: 8, gold: 170, xp: 0.35 },
];
export interface Quest { id: string; prog: number; claimed: boolean }
export interface DailyState { day: string; quests: Quest[]; streak: number; last: string; loginClaimed: boolean; shopBought: boolean }
export const newDaily = (): DailyState => ({ day: '', quests: [], streak: 0, last: '', loginClaimed: true, shopBought: false });

export interface LoginReward { gold: number; gem?: boolean; support?: boolean; item?: boolean; text: string }
export const LOGIN_REWARDS: LoginReward[] = [
  { gold: 100, text: '100 zł' },
  { gold: 150, text: '150 zł' },
  { gold: 100, gem: true, text: 'gem + 100 zł' },
  { gold: 250, text: '250 zł' },
  { gold: 150, support: true, text: 'support + 150 zł' },
  { gold: 400, text: '400 zł' },
  { gold: 600, item: true, text: 'rzadki przedmiot + 600 zł' },
];

const pad = (n: number) => String(n).padStart(2, '0');
export const todayKey = (): string => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const dayNum = (k: string): number => { const [y, m, d] = k.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };

/** zwraca true, jeśli zaczął się nowy dzień (nowe zadania, seria) */
export function refreshDaily(st: DailyState): boolean {
  const today = todayKey();
  if (st.day === today) return false;
  st.streak = st.last && dayNum(today) - dayNum(st.last) === 1 ? st.streak + 1 : 1;
  st.last = today; st.day = today; st.loginClaimed = false; st.shopBought = false;
  let seed = dayNum(today) * 2654435761 >>> 0;
  const rnd = () => { seed = (Math.imul(seed ^ (seed >>> 15), 2246822519) + 0x9e3779b9) >>> 0; return seed / 4294967296; };
  const pool = [...QUESTS].sort(() => rnd() - 0.5), used = new Set<Track>(), picked: Quest[] = [];
  for (const q of pool) { if (used.has(q.track) || picked.length >= 3) continue; used.add(q.track); picked.push({ id: q.id, prog: 0, claimed: false }); }
  st.quests = picked;
  return true;
}
