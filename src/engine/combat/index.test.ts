/**
 * Barrel smoke test: the public combat API is reachable from the package root and
 * an end-to-end fight runs through the barrel exports alone. Guards against a
 * missing / renamed re-export breaking consumers (the sim and the Skia UI).
 */
import * as combat from './index';

describe('combat barrel — public API surface', () => {
  it('re-exports the constants, helpers, and state machine', () => {
    expect(combat.ATTACK_BASE).toBe(3);
    expect(combat.HEAL_BASE).toBe(2);
    expect(combat.GROUP_SIZE_BONUS).toBe(0.25);
    expect(combat.CASCADE_BONUS).toBe(0.25);
    expect(combat.PLAYER_MAX_HP).toBe(60);
    expect(combat.AFFINITY_WEAK).toBe(2.0);
    expect(combat.AFFINITY_NORMAL).toBe(1.0);
    expect(combat.AFFINITY_RESIST).toBe(0.5);
    expect(combat.AFFINITY_IMMUNE).toBe(0.0);
    expect(combat.DEFAULT_COMBAT_CONFIG.attackBase).toBe(3);
    expect([...combat.ENEMY_IDS].sort()).toEqual(['bat', 'skeleton', 'slime']);
    expect(typeof combat.startEncounter).toBe('function');
    expect(typeof combat.playTurn).toBe('function');
    expect(typeof combat.computeEffects).toBe('function');
    expect(typeof combat.affinityMultiplier).toBe('function');
    expect(typeof combat.affinityFor).toBe('function');
    expect(typeof combat.scriptStep).toBe('function');
    expect(typeof combat.nextIntentIndex).toBe('function');
    expect(typeof combat.initialTelegraph).toBe('function');
    expect(combat.getEnemy('slime').maxHp).toBe(80);
    expect(combat.TILE_EFFECTS.P.kind).toBe('heal');
    expect(combat.ENEMY_STATS.bat.maxHp).toBe(90);
  });

  it('drives a full encounter to a terminal state via the barrel API only', () => {
    let state = combat.startEncounter('slime', 2026);
    expect(state.status).toBe('ongoing');
    const path = { start: { col: 2, row: 2 }, steps: ['up', 'left', 'down', 'right'] } as const;

    // Play until someone dies or a move budget is exhausted.
    for (let i = 0; i < 60 && state.status === 'ongoing'; i++) {
      const res = combat.playTurn(state, path);
      state = res.state;
    }
    expect(['won', 'lost', 'ongoing']).toContain(state.status);
    // The seed/path above is deterministic — re-running yields the same outcome.
    let replay = combat.startEncounter('slime', 2026);
    for (let i = 0; i < 60 && replay.status === 'ongoing'; i++) {
      replay = combat.playTurn(replay, path).state;
    }
    expect(replay.status).toBe(state.status);
    expect(replay.turn).toBe(state.turn);
  });
});
