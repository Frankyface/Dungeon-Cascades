/**
 * Registry-fidelity for the entity display tables: every base enemy, every biome enemy, and every
 * boss the engine knows must resolve to a glyph + name (so the compendium never renders a blank),
 * and boss names must equal the engine's boss registry (no drift).
 */
import { BIOME_ENEMY_IDS, ENEMY_IDS, getBiomeEnemy, getEnemy } from '../../engine/combat';
import { ALL_BOSS_IDS, BOSSES } from '../../engine/run';
import {
  bossGlyph,
  bossName,
  enemyDef,
  enemyDisplayName,
  enemyGlyph,
  isBaseEnemyId,
  isBiomeEnemyId,
} from './entityPresentation';

describe('entityPresentation — enemies', () => {
  it('resolves a glyph, name, and stat block for every base enemy', () => {
    for (const id of ENEMY_IDS) {
      expect(isBaseEnemyId(id)).toBe(true);
      expect(enemyGlyph(id).length).toBeGreaterThan(0);
      expect(enemyDisplayName(id).length).toBeGreaterThan(0);
      expect(enemyDef(id)).toBe(getEnemy(id));
    }
  });

  it('resolves a glyph, name, and stat block for every biome enemy', () => {
    for (const id of BIOME_ENEMY_IDS) {
      expect(isBiomeEnemyId(id)).toBe(true);
      expect(enemyGlyph(id).length).toBeGreaterThan(0);
      expect(enemyDisplayName(id).length).toBeGreaterThan(0);
      expect(enemyDef(id)).toEqual(getBiomeEnemy(id));
    }
  });

  it('gives biome enemies human names (hyphenated id → spaced Title Case)', () => {
    expect(enemyDisplayName('permafrost-warden')).toBe('Permafrost Warden');
    expect(enemyDisplayName('corpsefire-wisp')).toBe('Corpsefire Wisp');
  });

  it('does not classify an unknown id as a known enemy', () => {
    expect(isBaseEnemyId('dragon')).toBe(false);
    expect(isBiomeEnemyId('dragon')).toBe(false);
    expect(() => enemyDef('dragon')).toThrow();
  });
});

describe('entityPresentation — bosses', () => {
  it('resolves a glyph for every boss id', () => {
    for (const id of ALL_BOSS_IDS) {
      expect(bossGlyph(id).length).toBeGreaterThan(0);
    }
  });

  it('boss names match the engine boss registry exactly', () => {
    for (const boss of BOSSES) {
      expect(bossName(boss.id)).toBe(boss.name);
    }
  });
});
