/**
 * The "How to Play" screen (spec §5): renders the structured tutorial content, resolving every
 * `{{CONFIG:name}}` placeholder to the engine's live value at render time. Presentational — all copy
 * comes from `tutorialContent`, all numbers from `tutorialConfig.resolveConfigText`.
 */
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RUN_COLORS } from '../run/runColors';
import { resolveConfigText } from './tutorialConfig';
import { TUTORIAL_INTRO, TUTORIAL_OUTRO, TUTORIAL_SECTIONS, type TutorialBlock } from './tutorialContent';

/** Resolve config tokens in a string just before it renders. */
function t(text: string): string {
  return resolveConfigText(text);
}

function Block({ block }: { readonly block: TutorialBlock }) {
  switch (block.kind) {
    case 'paragraph':
      return <Text style={styles.paragraph}>{t(block.text)}</Text>;
    case 'heading':
      return <Text style={styles.blockHeading}>{t(block.text)}</Text>;
    case 'bullets':
      return (
        <View style={styles.list}>
          {block.items.map((item, i) => (
            <View key={i} style={styles.listRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>{t(item)}</Text>
            </View>
          ))}
        </View>
      );
    case 'steps':
      return (
        <View style={styles.list}>
          {block.items.map((item, i) => (
            <View key={i} style={styles.listRow}>
              <Text style={styles.stepNum}>{i + 1}.</Text>
              <Text style={styles.listText}>{t(item)}</Text>
            </View>
          ))}
        </View>
      );
    case 'formula':
      return (
        <View style={styles.formula}>
          <Text style={styles.formulaText}>{t(block.text)}</Text>
        </View>
      );
    case 'callout':
      return (
        <View style={styles.callout}>
          <Text style={styles.calloutText}>{t(block.text)}</Text>
        </View>
      );
    case 'table':
      return (
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHead]}>
            {block.headers.map((h, i) => (
              <Text key={i} style={[styles.tableCell, styles.tableHeadCell]}>
                {t(h)}
              </Text>
            ))}
          </View>
          {block.rows.map((row, ri) => (
            <View key={ri} style={styles.tableRow}>
              {row.map((cell, ci) => (
                <Text key={ci} style={styles.tableCell}>
                  {t(cell)}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
  }
}

export function TutorialScreen() {
  const router = useRouter();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>How to Play</Text>
      {TUTORIAL_INTRO.map((line, i) => (
        <Text key={i} style={styles.intro}>
          {t(line)}
        </Text>
      ))}

      {TUTORIAL_SECTIONS.map((section) => (
        <View key={section.id} style={styles.section}>
          <Text style={styles.sectionTitle}>
            {section.number}. {t(section.title)}
          </Text>
          {section.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </View>
      ))}

      <Text style={styles.outro}>{t(TUTORIAL_OUTRO)}</Text>

      <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: RUN_COLORS.screenBg },
  content: { paddingTop: 72, paddingHorizontal: 20, paddingBottom: 44, gap: 12 },
  title: { color: RUN_COLORS.text, fontSize: 30, fontWeight: '900', textAlign: 'center' },
  intro: { color: RUN_COLORS.subtle, fontSize: 15, fontWeight: '600', lineHeight: 22, textAlign: 'center' },
  section: {
    backgroundColor: RUN_COLORS.panelBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: RUN_COLORS.panelBorder,
    padding: 16,
    gap: 10,
    marginTop: 6,
  },
  sectionTitle: { color: RUN_COLORS.edgeActive, fontSize: 18, fontWeight: '900' },
  blockHeading: { color: RUN_COLORS.text, fontSize: 15, fontWeight: '900', marginTop: 4 },
  paragraph: { color: RUN_COLORS.text, fontSize: 15, fontWeight: '500', lineHeight: 22 },
  list: { gap: 6 },
  listRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  bullet: { color: RUN_COLORS.edgeActive, fontSize: 15, fontWeight: '900', width: 14 },
  stepNum: { color: RUN_COLORS.edgeActive, fontSize: 15, fontWeight: '900', width: 20 },
  listText: { color: RUN_COLORS.text, fontSize: 15, fontWeight: '500', lineHeight: 22, flex: 1 },
  formula: {
    backgroundColor: RUN_COLORS.hpTrack,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  formulaText: { color: RUN_COLORS.gold, fontSize: 14, fontWeight: '800' },
  callout: {
    backgroundColor: RUN_COLORS.accent,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  calloutText: { color: RUN_COLORS.text, fontSize: 14, fontWeight: '700', lineHeight: 21 },
  table: {
    borderWidth: 1,
    borderColor: RUN_COLORS.panelBorder,
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: RUN_COLORS.panelBorder },
  tableHead: { backgroundColor: RUN_COLORS.hpTrack },
  tableCell: {
    flex: 1,
    color: RUN_COLORS.text,
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableHeadCell: { fontWeight: '900', color: RUN_COLORS.subtle },
  outro: { color: RUN_COLORS.subtle, fontSize: 14, fontWeight: '600', fontStyle: 'italic', textAlign: 'center', lineHeight: 21, marginTop: 6 },
  backButton: { backgroundColor: RUN_COLORS.buttonBg, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  backText: { color: RUN_COLORS.buttonText, fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.7 },
});
