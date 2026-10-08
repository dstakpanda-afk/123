import { BASE_STATS, CLASSES, ClassId, MAX_SKILL, SKILLS, SKILL_IDS, SUPPORT_IDS, SkillId, StatKey, Stats, SupportId, xpNeed } from './data';
import { Item, Slot, itemScore, makeItem, sellValue, syncUid } from './items';
import { CLASS_START, NODES } from './tree';

export const BAG_SIZE = 24;
export const SUPPORT_BAG = 40;
const KEY = 'szept-otchlani-save-v3';
const VERSION = 3;

export interface LoadoutSlot { skill: SkillId | null; sup: (SupportId | null)[] }
/** 3 główne ataki po 5 supportów; 3 poboczne (aury, wzmocnienia, sługi) po 2 */
export const MAIN_SLOTS = 3;
export const newLoadout = (): LoadoutSlot[] => [5, 5, 5, 2, 2, 2].map((n) => ({ skill: null, sup: new Array(n).fill(null) }));

export class Character {
  points = 0; gold = 200; runs = 0; wins = 0; level = 1; xp = 0;
  alloc = new Set<string>();
  skills = Object.fromEntries(SKILL_IDS.map((id) => [id, 0])) as Record<SkillId, number>;
  supportBag: SupportId[] = [];
  loadout = newLoadout();
  equipped: Partial<Record<Slot, Item>> = {};
  bag: Item[] = [];
  stats: Stats = { ...BASE_STATS };
  maxHp = 100;

  constructor(public cls: ClassId) { this.alloc.add(CLASS_START[cls]); }

  static create(cls: ClassId): Character {
    const c = new Character(cls);
    c.skills[CLASSES[cls].skill] = 1;
    c.loadout[0].skill = CLASSES[cls].skill;
    c.equipped.weapon = makeItem(1, 0, 'weapon');
    c.recalc();
    return c;
  }

  get startId(): string { return CLASS_START[this.cls]; }

  /** dodaje XP; zwraca liczbę zdobytych poziomów (każdy daje 1 punkt drzewka) */
  gainXp(n: number): number {
    this.xp += n;
    let gained = 0;
    while (this.xp >= xpNeed(this.level)) { this.xp -= xpNeed(this.level); this.level++; this.points++; gained++; }
    return gained;
  }

  recalc(): void {
    const s: Stats = { ...BASE_STATS };
    const add = (p: Partial<Stats>) => (Object.keys(p) as StatKey[]).forEach((k) => { s[k] += p[k] as number; });
    add(CLASSES[this.cls].stats);
    this.alloc.forEach((id) => add(NODES[id].stats));
    Object.values(this.equipped).forEach((it) => it && add(it.stats));
    s.cdr = Math.min(0.6, s.cdr); s.crit = Math.min(0.9, s.crit); s.steal = Math.min(0.15, s.steal);
    s.speed = Math.max(-0.5, s.speed); s.dmg = Math.max(-0.8, s.dmg);
    this.stats = s;
    this.maxHp = Math.max(30, 130 + s.hp);
  }

  // ---------- drzewko ----------
  /** najtańsza ścieżka od wykupionych węzłów do celu (węzły do wykupienia, w kolejności) */
  pathTo(id: string): string[] | null {
    if (this.alloc.has(id)) return [];
    const dist: Record<string, number> = {}, prev: Record<string, string> = {}, done = new Set<string>();
    this.alloc.forEach((a) => NODES[a].links.forEach((l) => {
      if (this.alloc.has(l)) return;
      const d = NODES[l].cost;
      if (dist[l] === undefined || d < dist[l]) { dist[l] = d; delete prev[l]; }
    }));
    for (;;) {
      let cur: string | null = null;
      for (const k in dist) if (!done.has(k) && (cur === null || dist[k] < dist[cur])) cur = k;
      if (cur === null) return null;
      if (cur === id) break;
      done.add(cur);
      for (const l of NODES[cur].links) {
        if (this.alloc.has(l) || done.has(l)) continue;
        const d = dist[cur] + NODES[l].cost;
        if (dist[l] === undefined || d < dist[l]) { dist[l] = d; prev[l] = cur; }
      }
    }
    const path: string[] = [];
    for (let c: string | undefined = id; c; c = prev[c]) path.unshift(c);
    return path;
  }
  pathCost(path: string[]): number { return path.reduce((a, id) => a + NODES[id].cost, 0); }
  allocatePath(path: string[]): boolean {
    if (!path.length || this.pathCost(path) > this.points) return false;
    path.forEach((id) => this.alloc.add(id));
    this.points -= this.pathCost(path);
    this.recalc(); return true;
  }
  canRefund(id: string): boolean {
    if (id === this.startId || !this.alloc.has(id)) return false;
    const seen = new Set<string>([this.startId]), q = [this.startId];
    while (q.length) {
      const x = q.pop() as string;
      for (const l of NODES[x].links) if (l !== id && this.alloc.has(l) && !seen.has(l)) { seen.add(l); q.push(l); }
    }
    return seen.size === this.alloc.size - 1;
  }
  refundCost(id: string): number { return 5 * NODES[id].cost; }
  refund(id: string): boolean {
    if (!this.canRefund(id) || this.gold < this.refundCost(id)) return false;
    this.gold -= this.refundCost(id); this.points += NODES[id].cost; this.alloc.delete(id); this.recalc(); return true;
  }
  respecCost(): number { return 4 * (this.alloc.size - 1); }
  respec(): boolean {
    if (this.gold < this.respecCost()) return false;
    this.gold -= this.respecCost();
    this.alloc.forEach((id) => { this.points += NODES[id].cost; });
    this.alloc = new Set([this.startId]); this.recalc(); return true;
  }

  // ---------- gemy ----------
  /** 'new' | 'up' | 'max' */
  addSkillGem(id: SkillId): 'new' | 'up' | 'max' {
    if (this.skills[id] === 0) {
      this.skills[id] = 1;
      const main = SKILLS[id].kind === 'attack', slot = this.loadout.find((l, i) => !l.skill && (i < MAIN_SLOTS) === main);
      if (slot) slot.skill = id;
      return 'new';
    }
    if (this.skills[id] >= MAX_SKILL) { this.gold += 20; return 'max'; }
    this.skills[id]++; return 'up';
  }
  addSupportGem(id: SupportId): 'bag' | 'sold' {
    if (this.supportBag.length >= SUPPORT_BAG) { this.gold += 15; return 'sold'; }
    this.supportBag.push(id); return 'bag';
  }
  setSkill(slot: number, id: SkillId | null): void {
    if (id && (SKILLS[id].kind === 'attack') !== (slot < MAIN_SLOTS)) return;
    if (id) this.loadout.forEach((l) => { if (l.skill === id) l.skill = null; });
    this.loadout[slot].skill = id;
  }
  setSupport(slot: number, idx: number, id: SupportId | null): void {
    const lo = this.loadout[slot], cur = lo.sup[idx];
    if (id) { const at = this.supportBag.indexOf(id); if (at < 0) return; this.supportBag.splice(at, 1); }
    if (cur) this.supportBag.push(cur);
    lo.sup[idx] = id;
  }

  // ---------- przedmioty ----------
  private pushBag(it: Item): boolean {
    if (this.bag.length < BAG_SIZE) { this.bag.push(it); return true; }
    this.gold += sellValue(it); return false;
  }
  /** zakłada lepszy przedmiot automatycznie: 'equipped' | 'bag' | 'sold' */
  addItemAuto(it: Item): 'equipped' | 'bag' | 'sold' {
    const cur = this.equipped[it.slot];
    if (!cur || itemScore(it) > itemScore(cur) * 1.05) {
      if (cur) this.pushBag(cur);
      this.equipped[it.slot] = it; this.recalc(); return 'equipped';
    }
    return this.pushBag(it) ? 'bag' : 'sold';
  }
  equip(it: Item): void {
    const cur = this.equipped[it.slot];
    this.bag = this.bag.filter((b) => b !== it);
    if (cur) this.bag.push(cur);
    this.equipped[it.slot] = it; this.recalc();
  }
  unequip(slot: Slot): boolean {
    const cur = this.equipped[slot];
    if (!cur || this.bag.length >= BAG_SIZE) return false;
    this.bag.push(cur); delete this.equipped[slot]; this.recalc(); return true;
  }
  sell(it: Item): void {
    this.gold += sellValue(it);
    this.bag = this.bag.filter((b) => b !== it);
    if (this.equipped[it.slot] === it) { delete this.equipped[it.slot]; this.recalc(); }
  }
  sellBelow(rarity: number): number {
    const sold = this.bag.filter((i) => i.rarity < rarity);
    sold.forEach((i) => { this.gold += sellValue(i); });
    this.bag = this.bag.filter((i) => i.rarity >= rarity);
    return sold.length;
  }

  // ---------- zapis ----------
  save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        v: VERSION, cls: this.cls, points: this.points, gold: this.gold, runs: this.runs, wins: this.wins, level: this.level, xp: this.xp,
        alloc: [...this.alloc], skills: this.skills, supportBag: this.supportBag, loadout: this.loadout, equipped: this.equipped, bag: this.bag,
      }));
    } catch { /* brak dostępu do storage */ }
  }
  static load(): Character | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (d.v !== VERSION || !CLASSES[d.cls as ClassId]) return null;
      const c = new Character(d.cls);
      c.points = d.points; c.gold = d.gold; c.runs = d.runs ?? 0; c.wins = d.wins ?? 0; c.level = d.level ?? 1; c.xp = d.xp ?? 0;
      c.alloc = new Set<string>([c.startId, ...(d.alloc as string[]).filter((id) => NODES[id])]);
      Object.assign(c.skills, d.skills);
      c.supportBag = (d.supportBag as SupportId[]).filter((s) => SUPPORT_IDS.includes(s));
      c.loadout = newLoadout().map((blank, i) => ({ skill: d.loadout?.[i]?.skill ?? null, sup: blank.sup.map((_, j) => d.loadout?.[i]?.sup?.[j] ?? null) }));
      c.equipped = d.equipped ?? {}; c.bag = d.bag ?? [];
      syncUid([...Object.values(c.equipped).filter((i): i is Item => !!i), ...c.bag]);
      c.recalc();
      return c;
    } catch { return null; }
  }
  static wipe(): void { try { localStorage.removeItem(KEY); } catch { /* ignoruj */ } }
}

let current: Character | null = null;
export const getChar = (): Character | null => (current ??= Character.load());
export const setChar = (c: Character | null): void => { current = c; };
