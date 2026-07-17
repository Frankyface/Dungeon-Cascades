/**
 * The tutorial CONFIG resolver: every token resolves to its LIVE engine constant (expectations are
 * DERIVED from the same constants, so the test tracks a balance retune instead of pinning stale
 * numbers), percentages/timers format correctly, and an unknown token throws.
 */
import { COLS, MATCH_MIN, ROWS } from '../../engine/board';
import {
  ATTACK_BASE,
  AFFINITY_IMMUNE,
  AFFINITY_RESIST,
  AFFINITY_WEAK,
  CASCADE_BONUS,
  GROUP_SIZE_BONUS,
  PLAYER_MAX_HP,
} from '../../engine/combat';
import { META_SCORE_PER_ENCOUNTER_WON, META_SCORE_PER_FLOOR, META_VICTORY_BONUS, REST_HEAL_FRACTION } from '../../engine/run';
import { MOVE_TIMER_MS } from '../board/constants';
import { CONFIG_TOKENS, hasUnresolvedTokens, resolveConfigText, resolveConfigToken } from './tutorialConfig';

describe('resolveConfigToken — live engine values', () => {
  it('formats the move timer in seconds from the UI constant', () => {
    expect(resolveConfigToken('moveTimerMs')).toBe(`${MOVE_TIMER_MS / 1000} seconds`);
  });

  it('reads the board dimensions and match minimum from the board config', () => {
    expect(resolveConfigToken('boardCols')).toBe(String(COLS));
    expect(resolveConfigToken('boardRows')).toBe(String(ROWS));
    expect(resolveConfigToken('matchMin')).toBe(String(MATCH_MIN));
  });

  it('formats the group/cascade/rest bonuses as whole percentages', () => {
    expect(resolveConfigToken('groupSizeBonus')).toBe(`${Math.round(GROUP_SIZE_BONUS * 100)}%`);
    expect(resolveConfigToken('cascadeBonus')).toBe(`${Math.round(CASCADE_BONUS * 100)}%`);
    expect(resolveConfigToken('restHealPct')).toBe(`${Math.round(REST_HEAL_FRACTION * 100)}%`);
  });

  it('reads the combat scalars and affinity tiers straight from combat config', () => {
    expect(resolveConfigToken('attackBase')).toBe(String(ATTACK_BASE));
    expect(resolveConfigToken('playerMaxHp')).toBe(String(PLAYER_MAX_HP));
    expect(resolveConfigToken('affinityWeak')).toBe(String(AFFINITY_WEAK));
    expect(resolveConfigToken('affinityResist')).toBe(String(AFFINITY_RESIST));
    expect(resolveConfigToken('affinityImmune')).toBe(String(AFFINITY_IMMUNE));
  });

  it('reads the score weights from the meta config', () => {
    expect(resolveConfigToken('scorePerFloor')).toBe(String(META_SCORE_PER_FLOOR));
    expect(resolveConfigToken('scorePerEncounterWon')).toBe(String(META_SCORE_PER_ENCOUNTER_WON));
    expect(resolveConfigToken('victoryBonus')).toBe(String(META_VICTORY_BONUS));
  });

  it('throws on an unknown token (a copy typo fails fast)', () => {
    expect(() => resolveConfigToken('nonsense')).toThrow();
  });
});

describe('resolveConfigText', () => {
  it('substitutes every token in a mixed string, leaving no placeholders', () => {
    const out = resolveConfigText('A {{CONFIG:boardCols}}×{{CONFIG:boardRows}} grid, weak = ×{{CONFIG:affinityWeak}}.');
    expect(out).toBe(`A ${COLS}×${ROWS} grid, weak = ×${AFFINITY_WEAK}.`);
    expect(hasUnresolvedTokens(out)).toBe(false);
  });

  it('leaves plain text untouched', () => {
    expect(resolveConfigText('no tokens here')).toBe('no tokens here');
  });

  it('exposes every supported token name', () => {
    expect(CONFIG_TOKENS).toContain('moveTimerMs');
    expect(CONFIG_TOKENS).toContain('victoryBonus');
    expect(CONFIG_TOKENS.length).toBeGreaterThanOrEqual(15);
  });
});
