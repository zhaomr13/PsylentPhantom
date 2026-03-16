export const GAME_CONSTANTS = {
  MAX_HP: 10,
  STARTING_HP: 10,
  STARTING_HAND_SIZE: 4,
  DECK_SIZE: 32,
  MAX_HAND_SIZE: 8,
  RESONATE_COST: 3,
  OVERLOAD_DAMAGE: 1,
  OVERLOAD_DRAW: 1,
  PHASE_TIMEOUT_DRAW: 30000,
  PHASE_TIMEOUT_OVERLOAD: 15000,
  PHASE_TIMEOUT_ACTION: 60000,
  DISCONNECT_TIMEOUT: 60000,
  RECONNECT_GRACE_PERIOD: 300000,
} as const;

export const ATTRIBUTES = [
  'THUNDER',
  'HEAT',
  'PSYCHIC',
  'FATE',
  'SPACE',
  'SPIRIT',
] as const;

export type Attribute = typeof ATTRIBUTES[number];

export const ATTRIBUTE_COLORS: Record<Attribute, { primary: string; secondary: string }> = {
  THUNDER: { primary: '#FFD700', secondary: '#4A0080' },
  HEAT: { primary: '#FF4500', secondary: '#8B0000' },
  PSYCHIC: { primary: '#9370DB', secondary: '#191970' },
  FATE: { primary: '#00CED1', secondary: '#FFD700' },
  SPACE: { primary: '#4169E1', secondary: '#00FFFF' },
  SPIRIT: { primary: '#FF69B4', secondary: '#8A2BE2' },
};
