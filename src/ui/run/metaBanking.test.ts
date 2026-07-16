/**
 * The banking-once guard (Stage 4 meta): a terminal run must bank EXACTLY once even though its
 * outcome screen can mount / re-render / be re-visited. These tests pin the pure guard — arbitrary
 * scores (so tranche-crossing and multi-unlock are controllable) plus a real driven run to prove
 * `bankRunOnce` derives the same score the engine's `scoreForRun` reports.
 */
import {
  UNLOCK_TRANCHES,
  VARIANT_IDS,
  driveRun,
  greedyComboPath,
  scoreForRun,
  startRun,
} from '../../engine/run';
import {
  INITIAL_BANK_LEDGER,
  bankRunOnce,
  bankScoreOnce,
  runIdentity,
} from './metaBanking';

describe('runIdentity', () => {
  it('tags a vanilla run by seed with a vanilla marker', () => {
    expect(runIdentity(startRun(42))).toBe('42:vanilla');
  });

  it('includes the variant id for a variant run', () => {
    expect(runIdentity(startRun(42, 'glass-cannon'))).toBe('42:glass-cannon');
  });

  it('distinguishes two runs with different seeds', () => {
    expect(runIdentity(startRun(1))).not.toBe(runIdentity(startRun(2)));
  });
});

describe('bankScoreOnce — pure once-guarded banking', () => {
  it('banks a fresh run: score accrues and the outcome reports it', () => {
    const { ledger, outcome, didBank } = bankScoreOnce(INITIAL_BANK_LEDGER, 'run-a', 30);
    expect(didBank).toBe(true);
    expect(outcome.runScore).toBe(30);
    expect(outcome.totalScore).toBe(30);
    expect(ledger.meta.score).toBe(30);
  });

  it('is idempotent per identity: re-banking the same run does NOT advance the score', () => {
    const first = bankScoreOnce(INITIAL_BANK_LEDGER, 'run-a', 60);
    const second = bankScoreOnce(first.ledger, 'run-a', 60);

    expect(second.didBank).toBe(false);
    expect(second.outcome).toEqual(first.outcome); // same replayed outcome
    expect(second.ledger).toBe(first.ledger); // ledger untouched (same reference)
    expect(second.ledger.meta.score).toBe(60); // NOT 120 — the guard held
  });

  it('accumulates across DISTINCT runs', () => {
    const a = bankScoreOnce(INITIAL_BANK_LEDGER, 'run-a', 40);
    const b = bankScoreOnce(a.ledger, 'run-b', 25);
    expect(b.didBank).toBe(true);
    expect(b.ledger.meta.score).toBe(65);
  });

  it('reports the variant a run just unlocked (first tranche)', () => {
    const t1 = UNLOCK_TRANCHES[0];
    const { outcome } = bankScoreOnce(INITIAL_BANK_LEDGER, 'run-a', t1.score);
    expect(outcome.newlyUnlockedIds).toEqual([t1.variantId]);
    expect(outcome.meta.unlockedVariantIds).toContain(t1.variantId);
  });

  it('reports MULTIPLE variants when one run crosses several tranches at once', () => {
    const t2 = UNLOCK_TRANCHES[1];
    const { outcome } = bankScoreOnce(INITIAL_BANK_LEDGER, 'run-a', t2.score);
    expect(outcome.newlyUnlockedIds).toEqual([UNLOCK_TRANCHES[0].variantId, t2.variantId]);
  });

  it('does not re-report an already-unlocked variant on the next run', () => {
    const first = bankScoreOnce(INITIAL_BANK_LEDGER, 'run-a', UNLOCK_TRANCHES[0].score);
    const second = bankScoreOnce(first.ledger, 'run-b', 5);
    expect(second.outcome.newlyUnlockedIds).toEqual([]); // already earned; not re-announced
  });

  it('floors a negative score at 0 (never removes progress)', () => {
    const { outcome } = bankScoreOnce(INITIAL_BANK_LEDGER, 'run-a', -10);
    expect(outcome.runScore).toBe(0);
    expect(outcome.totalScore).toBe(0);
  });
});

describe('bankRunOnce — derives the run score from the terminal state', () => {
  it('banks exactly the score the engine reports for a driven run', () => {
    // Drive a real run to a terminal state, then bank it.
    const terminal = driveRun(startRun(24680), greedyComboPath).state;
    expect(terminal.status).not.toBe('active');

    const engineScore = scoreForRun(terminal);
    const { outcome, didBank } = bankRunOnce(INITIAL_BANK_LEDGER, terminal);

    expect(didBank).toBe(true);
    expect(outcome.runScore).toBe(engineScore);
    expect(outcome.totalScore).toBe(engineScore);
  });

  it('guards a re-visited outcome screen: banking the same terminal run twice is a no-op', () => {
    const terminal = driveRun(startRun(13579), greedyComboPath).state;
    const first = bankRunOnce(INITIAL_BANK_LEDGER, terminal);
    const second = bankRunOnce(first.ledger, terminal);

    expect(second.didBank).toBe(false);
    expect(second.ledger.meta.score).toBe(first.ledger.meta.score); // not doubled
  });

  it('canonical unlock order is preserved in newlyUnlockedIds', () => {
    // A synthetic score past the last tranche unlocks the whole slate in canonical order.
    const past = UNLOCK_TRANCHES[UNLOCK_TRANCHES.length - 1].score;
    const { outcome } = bankScoreOnce(INITIAL_BANK_LEDGER, 'run-a', past);
    expect(outcome.newlyUnlockedIds).toEqual([...VARIANT_IDS]);
  });
});
