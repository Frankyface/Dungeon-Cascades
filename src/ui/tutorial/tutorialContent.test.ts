/**
 * Tutorial content integrity: every `{{CONFIG:name}}` token used anywhere in the copy resolves to a
 * live value (no typos, no stale placeholders left after rendering) and the section set is well-formed.
 */
import { hasUnresolvedTokens, resolveConfigText } from './tutorialConfig';
import { TUTORIAL_INTRO, TUTORIAL_OUTRO, TUTORIAL_SECTIONS, type TutorialBlock } from './tutorialContent';

/** Every raw string a block contributes (so tokens in tables/lists/formulas are all checked). */
function blockStrings(block: TutorialBlock): string[] {
  switch (block.kind) {
    case 'paragraph':
    case 'heading':
    case 'formula':
    case 'callout':
      return [block.text];
    case 'bullets':
    case 'steps':
      return [...block.items];
    case 'table':
      return [...block.headers, ...block.rows.flatMap((r) => [...r])];
  }
}

/** Every raw string across the whole tutorial (titles, intro, outro, and all blocks). */
function allStrings(): string[] {
  const strings: string[] = [...TUTORIAL_INTRO, TUTORIAL_OUTRO];
  for (const section of TUTORIAL_SECTIONS) {
    strings.push(section.title);
    for (const block of section.blocks) strings.push(...blockStrings(block));
  }
  return strings;
}

describe('tutorial content', () => {
  it('has eight numbered sections in order', () => {
    expect(TUTORIAL_SECTIONS).toHaveLength(8);
    expect(TUTORIAL_SECTIONS.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(TUTORIAL_SECTIONS.map((s) => s.id)).size).toBe(8); // unique ids
  });

  it('resolves EVERY config token in the copy (no unknown tokens throw, no placeholders remain)', () => {
    for (const raw of allStrings()) {
      const resolved = resolveConfigText(raw); // throws on an unknown token
      expect(hasUnresolvedTokens(resolved)).toBe(false);
    }
  });

  it('actually uses config tokens (the guide is engine-driven, not hardcoded)', () => {
    const anyToken = allStrings().some((s) => s.includes('{{CONFIG:'));
    expect(anyToken).toBe(true);
  });
});
