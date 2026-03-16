import { Attribute } from '../constants';

export type CardType = 'attack' | 'defense' | 'negotiation' | 'ultimate';

export type EffectType = 'damage' | 'heal' | 'draw' | 'shield' | 'reveal' | 'peek' | 'discard' | 'custom';

export type TargetType = 'self' | 'left' | 'right' | 'all' | 'select' | 'random';

export interface Condition {
  type: 'hasAttribute' | 'hpBelow' | 'hpAbove' | 'hasCard' | 'targetHasAttribute';
  params: unknown[];
}

export interface Effect {
  type: EffectType;
  value: number | 'all' | 'half';
  target: TargetType;
  timing?: 'immediate' | 'delayed' | 'endOfTurn' | 'nextDamage';
  condition?: Condition;
  chain?: Effect[];
}

export interface Card {
  id: string;
  type: CardType;
  name: string;
  attribute?: Attribute;
  cost: number;
  effects: Effect[];
  description: string;
}
