import { StyleSheet, Text, View } from 'react-native';

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dungeon Cascades — board coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f1020',
    padding: 24,
  },
  title: {
    color: '#e8e8f0',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
});
