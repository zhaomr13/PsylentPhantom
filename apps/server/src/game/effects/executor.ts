import { Effect, EffectType, TargetType, Player, Card, Condition, Attribute } from '@psylent/shared';

export interface EffectContext {
  sourcePlayerId: string;
  targetPlayerId?: string;
  gameState: {
    players: Player[];
    turn: number;
  };
}

export interface EffectResult {
  type: EffectType;
  success: boolean;
  value?: number;
  targetId?: string;
  message: string;
}

export class EffectExecutor {
  execute(effect: Effect, context: EffectContext): EffectResult {
    // 先解析目标
    const targetId = this.resolveTarget(effect.target, context);
    if (!targetId && effect.target !== 'self') {
      return {
        type: effect.type,
        success: false,
        message: 'No valid target',
      };
    }

    // 更新 context 包含目标信息
    const contextWithTarget = { ...context, targetPlayerId: targetId };

    // 检查条件
    if (effect.condition && !this.checkCondition(effect.condition, contextWithTarget)) {
      return {
        type: effect.type,
        success: false,
        message: 'Condition not met',
      };
    }

    const result = this.executeEffect(effect, targetId || context.sourcePlayerId, contextWithTarget);

    // 执行连锁效果
    if (effect.chain && result.success) {
      for (const chainEffect of effect.chain) {
        this.execute(chainEffect, { ...context, targetPlayerId: targetId });
      }
    }

    return result;
  }

  private checkCondition(condition: Condition, context: EffectContext): boolean {
    const playerId = context.targetPlayerId || context.sourcePlayerId;
    const target = context.gameState.players.find((p) => p.id === playerId);

    switch (condition.type) {
      case 'targetHasAttribute':
        return target?.attributes.includes(condition.params[0] as Attribute) ?? false;
      case 'hpBelow':
        return (target?.hp ?? 0) < (condition.params[0] as number);
      case 'hpAbove':
        return (target?.hp ?? 0) > (condition.params[0] as number);
      default:
        return true;
    }
  }

  private resolveTarget(target: TargetType, context: EffectContext): string | undefined {
    const sourceIndex = context.gameState.players.findIndex((p) => p.id === context.sourcePlayerId);

    switch (target) {
      case 'self':
        return context.sourcePlayerId;
      case 'left':
        return context.gameState.players[(sourceIndex + 1) % context.gameState.players.length]?.id;
      case 'right':
        return context.gameState.players[(sourceIndex - 1 + context.gameState.players.length) % context.gameState.players.length]?.id;
      case 'select':
        return context.targetPlayerId;
      case 'all':
        return undefined; // 特殊处理
      case 'random':
        const others = context.gameState.players.filter((p) => p.id !== context.sourcePlayerId);
        return others[Math.floor(Math.random() * others.length)]?.id;
      default:
        return undefined;
    }
  }

  private executeEffect(effect: Effect, targetId: string, context: EffectContext): EffectResult {
    const target = context.gameState.players.find((p) => p.id === targetId);
    if (!target) {
      return { type: effect.type, success: false, message: 'Target not found' };
    }

    switch (effect.type) {
      case 'damage':
        const damage = typeof effect.value === 'number' ? effect.value : 0;
        target.hp = Math.max(0, target.hp - damage);
        return {
          type: 'damage',
          success: true,
          value: damage,
          targetId,
          message: `${target.name} 受到 ${damage} 点伤害`,
        };

      case 'heal':
        const heal = typeof effect.value === 'number' ? effect.value : 0;
        target.hp = Math.min(target.maxHp, target.hp + heal);
        return {
          type: 'heal',
          success: true,
          value: heal,
          targetId,
          message: `${target.name} 恢复 ${heal} 点生命`,
        };

      case 'draw':
        const drawCount = typeof effect.value === 'number' ? effect.value : 0;
        // 实际抽牌逻辑在 GameEngine 中处理
        return {
          type: 'draw',
          success: true,
          value: drawCount,
          targetId,
          message: `${target.name} 抽 ${drawCount} 张牌`,
        };

      case 'shield':
        const shieldValue = typeof effect.value === 'number' ? effect.value : 0;
        // 护盾逻辑在伤害计算时处理
        return {
          type: 'shield',
          success: true,
          value: shieldValue,
          targetId,
          message: `${target.name} 获得 ${shieldValue}% 护盾`,
        };

      case 'reveal':
        return {
          type: 'reveal',
          success: true,
          targetId,
          message: '揭示了信息',
        };

      case 'peek':
        return {
          type: 'peek',
          success: true,
          targetId,
          message: '查看了信息',
        };

      case 'discard':
        const discardCount = typeof effect.value === 'number' ? effect.value : 0;
        return {
          type: 'discard',
          success: true,
          value: discardCount,
          targetId,
          message: `${target.name} 弃 ${discardCount} 张牌`,
        };

      default:
        return { type: effect.type, success: false, message: 'Unknown effect type' };
    }
  }
}
