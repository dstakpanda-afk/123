import { BASE_STATS, MAX_SKILL, MetaState, SKILL_IDS, SkillId, SKILLS, StatKey, Stats } from './data';
import { Item, Slot, makeItem, sellValue } from './items';
import { NODES } from './tree';

export const BAG_SIZE = 16;

export class Run {
  alloc = new Set<string>(['start']);
  points = 0;
  skills = Object.fromEntries(SKILL_IDS.map((id) => [id, { lvl: id === 'blade' ? 1 : 0, evolved: false }])) as Record<SkillId, { lvl: number; evolved: boolean }>;
  slots: (SkillId | null)[] = ['blade', null, null];
  equipped: Partial<Record<Slot, Item>> = {};
  bag: Item[] = [];
  gold = 0;
  stats: Stats = { ...BASE_STATS };
  maxHp = 100;

  constructor(public meta: MetaState) { this.recalc(); }

  recalc(): void {
    const s: Stats = { ...BASE_STATS };
    const add = (p: Partial<Stats>) => (Object.keys(p) as StatKey[]).forEach((k) => { s[k] += p[k] as number; });
    add({ dmg: 0.08 * this.meta.dmg, speed: 0.05 * this.meta.spd, hp: 10 * this.meta.hp });
    this.alloc.forEach((id) => add(NODES[id].stats));
    Object.values(this.equipped).forEach((it) => it && add(it.stats));
    s.cdr = Math.min(0.6, s.cdr); s.crit = Math.min(0.9, s.crit); s.steal = Math.min(0.15, s.steal);
    s.speed = Math.max(-0.5, s.speed); s.dmg = Math.max(-0.8, s.dmg);
    this.stats = s;
    this.maxHp = Math.max(30, 100 + s.hp);
  }

  canAlloc(id: string): boolean {
    const n = NODES[id];
    return !this.alloc.has(id) && this.points >= n.cost && n.links.some((l) => this.alloc.has(l));
  }
  allocate(id: string): boolean {
    if (!this.canAlloc(id)) return false;
    this.alloc.add(id); this.points -= NODES[id].cost; this.recalc(); return true;
  }
  respec(): void {
    this.alloc.forEach((id) => { this.points += NODES[id].cost; });
    this.alloc = new Set(['start']); this.recalc();
  }

  evolveReady(id: SkillId): boolean {
    const s = this.skills[id];
    return s.lvl >= MAX_SKILL && !s.evolved && this.alloc.has(SKILLS[id].catalyst);
  }
  /** zwraca 'new' | 'up' | 'max' */
  addSkill(id: SkillId): 'new' | 'up' | 'max' {
    const s = this.skills[id];
    if (s.lvl === 0) { s.lvl = 1; const e = this.slots.indexOf(null); if (e >= 0) this.slots[e] = id; return 'new'; }
    if (s.lvl >= MAX_SKILL) return 'max';
    s.lvl++; return 'up';
  }
  toggleSkill(id: SkillId): void {
    if (this.skills[id].lvl === 0) return;
    const i = this.slots.indexOf(id);
    if (i >= 0) { this.slots[i] = null; return; }
    const e = this.slots.indexOf(null);
    if (e >= 0) this.slots[e] = id;
    else this.slots[this.slots.length - 1] = id;
  }

  /** zwraca 'equipped' | 'bag' | 'sold' */
  addItem(it: Item): 'equipped' | 'bag' | 'sold' {
    if (!this.equipped[it.slot]) { this.equipped[it.slot] = it; this.recalc(); return 'equipped'; }
    if (this.bag.length < BAG_SIZE) { this.bag.push(it); return 'bag'; }
    this.gold += sellValue(it); return 'sold';
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
  static starter(meta: MetaState): Run { const r = new Run(meta); r.addItem(makeItem(1, 0, 'weapon')); return r; }
}
