import { Attribute } from '../constants';

export type CardType = 'attack' | 'defense' | 'negotiation' | 'ultimate';

export type EffectType =
  | 'damage'
  | 'heal'
  | 'draw'
  | 'shield'
  | 'reveal'
  | 'peek'
  | 'discard'
  | 'custom'
  | 'selfDamage'      // 对自己造成伤害
  | 'counterAttack'   // 反击伤害
  | 'immune'          // 免疫伤害
  | 'unblockable'     // 无法防御
  | 'copyFromDiscard' // 从弃牌堆复制
  | 'fateInterfere'   // 命运干涉
  | 'resonateAttempt' // 尝试精神感应
  | 'disableAbility'  // 禁用能力
  | 'forceDiscard'    // 强制弃牌
  | 'returnHand';     // 返还手牌

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
  aoe?: boolean;
}
