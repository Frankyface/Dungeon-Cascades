/**
 * The Boss-Rush gate view-model: locked with progress until all five bosses are discovered, then
 * unlocked; the progress list hides undiscovered bosses and names discovered ones.
 */
import { BOSS_RUSH_ORDER, INITIAL_META_STATE, devUnlockAllMeta } from '../../engine/run';
import type { MetaState } from '../../engine/run';
import { bossRushGate } from './bossRushModel';

describe('bossRushGate', () => {
  it('is locked at 0/5 on a fresh profile, with every boss hidden', () => {
    const gate = bossRushGate(INITIAL_META_STATE);
    expect(gate.unlocked).toBe(false);
    expect(gate.discoveredCount).toBe(0);
    expect(gate.total).toBe(BOSS_RUSH_ORDER.length);
    expect(gate.label).toBe(`Bosses discovered 0/${BOSS_RUSH_ORDER.length}`);
    expect(gate.order.every((o) => !o.discovered && o.name === '???')).toBe(true);
  });

  it('shows partial progress with only the discovered bosses named', () => {
    const meta: MetaState = { ...INITIAL_META_STATE, discoveredBossIds: ['bone-colossus', 'rimeheart'] };
    const gate = bossRushGate(meta);
    expect(gate.unlocked).toBe(false);
    expect(gate.discoveredCount).toBe(2);
    expect(gate.label).toBe(`Bosses discovered 2/${BOSS_RUSH_ORDER.length}`);
    const colossus = gate.order.find((o) => o.bossId === 'bone-colossus')!;
    expect(colossus.discovered).toBe(true);
    expect(colossus.name).toContain('Bone Colossus');
    const hidden = gate.order.find((o) => !o.discovered)!;
    expect(hidden.name).toBe('???');
  });

  it('is unlocked once the profile flags it (all five discovered)', () => {
    const gate = bossRushGate(devUnlockAllMeta());
    expect(gate.unlocked).toBe(true);
    expect(gate.discoveredCount).toBe(BOSS_RUSH_ORDER.length);
    expect(gate.order.every((o) => o.discovered)).toBe(true);
  });

  it('lists the bosses in the fixed Boss-Rush order', () => {
    expect(bossRushGate(devUnlockAllMeta()).order.map((o) => o.bossId)).toEqual([...BOSS_RUSH_ORDER]);
  });
});
