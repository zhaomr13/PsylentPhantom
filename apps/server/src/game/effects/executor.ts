import { Effect, EffectType, TargetType, Player, Condition, Attribute } from "@psylent/shared";

export interface EffectContext {
  sourcePlayerId: string;
  targetPlayerId?: string;
  gameState: {
    players: Player[];
    turn: number;
  };
  drawCards?: (playerId: string, count: number) => void;
  onPeek?: (targetId: string, attribute: Attribute) => void;
  pendingDamage?: number;
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
    if (!targetId && effect.target !== "self") {
      return {
        type: effect.type,
        success: false,
        message: "No valid target",
      };
    }

    // 更新 context 包含目标信息
    const contextWithTarget = { ...context, targetPlayerId: targetId };

    // 检查条件
    if (effect.condition && !this.checkCondition(effect.condition, contextWithTarget)) {
      return {
        type: effect.type,
        success: false,
        message: "Condition not met",
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
      case "targetHasAttribute":
        return target?.attributes.includes(condition.params[0] as Attribute) ?? false;
      case "hpBelow":
        return (target?.hp ?? 0) < (condition.params[0] as number);
      case "hpAbove":
        return (target?.hp ?? 0) > (condition.params[0] as number);
      default:
        return true;
    }
  }

  private resolveTarget(target: TargetType, context: EffectContext): string | undefined {
    const sourceIndex = context.gameState.players.findIndex((p) => p.id === context.sourcePlayerId);

    switch (target) {
      case "self":
        return context.sourcePlayerId;
      case "left":
        return context.gameState.players[(sourceIndex + 1) % context.gameState.players.length]?.id;
      case "right":
        return context.gameState.players[(sourceIndex - 1 + context.gameState.players.length) % context.gameState.players.length]?.id;
      case "select":
        return context.targetPlayerId;
      case "all":
        return undefined; // 特殊处理
      case "random": {
        const others = context.gameState.players.filter((p) => p.id !== context.sourcePlayerId);
        return others[Math.floor(Math.random() * others.length)]?.id;
      }
      default:
        return undefined;
    }
  }

  private executeEffect(effect: Effect, targetId: string, context: EffectContext): EffectResult {
    const target = context.gameState.players.find((p) => p.id === targetId);
    if (!target) {
      return { type: effect.type, success: false, message: "Target not found" };
    }

    switch (effect.type) {
      case "damage": {
        const damage = typeof effect.value === "number" ? effect.value : 0;
        target.hp = Math.max(0, target.hp - damage);
        return {
          type: "damage",
          success: true,
          value: damage,
          targetId,
          message: `${target.name} 受到 ${damage} 点伤害`,
        };
      }

      case "heal": {
        const heal = typeof effect.value === "number" ? effect.value : 0;
        target.hp = Math.min(target.maxHp, target.hp + heal);
        return {
          type: "heal",
          success: true,
          value: heal,
          targetId,
          message: `${target.name} 恢复 ${heal} 点生命`,
        };
      }

      case "draw": {
        const drawCount = typeof effect.value === "number" ? effect.value : 0;
        if (context.drawCards) {
          context.drawCards(targetId, drawCount);
        }
        return {
          type: "draw",
          success: true,
          value: drawCount,
          targetId,
          message: `${target.name} 抽 ${drawCount} 张牌`,
        };
      }

      case "shield": {
        const shieldPercent = typeof effect.value === "number" ? effect.value : 0;
        const pending = context.pendingDamage ?? 0;
        const reducedDamage = Math.floor(pending * (1 - shieldPercent / 100));
        return {
          type: "shield",
          success: true,
          value: reducedDamage,
          targetId,
          message: `${target.name} 格挡，最终伤害 ${reducedDamage}`,
        };
      }

      case "reveal": {
        const revealCount = typeof effect.value === "number" ? effect.value : 1;
        if (target.attributesRevealed === undefined) target.attributesRevealed = 0;
        target.attributesRevealed = Math.min(2, target.attributesRevealed + revealCount);
        return {
          type: "reveal",
          success: true,
          value: target.attributesRevealed,
          targetId,
          message: `${target.name} 的属性被揭示（已揭示 ${target.attributesRevealed} 个）`,
        };
      }

      case "peek": {
        const peekCount = typeof effect.value === "number" ? effect.value : 1;
        if (context.onPeek) {
          // Reveal up to peekCount of target's attributes (privately to source)
          const revealed = target.attributes.slice(0, peekCount);
          revealed.forEach(attr => context.onPeek!(targetId, attr));
        }
        return {
          type: "peek",
          success: true,
          value: peekCount,
          targetId,
          message: `偷看了 ${target.name} 的属性`,
        };
      }

      case "discard": {
        const discardCount = typeof effect.value === "number" ? effect.value : 0;
        const actual = Math.min(discardCount, target.hand.length);
        for (let i = 0; i < actual; i++) {
          const idx = Math.floor(Math.random() * target.hand.length);
          const [discarded] = target.hand.splice(idx, 1);
          target.discard.push(discarded);
        }
        return {
          type: "discard",
          success: true,
          value: actual,
          targetId,
          message: `${target.name} 弃了 ${actual} 张牌`,
        };
      }

      default:
        return { type: effect.type, success: false, message: "Unknown effect type" };
    }
  }
}
