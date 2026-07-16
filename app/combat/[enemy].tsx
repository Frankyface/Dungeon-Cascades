import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { CombatScreen } from '../../src/ui/combat/CombatScreen';
import { parseEnemyId } from '../../src/ui/combat/combatFormat';

export default function CombatRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ enemy?: string }>();
  const enemyId = parseEnemyId(params.enemy);

  // Boundary validation: an unknown enemy param bounces back to the menu.
  if (enemyId === null) {
    return <Redirect href="/" />;
  }

  const goToMenu = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return <CombatScreen enemyId={enemyId} onExit={goToMenu} />;
}
