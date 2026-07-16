/**
 * Combat-screen palette, gathered so theming is one place. Reuses the board's
 * screen/tile hues (so the fight and the naked board read as one game) and adds the
 * HP-bar, panel, chip, and intent colors the combat panels need.
 */
import { BOARD_COLORS } from '../board/colors';

export const COMBAT_COLORS = {
  screenBg: BOARD_COLORS.screenBg,
  panelBg: '#191a2e',
  panelBorder: '#2a2c46',
  text: BOARD_COLORS.hudText,
  subtle: BOARD_COLORS.hudSubtle,

  hpTrack: '#0c0d1a',
  playerFill: '#30a46c',
  enemyFill: '#e5484d',
  hpLow: '#ff6b6b',

  // Affinity chips.
  weakBg: '#3b1d20',
  weakText: '#ff9ea1',
  resistBg: '#1c2740',
  resistText: '#9ec2ff',

  // Intent badge tints by action type.
  attackTint: '#ff8a8d',
  chargeTint: '#ffd76b',
  healTint: '#7ee0a8',

  // Turn-feedback callouts.
  damageText: '#ff9ea1',
  healText: '#7ee0a8',
  weaknessText: '#ffd76b',

  // Overlays.
  overlayScrim: '#0b0c18e6',
  winText: '#7ee0a8',
  loseText: '#ff8a8d',
  buttonBg: '#2a2c46',
  buttonText: BOARD_COLORS.hudText,
} as const;
