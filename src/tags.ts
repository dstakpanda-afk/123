import { Arch, SKILLS, SkillId } from './data';

/** tagi gemów: rodzaj, mechanika i żywioł (do wyszukiwania i filtrów) */
export const TAG_ORDER = ['Atak', 'Aura', 'Wzmocnienie', 'Sługa', 'Pocisk', 'Obszar', 'Zwarcie', 'Łańcuch', 'Pułapka', 'Totem', 'Orbita', 'Strefa', 'Promień', 'Ogień', 'Mróz', 'Błyskawica', 'Trucizna', 'Fizyczny', 'Pustka', 'Krew', 'Gwiazdy'] as const;
export const TAG_COLOR: Record<string, number> = { Ogień: 0xff7a3d, Mróz: 0x9fd8ff, Błyskawica: 0xf7e56b, Trucizna: 0x8bd44a, Fizyczny: 0xe8dcc0, Pustka: 0xb58cff, Krew: 0xe63946, Gwiazdy: 0xfff2a8 };

const ARCH_TAGS: Record<Arch, string[]> = {
  proj: ['Pocisk'], cone: ['Pocisk', 'Zwarcie'], beam: ['Promień'], nova: ['Obszar'], blast: ['Obszar'], zone: ['Obszar', 'Strefa'], chain: ['Łańcuch'],
  arc: ['Zwarcie', 'Obszar'], orbit: ['Orbita'], boom: ['Pocisk'], home: ['Pocisk'], trap: ['Pułapka', 'Obszar'], line: ['Obszar'], ring: ['Pocisk'], totem: ['Totem'],
};
const LEGACY: Record<string, string[]> = {
  blade: ['Zwarcie', 'Obszar'], orbs: ['Orbita'], bolt: ['Pocisk'], nova: ['Obszar'], chain: ['Łańcuch'], meteor: ['Obszar'], tentacles: ['Zwarcie'],
  spikes: ['Obszar'], rift: ['Obszar', 'Strefa'], lance: ['Pocisk'], scythe: ['Pocisk'], swarm: ['Pocisk'],
};
const ELEMENTS: Record<string, string[]> = {
  Ogień: ['meteor', 'ember_bolt', 'flame_breath', 'blaze_nova', 'inferno', 'blaze_field', 'fire_chain', 'fire_orbs', 'fire_wisps', 'fire_wall', 'flame_totem', 'a_embers', 'm_bomber', 'frenzy'],
  Mróz: ['frost_shard', 'ice_ray', 'frost_nova', 'ice_comet', 'frost_field', 'frost_chain', 'frost_slash', 'frost_trap', 'ice_trail', 'frost_totem', 'a_frost', 'b_freeze', 'nova'],
  Błyskawica: ['chain', 'storm_bolt', 'shock_nova', 'haste', 'a_haste'],
  Trucizna: ['venom_dart', 'poison_pool'],
  Fizyczny: ['blade', 'spikes', 'scythe', 'thorn_burst', 'bone_shards', 'bone_nova', 'cleave', 'whirl', 'thrust', 'bone_boom', 'blade_orbit', 'mine', 'spike_trap', 'fissure', 'bone_rain', 'a_thorns', 'm_golem', 'm_servant', 'ward', 'a_guard'],
  Pustka: ['orbs', 'bolt', 'tentacles', 'rift', 'swarm', 'void_orb', 'ghost_arrow', 'void_ray', 'void_rain', 'shadow_chain', 'void_echo', 'spirits', 'm_eye', 'm_wisp', 'm_bat', 'b_phase', 'b_blink', 'a_sight'],
  Krew: ['blood_dart', 'death_ray', 'blood_rain', 'a_vamp', 'b_lifeline', 'heal', 'a_fury', 'b_berserk'],
  Gwiazdy: ['lance', 'star_nail', 'star_burst', 'sun_beam', 'chakram', 'a_greed', 'b_magnet'],
};
const elemOf: Record<string, string> = {};
Object.entries(ELEMENTS).forEach(([e, ids]) => ids.forEach((id) => { if (!elemOf[id]) elemOf[id] = e; }));

const cache = new Map<string, string[]>();
export function tagsOf(id: SkillId): string[] {
  const hit = cache.get(id);
  if (hit) return hit;
  const d = SKILLS[id], t: string[] = [];
  t.push({ attack: 'Atak', aura: 'Aura', buff: 'Wzmocnienie', minion: 'Sługa' }[d.kind]);
  if (d.arch) t.push(...ARCH_TAGS[d.arch]); else if (LEGACY[id]) t.push(...LEGACY[id]);
  if (d.kind === 'aura' && d.act) t.push('Obszar');
  if (d.kind === 'minion' && (d.mn === 'melee' || d.mn === 'swarm' || id === 'm_servant')) t.push('Zwarcie');
  if (d.kind === 'minion' && (d.mn === 'shoot' || d.mn === 'turret' || id === 'm_eye')) t.push('Pocisk');
  if (d.kind === 'minion' && d.mn === 'bomber') t.push('Obszar');
  if (elemOf[id]) t.push(elemOf[id]);
  const out = [...new Set(t)].sort((a, b) => TAG_ORDER.indexOf(a as never) - TAG_ORDER.indexOf(b as never));
  cache.set(id, out);
  return out;
}
