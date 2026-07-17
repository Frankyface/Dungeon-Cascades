/**
 * The SECRET dev screen (spec §8) — reached via 7 taps on the menu title. It drives dev-only test
 * helpers, all isolated to a SEPARATE dev meta store (`devMetaLedger` / metaController dev slot): the
 * normal profile is never touched. While dev mode is active a big red DEV banner shows across the app.
 *
 * Capabilities: toggle dev mode (routes all reads/banks to the dev slot), unlock all content, reset
 * dev meta, and stage the NEXT run with a seed / variant / Act-2-biome override or a jump straight to
 * Act 2. Utility UI — function over polish.
 */
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { GOD_OF_WAR_ID, VARIANTS, getBiome } from '../../engine/run';
import type { BiomeId } from '../../engine/combat';
import { devResetContent, devUnlockAllContent, isDevMode, metaState, setDevMode } from '../run/metaController';
import { makeRunSeed, stageRunState } from '../run/runController';
import { RUN_COLORS } from '../run/runColors';
import { DEV_ACT2_BIOME_CHOICES, buildDevRun } from './devRun';

const VARIANT_CHOICES: ReadonlyArray<{ readonly id: string | null; readonly label: string }> = [
  { id: null, label: 'Vanilla' },
  ...VARIANTS.map((v) => ({ id: v.id, label: v.name })),
  { id: GOD_OF_WAR_ID, label: 'God of War' },
];

export function DevScreen() {
  const router = useRouter();
  const [, forceRender] = useState(0);
  const rerender = () => forceRender((n) => n + 1);

  const [seedText, setSeedText] = useState('');
  const [variantId, setVariantId] = useState<string | null>(null);
  const [act2BiomeId, setAct2BiomeId] = useState<BiomeId | undefined>(undefined);
  const [jumpToAct2, setJumpToAct2] = useState(false);

  const dev = isDevMode();

  const toggleDev = (): void => {
    setDevMode(!dev);
    rerender();
  };

  const startDevRun = (): void => {
    // Force dev mode ON before staging (spec §8): a dev run must run against the SEPARATE dev
    // profile, so its banking never touches the normal ledger. (The run is also `isDevRun`-stamped
    // in buildDevRun as a belt-and-braces guard should the toggle be flipped off mid-run.)
    if (!isDevMode()) {
      setDevMode(true);
      rerender();
    }
    const trimmed = seedText.trim();
    const parsed = Number(trimmed);
    const seed = trimmed === '' || Number.isNaN(parsed) ? makeRunSeed() : parsed >>> 0;
    const run = buildDevRun({
      seed,
      variantId: variantId ?? undefined,
      act2BiomeId,
      jumpToAct2,
      unlockedRelicIds: metaState().unlockedRelicIds,
    });
    stageRunState(run);
    router.replace('/run');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {dev ? (
        <View style={styles.devBanner}>
          <Text style={styles.devBannerText}>● DEV MODE ACTIVE — using the separate dev profile</Text>
        </View>
      ) : null}

      <Text style={styles.title}>🛠 Dev Mode</Text>
      <Text style={styles.warn}>All changes here use a separate dev save. Normal progress is never touched.</Text>

      <Text style={styles.sectionLabel}>Profile</Text>
      <Toggle label="Dev mode" value={dev} onPress={toggleDev} />
      <DevButton
        label="Unlock all content"
        hint="Biomes, relics, bosses, Boss Rush, God of War — into the dev slot"
        onPress={() => {
          if (!dev) setDevMode(true);
          devUnlockAllContent();
          rerender();
        }}
      />
      <DevButton
        label="Reset dev meta"
        hint="Wipe the dev profile back to fresh"
        danger
        onPress={() => {
          devResetContent();
          rerender();
        }}
      />

      <Text style={styles.sectionLabel}>Next run overrides</Text>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Seed (blank = random)</Text>
        <TextInput
          value={seedText}
          onChangeText={setSeedText}
          keyboardType="number-pad"
          placeholder="e.g. 42"
          placeholderTextColor={RUN_COLORS.subtle}
          style={styles.input}
        />
      </View>

      <Text style={styles.fieldLabel}>Variant / role</Text>
      <View style={styles.chips}>
        {VARIANT_CHOICES.map((choice) => (
          <Chip
            key={choice.id ?? 'vanilla'}
            label={choice.label}
            active={variantId === choice.id}
            onPress={() => setVariantId(choice.id)}
          />
        ))}
      </View>

      <Text style={styles.fieldLabel}>Act-2 biome</Text>
      <View style={styles.chips}>
        <Chip label="Random" active={act2BiomeId === undefined} onPress={() => setAct2BiomeId(undefined)} />
        {DEV_ACT2_BIOME_CHOICES.map((id) => (
          <Chip key={id} label={getBiome(id).name} active={act2BiomeId === id} onPress={() => setAct2BiomeId(id)} />
        ))}
      </View>

      <Toggle label="Jump straight to Act 2" value={jumpToAct2} onPress={() => setJumpToAct2((v) => !v)} />

      <Pressable onPress={startDevRun} style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>Start dev run ›</Text>
      </Pressable>
      <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

function Toggle({ label, value, onPress }: { readonly label: string; readonly value: boolean; readonly onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.switch, value && styles.switchOn]}>
        <Text style={styles.switchText}>{value ? 'ON' : 'OFF'}</Text>
      </View>
    </Pressable>
  );
}

function DevButton({
  label,
  hint,
  danger,
  onPress,
}: {
  readonly label: string;
  readonly hint: string;
  readonly danger?: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.devButton, danger && styles.devButtonDanger, pressed && styles.pressed]}>
      <Text style={styles.devButtonLabel}>{label}</Text>
      <Text style={styles.devButtonHint}>{hint}</Text>
    </Pressable>
  );
}

function Chip({ label, active, onPress }: { readonly label: string; readonly active: boolean; readonly onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: RUN_COLORS.screenBg },
  content: { paddingTop: 72, paddingHorizontal: 20, paddingBottom: 44, gap: 10 },
  devBanner: { backgroundColor: '#c0202a', borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  devBannerText: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  title: { color: RUN_COLORS.text, fontSize: 28, fontWeight: '900', textAlign: 'center' },
  warn: { color: RUN_COLORS.subtle, fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  sectionLabel: {
    color: RUN_COLORS.subtle,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 10,
  },
  toggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: RUN_COLORS.panelBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: RUN_COLORS.panelBorder,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  toggleLabel: { color: RUN_COLORS.text, fontSize: 16, fontWeight: '800' },
  switch: { backgroundColor: RUN_COLORS.hpTrack, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 12 },
  switchOn: { backgroundColor: '#30a46c' },
  switchText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  devButton: {
    backgroundColor: RUN_COLORS.panelBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: RUN_COLORS.panelBorder,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 2,
  },
  devButtonDanger: { borderColor: '#7c2d3a' },
  devButtonLabel: { color: RUN_COLORS.text, fontSize: 16, fontWeight: '800' },
  devButtonHint: { color: RUN_COLORS.subtle, fontSize: 12, fontWeight: '600' },
  field: { gap: 4 },
  fieldLabel: { color: RUN_COLORS.text, fontSize: 14, fontWeight: '800', marginTop: 4 },
  input: {
    backgroundColor: RUN_COLORS.panelBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: RUN_COLORS.panelBorder,
    color: RUN_COLORS.text,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '700',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: RUN_COLORS.panelBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: RUN_COLORS.panelBorder,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipActive: { backgroundColor: RUN_COLORS.accent, borderColor: RUN_COLORS.edgeActive },
  chipText: { color: RUN_COLORS.subtle, fontSize: 13, fontWeight: '800' },
  chipTextActive: { color: RUN_COLORS.text },
  button: { backgroundColor: RUN_COLORS.buttonBg, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  primary: { backgroundColor: RUN_COLORS.accent },
  buttonText: { color: RUN_COLORS.buttonText, fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.7 },
});
