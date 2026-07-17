/**
 * The run map screen: the generated DAG drawn bottom-to-top (start at the bottom, boss at the
 * top) with a distinct glyph per node type, the visited path marked, the current position
 * ringed, and ONLY legal nodes tappable. A tap enters the current node (awaiting_node) or
 * travels to a chosen next node (awaiting_move) — both go through the engine via the provider.
 * All geometry comes from the pure `mapLayout` view-model; this file only positions views.
 */
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Redirect } from 'expo-router';
import { computeMapLayout, edgeGeometry, MAP_EDGE_THICKNESS } from './mapLayout';
import type { LaidOutNode } from './mapLayout';
import { NODE_GLYPH, NODE_LABEL, isNodeTappable, nodeInteraction } from './nodePresentation';
import type { NodeInteraction } from './nodePresentation';
import { routeForRunState } from './runRoute';
import { runTheme } from './biomeTheme';
import { NODE_COLOR, RUN_COLORS } from './runColors';
import { RunHud } from './RunHud';
import { useRun } from './RunContext';

export function MapScreen() {
  const run = useRun();
  const state = run.state;
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  const layout = state === null ? null : computeMapLayout(state.map, width);

  // Auto-scroll so the current node is comfortably in view on mount / when it changes.
  const currentY = layout?.nodes.find((n) => n.id === state?.mapState.currentNodeId)?.y ?? 0;
  useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, currentY - 220), animated: false }), 0);
    return () => clearTimeout(id);
  }, [currentY]);

  if (state === null || layout === null) {
    return <Redirect href="/" />;
  }

  // The map only shows the enter/move phases. RESUMING a run saved mid-node (combat / shop /
  // draft / …) enters through here — bounce to that node's screen so play continues in place.
  const phaseRoute = routeForRunState(state);
  if (phaseRoute !== '/run') {
    return <Redirect href={phaseRoute} />;
  }

  const theme = runTheme(state);
  const isMovePhase = state.phase.kind === 'awaiting_move';
  const hint = isMovePhase ? 'Choose your next node' : 'Tap the glowing node to enter';

  const handleTap = (node: LaidOutNode): void => {
    if (!isNodeTappable(state, node.id)) return;
    if (nodeInteraction(state, node.id) === 'current-enter') {
      run.enterCurrentNode();
    } else {
      run.travelTo(node.id);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.tint }]}>
      <View style={styles.header}>
        <RunHud />
        <View style={styles.hintRow}>
          <Text style={styles.hint}>{hint}</Text>
          <Pressable onPress={run.goToMenu} hitSlop={8} style={({ pressed }) => [pressed && styles.pressed]}>
            <Text style={styles.leave}>Leave</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ width: layout.width, height: layout.height }}
        showsVerticalScrollIndicator={false}
      >
        {layout.edges.map((edge) => {
          const g = edgeGeometry(edge.x1, edge.y1, edge.x2, edge.y2);
          const active = isMovePhase && edge.fromId === state.mapState.currentNodeId && isNodeTappable(state, edge.toId);
          return (
            <View
              key={`${edge.fromId}->${edge.toId}`}
              pointerEvents="none"
              style={[
                styles.edge,
                {
                  left: g.left,
                  top: g.top - MAP_EDGE_THICKNESS / 2,
                  width: g.length,
                  backgroundColor: active ? theme.ring : RUN_COLORS.edge,
                  transform: [{ rotate: `${g.angleDeg}deg` }],
                },
              ]}
            />
          );
        })}

        {layout.nodes.map((node) => (
          <MapNodeMarker
            key={node.id}
            node={node}
            interaction={nodeInteraction(state, node.id)}
            size={layout.nodeSize}
            ring={theme.ring}
            onPress={() => handleTap(node)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function MapNodeMarker({
  node,
  interaction,
  size,
  ring,
  onPress,
}: {
  readonly node: LaidOutNode;
  readonly interaction: NodeInteraction;
  readonly size: number;
  /** The current-act biome's ring color (Act 1 keeps the base cyan). */
  readonly ring: string;
  readonly onPress: () => void;
}) {
  const tappable = interaction === 'current-enter' || interaction === 'travel';
  const fill =
    interaction === 'locked'
      ? RUN_COLORS.lockedNode
      : interaction === 'visited'
        ? RUN_COLORS.visitedNode
        : NODE_COLOR[node.type];
  const isCurrent = interaction === 'current-enter';

  return (
    <Pressable
      onPress={onPress}
      disabled={!tappable}
      style={({ pressed }) => [
        styles.node,
        {
          left: node.x - size / 2,
          top: node.y - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: fill,
          borderColor: isCurrent ? ring : 'transparent',
          borderWidth: isCurrent ? 3 : 0,
        },
        tappable && styles.tappable,
        pressed && tappable && styles.pressed,
      ]}
    >
      <Text style={[styles.glyph, interaction === 'locked' && styles.lockedGlyph]}>{NODE_GLYPH[node.type]}</Text>
      <Text style={styles.caption} numberOfLines={1}>
        {NODE_LABEL[node.type]}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RUN_COLORS.screenBg,
    paddingTop: 56,
  },
  header: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 8,
  },
  hintRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  hint: {
    color: RUN_COLORS.subtle,
    fontSize: 14,
    fontWeight: '700',
  },
  leave: {
    color: RUN_COLORS.subtle,
    fontSize: 14,
    fontWeight: '800',
  },
  scroll: {
    flex: 1,
  },
  edge: {
    position: 'absolute',
    height: MAP_EDGE_THICKNESS,
    borderRadius: MAP_EDGE_THICKNESS,
  },
  node: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tappable: {
    shadowColor: '#8ad0ff',
    shadowOpacity: 0.7,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  pressed: {
    opacity: 0.7,
  },
  glyph: {
    fontSize: 22,
  },
  lockedGlyph: {
    opacity: 0.5,
  },
  caption: {
    position: 'absolute',
    bottom: -16,
    color: RUN_COLORS.subtle,
    fontSize: 10,
    fontWeight: '700',
  },
});
