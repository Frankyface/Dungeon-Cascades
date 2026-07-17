/**
 * The How-to-Play copy (spec §5), transcribed from `content-tutorial.md` into STRUCTURED sections
 * (headings, paragraphs, bullet/step lists, formula blocks, callouts, tables) — not a raw markdown
 * dump. Live settings are left as `{{CONFIG:name}}` tokens that `tutorialConfig.resolveConfigText`
 * substitutes at render time, so the guide never goes stale; the doc-only `[bracket]` annotations
 * from the source are dropped (the resolver now provides the real value).
 *
 * Pure data — no React imports. `tutorialContent.test.ts` asserts every token here resolves.
 */

/** One renderable block within a section. */
export type TutorialBlock =
  | { readonly kind: 'paragraph'; readonly text: string }
  | { readonly kind: 'heading'; readonly text: string }
  | { readonly kind: 'bullets'; readonly items: readonly string[] }
  | { readonly kind: 'steps'; readonly items: readonly string[] }
  | { readonly kind: 'formula'; readonly text: string }
  | { readonly kind: 'callout'; readonly text: string }
  | { readonly kind: 'table'; readonly headers: readonly string[]; readonly rows: readonly (readonly string[])[] };

/** One numbered How-to-Play section. */
export interface TutorialSection {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly blocks: readonly TutorialBlock[];
}

/** The opening lines above the numbered sections. */
export const TUTORIAL_INTRO: readonly string[] = [
  'Match-3 is the fight. Every gem you clear is a blow landed, a wound healed, or a cascade that turns one good move into a devastating one. Luck fills the board — you decide what happens next.',
  'Every number below is the game’s live setting, read straight from the engine — so this guide never goes stale.',
];

/** The closing line below the sections. */
export const TUTORIAL_OUTRO =
  'Skill comes from engineering cascades. Everything else — the drag, the build, the route — is how you turn a lucky board into a certain kill.';

export const TUTORIAL_SECTIONS: readonly TutorialSection[] = [
  {
    id: 'move',
    number: 1,
    title: 'The Move — one tile, one drag, {{CONFIG:moveTimerMs}}',
    blocks: [
      {
        kind: 'paragraph',
        text: 'The board is a {{CONFIG:boardCols}}×{{CONFIG:boardRows}} grid of colored gems: Red, Green, Blue, Yellow (the four damage colors) and Purple (heal).',
      },
      {
        kind: 'steps',
        items: [
          'Press and hold any gem to pick it up.',
          'Drag it through the grid, one step at a time — up, down, left, or right. Diagonals aren’t allowed.',
          'Each step swaps your held gem with the neighbor it moves into. You can snake all over the board, re-arranging a whole region in a single move.',
          'Let go to lock it in. Matches resolve, then it’s the enemy’s turn.',
        ],
      },
      {
        kind: 'callout',
        text: 'The clock. You get about {{CONFIG:moveTimerMs}} — but it doesn’t start when you pick a gem up. It starts the instant the gem first moves. Take your time planning where to grab; the pressure only begins once you commit to dragging.',
      },
      {
        kind: 'paragraph',
        text: 'That gap — free planning, timed execution — is the skill. The board is the same for anyone; the difference is what you see in it.',
      },
    ],
  },
  {
    id: 'cascades',
    number: 2,
    title: 'Matches, Combos & Cascades — the damage math',
    blocks: [
      {
        kind: 'paragraph',
        text: 'A match is {{CONFIG:matchMin}} or more gems of the same color in a row or column. Every match of a damage color clears and deals damage. A match of Purple clears and heals you instead.',
      },
      { kind: 'paragraph', text: 'Three things stack your damage:' },
      {
        kind: 'bullets',
        items: [
          'Bigger groups hit harder. Every gem beyond the third in a group adds +{{CONFIG:groupSizeBonus}} to that group. A 3-gem match is the base; a 4-gem match is ×1.25; a 5-gem match is ×1.5.',
          'Cascades multiply the whole move. When gems clear, the ones above fall to fill the gaps — and if that creates new matches, they clear too. Each extra combo beyond the first adds +{{CONFIG:cascadeBonus}} to the entire move.',
          'Affinity doubles or halves each group depending on the enemy’s weakness.',
        ],
      },
      { kind: 'heading', text: 'The formula, plainly' },
      { kind: 'formula', text: 'group damage = {{CONFIG:attackBase}} × size bonus × affinity' },
      { kind: 'paragraph', text: 'where size bonus = 1 + {{CONFIG:groupSizeBonus}} × (group size − {{CONFIG:matchMin}}).' },
      { kind: 'paragraph', text: 'Add up every group, then multiply the total by the cascade multiplier:' },
      { kind: 'formula', text: 'cascade multiplier = 1 + {{CONFIG:cascadeBonus}} × (total combos − 1)' },
      { kind: 'formula', text: 'final damage = round( (sum of all group damage) × cascade multiplier )' },
      {
        kind: 'callout',
        text: 'The rounding happens only once, at the very end. Groups are summed and cascade-multiplied at full precision, then the final total is rounded a single time. (Purple healing is totaled and rounded the same way, separately.)',
      },
      { kind: 'heading', text: 'Worked example' },
      { kind: 'paragraph', text: 'Say your drag sets off two waves against a slime that’s weak to Red:' },
      {
        kind: 'bullets',
        items: [
          'Wave 1: a match of 4 Red gems clears. Slime is weak to Red, so affinity = ×{{CONFIG:affinityWeak}}. → 3 × 1.25 × 2 = 7.5',
          'Wave 2 (cascade): gems fall and form a match of 3 Green. Slime is normal to Green, so affinity = ×1. → 3 × 1.0 × 1 = 3.0',
        ],
      },
      {
        kind: 'paragraph',
        text: 'That was 2 combos, so the cascade multiplier is ×1.25. (7.5 + 3.0) × 1.25 = 13.125 → 13 damage. The game always sums first and rounds last, so 13 is what lands.',
      },
      {
        kind: 'paragraph',
        text: 'Your starting HP pool is {{CONFIG:playerMaxHp}}, so learning to chain cascades is the difference between trading blows and ending fights in one turn.',
      },
    ],
  },
  {
    id: 'affinity',
    number: 3,
    title: 'Affinity — hit them where it hurts',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Every enemy has an affinity table. When a damage color lands, it’s multiplied by that enemy’s affinity to the color:',
      },
      {
        kind: 'table',
        headers: ['Affinity', 'Multiplier', 'Meaning'],
        rows: [
          ['Weak', '×{{CONFIG:affinityWeak}}', 'Double damage — the color to aim for'],
          ['Normal', '×1', 'No change (any color not listed)'],
          ['Resist', '×{{CONFIG:affinityResist}}', 'Half damage — avoid leaning on it'],
          ['Immune', '×{{CONFIG:affinityImmune}}', 'No damage at all'],
        ],
      },
      {
        kind: 'paragraph',
        text: 'Read the enemy before you plan your drag. A skeleton that resists Red but is weak to Blue rewards a Blue-focused move and punishes a Red one — the same gems can do quadruple the work depending on which color you build. Purple (heal) ignores affinity entirely; it always mends you.',
      },
    ],
  },
  {
    id: 'telegraph',
    number: 4,
    title: 'Telegraph Trust — what you see is what fires',
    blocks: [
      { kind: 'paragraph', text: 'Above every enemy is a telegraph showing exactly what it will do on its next turn:' },
      {
        kind: 'bullets',
        items: [
          '⚔ 8 — it will attack for 8.',
          '⚡ charge — it’s winding up. No damage this turn, but a bigger hit is coming (skeletons go ⚔ 8 → ⚡ charge → ⚔ 16).',
          '✚ heal 8 — it will heal itself for 8.',
        ],
      },
      {
        kind: 'callout',
        text: 'The telegraph is a promise. What you see is exactly what fires. No hidden dice, no surprise crits. This holds even for bosses on the turn they change phase — the telegraph updates to the new phase’s true opening move before it happens, never after.',
      },
      {
        kind: 'paragraph',
        text: 'Trust it, and you can plan several turns ahead: race a healer, tank a small hit to set up a cascade, or burst a boss before its charged blow lands.',
      },
    ],
  },
  {
    id: 'relics',
    number: 5,
    title: 'Relics & Drafting — build your run',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Relics are permanent passive powers you collect during a run. After winning fights you draft one from a small offer; shops sell relics and healing for gold. The more relics you stack, the more your build takes shape.',
      },
      {
        kind: 'paragraph',
        text: 'Relics come in three rarities — common, epic, legendary. Rarer relics are stronger or stranger, and show up less often in drafts and shops (rarity also shifts the Altar’s odds). Your base set is always available; the rest are unlocked through play.',
      },
      { kind: 'heading', text: 'How relic effects stack' },
      {
        kind: 'paragraph',
        text: 'Multiple relics that touch the same thing combine in one fixed order: all the flat additions happen first, then all the percentage multipliers.',
      },
      { kind: 'formula', text: 'result = (base value + every +flat) × every (1 + percentage)' },
      {
        kind: 'paragraph',
        text: 'So +2 flat damage and +50% to Red combine as (base + 2) × 1.5 — never the other way around. Flat bonuses matter most on small hits; percentage bonuses reward the big cascades you’re already building. Relics key off a color, a combo count, combat start, each turn, gold earned, and more.',
      },
    ],
  },
  {
    id: 'map',
    number: 6,
    title: 'The Map — choose your road',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Each act is a branching map climbed one floor at a time. You always take one node per floor, and forks let you choose your route. Every path is guaranteed at least one Rest and ends at the boss.',
      },
      {
        kind: 'bullets',
        items: [
          '⚔ Fight — a standard enemy encounter. Win to draft a relic.',
          '☠ Elite — a tougher, scaled-up enemy for a richer reward. More risk, more payoff.',
          '🛒 Shop — spend gold on relics or healing.',
          '❓ Event — a choice, sometimes a gamble, for gold, HP, or a relic.',
          '🔥 Rest — heal {{CONFIG:restHealPct}} of your max HP, once. Bank it before a boss.',
          '⛧ Altar — a fateful choice (see below).',
          '👑 Boss — the floor’s end: a 3-phase foe that shifts its affinity and script as its HP drops.',
        ],
      },
      {
        kind: 'paragraph',
        text: 'Route strategy: plan your line before you climb. Weigh Elites (power now, danger now) against safer Fights, and make sure a Rest sits between you and the boss when your HP is thin.',
      },
      { kind: 'heading', text: '⛧ The Altar — sacrifice for permanence' },
      {
        kind: 'paragraph',
        text: 'The Altar offers one choice: sacrifice the run. The run ends immediately (it counts as a defeat for scoring — but the score you’ve banked so far still counts), and in exchange you permanently unlock a brand-new relic. That relic joins your pool for every future run.',
      },
      {
        kind: 'paragraph',
        text: 'The deeper you are, the rarer the reward. An Altar late in Act 2 is far more likely to hand you an epic or legendary than one early in Act 1. Sometimes the best move for your next run is to end this one.',
      },
    ],
  },
  {
    id: 'acts',
    number: 7,
    title: 'Acts & Biomes — two dungeons, one run',
    blocks: [
      { kind: 'paragraph', text: 'A full run is two acts.' },
      {
        kind: 'bullets',
        items: [
          'Act 1 is always the Dungeon — slimes, skeletons, and bats, capped by the Bone Colossus.',
          'Act 2 is always a different biome, drawn from the ones you’ve unlocked. There are four to discover, each with its own theme, four enemies, a 3-phase boss, and its own legendary relics.',
        ],
      },
      {
        kind: 'paragraph',
        text: 'After you fell the Act 1 boss you catch your breath (a bit of healing) and drop into a second 13-floor map in the new biome. The difficulty curve keeps climbing — Act 2 tests the build you assembled in Act 1. Beating the Act 2 boss wins the run. Dying anywhere ends it.',
      },
      {
        kind: 'paragraph',
        text: 'The first time Act 2 lands you in a new biome, that biome is permanently unlocked: all its compendium entries reveal, and its legendary biome relic enters your pool.',
      },
    ],
  },
  {
    id: 'death',
    number: 8,
    title: 'Death, Score & Unlocks',
    blocks: [
      {
        kind: 'callout',
        text: 'Death. If your HP reaches 0 — in any fight, in any act — the run is over. There’s no revive. But a lost run is never wasted.',
      },
      { kind: 'paragraph', text: 'Score banks every run, win or lose:' },
      {
        kind: 'formula',
        text: 'score = (deepest floor × {{CONFIG:scorePerFloor}}) + (encounters won × {{CONFIG:scorePerEncounterWon}}) + (victory ? {{CONFIG:victoryBonus}} : 0)',
      },
      {
        kind: 'paragraph',
        text: 'Even a defeat banks the floors and fights it earned, so you always make progress. Your cumulative score unlocks new starting roles — power-neutral ways to begin a run. They change how you start, never how strong you are.',
      },
      { kind: 'heading', text: 'Three more ways to unlock content permanently' },
      {
        kind: 'steps',
        items: [
          'Reach a new biome → the biome and its legendary relic unlock.',
          'Kill a boss for the first time → that boss’s legendary relic unlocks.',
          'Use an Altar → sacrifice the run to unlock a new relic (deeper = rarer).',
        ],
      },
      {
        kind: 'paragraph',
        text: 'Everything you fight or unlock fills the Compendium — enemies, bosses, and relics you haven’t met yet show as locked silhouettes, with a running “discovered” count per section.',
      },
      { kind: 'heading', text: 'Boss Rush & the God of War' },
      {
        kind: 'paragraph',
        text: 'Once you’ve discovered all five bosses, a Boss Rush mode opens: all five, back-to-back, no map. Win it once and you earn the God of War — a prestige starting class, and proof you’ve truly mastered the cascade.',
      },
    ],
  },
];
