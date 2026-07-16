/**
 * The shop screen: the engine-generated stock (unowned relics + one heal item) with prices and
 * the live gold balance (in the HUD). Buying deducts gold and grants the item through the
 * provider → engine (`buyFromShop`); a rejected buy (broke / sold) surfaces a short reason.
 * Leaving is always available. No pricing or affordability logic lives here — the engine owns it.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import type { BuyRejection, ShopItem } from '../../engine/run';
import { RelicCardView } from './RelicCardView';
import { relicCard } from './relicPresentation';
import { RUN_COLORS } from './runColors';
import { RunHud } from './RunHud';
import { useRun } from './RunContext';

const REJECTION_TEXT: Readonly<Record<BuyRejection, string>> = {
  'insufficient-gold': 'Not enough gold',
  'already-sold': 'Already sold',
  'out-of-range': 'Unavailable',
};

export function ShopScreen() {
  const run = useRun();
  const state = run.state;
  const [notice, setNotice] = useState<string | null>(null);
  if (state === null || state.phase.kind !== 'shop') {
    return <Redirect href="/run" />;
  }

  const items = state.phase.shop.items;

  const buy = (index: number): void => {
    const result = run.buy(index);
    setNotice(result.ok ? 'Purchased!' : REJECTION_TEXT[result.reason]);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <RunHud />
        <Text style={styles.title}>🛒 Shop</Text>
        <Text style={styles.subtitle}>{notice ?? 'Spend gold on relics and healing.'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {items.map((item, index) => (
          <ShopRow
            key={shopItemKey(item, index)}
            item={item}
            gold={state.gold}
            atFullHp={state.playerHp >= state.playerMaxHp}
            onBuy={() => buy(index)}
          />
        ))}
        <Pressable onPress={run.leaveShopNode} style={({ pressed }) => [styles.leave, pressed && styles.pressed]}>
          <Text style={styles.leaveText}>Leave shop</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function shopItemKey(item: ShopItem, index: number): string {
  return item.kind === 'relic' ? `relic-${item.relicId}` : `heal-${index}`;
}

function ShopRow({
  item,
  gold,
  atFullHp,
  onBuy,
}: {
  readonly item: ShopItem;
  readonly gold: number;
  readonly atFullHp: boolean;
  readonly onBuy: () => void;
}) {
  const cantAfford = gold < item.price;
  if (item.kind === 'relic') {
    return (
      <RelicCardView
        card={relicCard(item.relicId)}
        trailing={`🪙 ${item.price}`}
        onPress={onBuy}
        disabled={item.sold || cantAfford}
      />
    );
  }
  const disabled = item.sold || cantAfford || atFullHp;
  return (
    <Pressable onPress={onBuy} disabled={disabled} style={({ pressed }) => [styles.healCard, disabled && styles.disabled, pressed && !disabled && styles.pressed]}>
      <View style={styles.healRow}>
        <Text style={styles.healTitle}>✚ Heal {item.heal} HP</Text>
        <Text style={styles.price}>🪙 {item.price}</Text>
      </View>
      <Text style={styles.healHint}>{item.sold ? 'Sold' : atFullHp ? 'Already at full HP' : 'Restore health instantly'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: RUN_COLORS.screenBg, paddingTop: 56 },
  header: { paddingHorizontal: 16, gap: 6, paddingBottom: 8 },
  title: { color: RUN_COLORS.text, fontSize: 24, fontWeight: '900', marginTop: 6 },
  subtitle: { color: RUN_COLORS.subtle, fontSize: 14, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  healCard: {
    backgroundColor: RUN_COLORS.panelBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: RUN_COLORS.panelBorder,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 6,
  },
  disabled: { opacity: 0.45 },
  healRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  healTitle: { color: RUN_COLORS.text, fontSize: 17, fontWeight: '800' },
  price: { color: RUN_COLORS.gold, fontSize: 15, fontWeight: '800' },
  healHint: { color: RUN_COLORS.subtle, fontSize: 13, fontWeight: '600' },
  leave: { marginTop: 6, backgroundColor: RUN_COLORS.buttonBg, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  leaveText: { color: RUN_COLORS.buttonText, fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.7 },
});
