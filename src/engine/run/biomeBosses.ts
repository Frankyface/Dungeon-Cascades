/**
 * The four Stage-6 biome bosses as data + the biome-keyed boss registry (content-biomes.md).
 *
 * Each is a `Boss` in the SAME 3-phase model as the Bone Colossus (base HP 150; phase by HP
 * fraction >0.66 / >0.33 / else; a scripted affinity shift each phase). They carry no bespoke
 * turn code — the run layer drives them through `bossEnemyForPhaseOf` + `syncBossPhase`, exactly
 * like the dungeon boss. Numbers are TRANSCRIBED VERBATIM from content-biomes.md; the fidelity
 * tests in biomeBosses.test.ts are the transcription check. Boss telegraphed nukes may exceed the
 * regular atk≤20 bound up to base 28 (decisions.md 2026-07-17 boss-exemption ruling).
 *
 * PURE ENGINE: no React / React Native imports; deterministic; never mutates input.
 */
import { AFFINITY_RESIST, AFFINITY_WEAK } from '../combat';
import type { BiomeId } from '../combat';
import { BOSS_PHASES } from './boss';
import type { Boss } from './boss';
import { BOSS_BASE_HP, BOSS_NAME } from './runConfig';

/** Every biome boss has base HP 150 (the default-dungeon Bone Colossus keeps its own 120). */
export const BIOME_BOSS_BASE_HP = 150;

/** Glacial Crypt — a shield-break survival boss; Blue shatters, Yellow light only at the end. */
export const RIMEHEART: Boss = {
  id: 'rimeheart',
  name: 'Rimeheart, the Entombed Sovereign',
  biome: 'glacial-crypt',
  baseHp: BIOME_BOSS_BASE_HP,
  phases: [
    {
      name: 'Entombed',
      affinity: { B: AFFINITY_WEAK, R: AFFINITY_RESIST },
      script: [
        { type: 'frostArmor', value: 18 },
        { type: 'attack', value: 9 },
        { type: 'attack', value: 12 },
      ],
    },
    {
      name: 'Thinning Ice',
      affinity: { B: AFFINITY_WEAK, Y: AFFINITY_RESIST },
      script: [
        { type: 'frostArmor', value: 12 },
        { type: 'attack', value: 15 },
        { type: 'charge', value: 0 },
        { type: 'attack', value: 22 },
      ],
    },
    {
      name: 'Rimeheart Exposed',
      affinity: { B: AFFINITY_WEAK, Y: AFFINITY_WEAK },
      script: [
        { type: 'charge', value: 0 },
        { type: 'attack', value: 28 },
        { type: 'attack', value: 18 },
      ],
    },
  ],
};

/** Emberworks — the answer color WALKS as the shell cracks: Blue → Red+Green → Yellow. */
export const FORGEHEART: Boss = {
  id: 'forgeheart',
  name: 'The Forgeheart',
  biome: 'emberworks',
  baseHp: BIOME_BOSS_BASE_HP,
  phases: [
    {
      name: 'Sealed Furnace',
      affinity: { B: AFFINITY_WEAK, R: AFFINITY_RESIST },
      script: [
        { type: 'attack', value: 12 },
        { type: 'armor', value: 10 },
        { type: 'attack', value: 16 },
      ],
    },
    {
      name: 'Cracked Core',
      affinity: { R: AFFINITY_WEAK, G: AFFINITY_WEAK },
      script: [
        { type: 'attack', value: 12 },
        { type: 'attack', value: 14 },
        { type: 'charge', value: 0 },
        { type: 'attack', value: 20 },
      ],
    },
    {
      name: 'Meltdown',
      affinity: { Y: AFFINITY_WEAK },
      script: [
        { type: 'attack', value: 16 },
        { type: 'attack', value: 18 },
        { type: 'attack', value: 22 },
      ],
    },
  ],
};

/** Rotwood — a regen + DoT wall that becomes a burst-race; arc R → Y → B, heal + spore. */
export const THE_ROTMOTHER: Boss = {
  id: 'the-rotmother',
  name: 'The Rotmother',
  biome: 'rotwood',
  baseHp: BIOME_BOSS_BASE_HP,
  phases: [
    {
      name: 'Bloomveil',
      affinity: { R: AFFINITY_WEAK },
      script: [
        { type: 'spore', value: 3 },
        { type: 'attack', value: 10 },
        { type: 'heal', value: 8 },
        { type: 'attack', value: 12 },
      ],
    },
    {
      name: 'Barkhardened',
      affinity: { Y: AFFINITY_WEAK, R: AFFINITY_RESIST },
      script: [
        { type: 'attack', value: 16 },
        { type: 'charge', value: 0 },
        { type: 'attack', value: 24 },
        { type: 'heal', value: 6 },
      ],
    },
    {
      name: 'Sporeburst Collapse',
      affinity: { B: AFFINITY_WEAK },
      script: [
        { type: 'spore', value: 4 },
        { type: 'attack', value: 18 },
        { type: 'attack', value: 20 },
        { type: 'spore', value: 4 },
      ],
    },
  ],
};

/** Sunken Catacombs — a tidal color-inversion puzzle (Y → B → G) with curse + self-heal. */
export const DROWNED_SOVEREIGN: Boss = {
  id: 'drowned-sovereign',
  name: 'Vael, the Drowned Sovereign',
  biome: 'sunken-catacombs',
  baseHp: BIOME_BOSS_BASE_HP,
  phases: [
    {
      name: 'The Rising Dark',
      affinity: { Y: AFFINITY_WEAK, B: AFFINITY_RESIST },
      script: [
        { type: 'attack', value: 12 },
        { type: 'curse', value: 2 },
        { type: 'heal', value: 10 },
      ],
    },
    {
      name: 'The Ebb',
      affinity: { B: AFFINITY_WEAK, Y: AFFINITY_RESIST },
      script: [
        { type: 'attack', value: 16 },
        { type: 'charge', value: 0 },
        { type: 'attack', value: 26 },
      ],
    },
    {
      name: 'The Maelstrom',
      affinity: { G: AFFINITY_WEAK },
      script: [
        { type: 'attack', value: 20 },
        { type: 'curse', value: 1 },
        { type: 'attack', value: 24 },
      ],
    },
  ],
};

/** The default-dungeon boss (Bone Colossus) as a `Boss`, reusing the existing phase data. */
export const BONE_COLOSSUS: Boss = {
  id: 'bone-colossus',
  name: BOSS_NAME,
  biome: 'dungeon',
  baseHp: BOSS_BASE_HP,
  phases: BOSS_PHASES,
};

/**
 * The boss registry keyed by biome. Boss selection by biome (wiring these into runs) is a later
 * wave — for now this is the canonical lookup; `dungeon` is the Bone Colossus (unchanged).
 */
export const BOSS_REGISTRY: Record<BiomeId, Boss> = {
  dungeon: BONE_COLOSSUS,
  'glacial-crypt': RIMEHEART,
  emberworks: FORGEHEART,
  rotwood: THE_ROTMOTHER,
  'sunken-catacombs': DROWNED_SOVEREIGN,
};

/** All bosses in biome order (dungeon first). */
export const BOSSES: readonly Boss[] = [
  BONE_COLOSSUS,
  RIMEHEART,
  FORGEHEART,
  THE_ROTMOTHER,
  DROWNED_SOVEREIGN,
];

/** Fetch a boss by biome id. Throws on an unknown biome — boundary validation. */
export function getBossForBiome(biome: BiomeId): Boss {
  const boss = BOSS_REGISTRY[biome];
  if (boss === undefined) {
    throw new Error(`getBossForBiome: no boss for biome '${biome}'`);
  }
  return boss;
}
