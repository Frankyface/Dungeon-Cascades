/**
 * The event screen: the engine event's name + flavor text and its 2–3 choice buttons (each
 * label states its trade). Choosing rolls any gamble and applies the deltas through the
 * provider → engine (`chooseEventOption`), then returns to the map. No outcome logic here.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { getEvent } from '../../engine/run';
import { RUN_COLORS } from './runColors';
import { RunHud } from './RunHud';
import { useRun } from './RunContext';

export function EventScreen() {
  const run = useRun();
  const state = run.state;
  if (state === null || state.phase.kind !== 'event') {
    return <Redirect href="/run" />;
  }

  const event = getEvent(state.phase.eventId);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <RunHud />
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>❓ {event.name}</Text>
        <Text style={styles.text}>{event.text}</Text>
        <View style={styles.choices}>
          {event.choices.map((choice, index) => (
            <Pressable
              key={choice.id}
              onPress={() => run.chooseEvent(index)}
              style={({ pressed }) => [styles.choice, pressed && styles.pressed]}
            >
              <Text style={styles.choiceText}>{choice.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: RUN_COLORS.screenBg, paddingTop: 56 },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  body: { paddingHorizontal: 16, paddingBottom: 32, gap: 14 },
  title: { color: RUN_COLORS.text, fontSize: 26, fontWeight: '900', marginTop: 10 },
  text: { color: RUN_COLORS.subtle, fontSize: 16, fontWeight: '600', lineHeight: 23 },
  choices: { gap: 12, marginTop: 8 },
  choice: {
    backgroundColor: RUN_COLORS.panelBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: RUN_COLORS.panelBorder,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  choiceText: { color: RUN_COLORS.text, fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
