import { GameStateManager } from './state/manager';
import { EffectExecutor } from './effects/executor';
import { generateDeck } from './cards/definitions';
import { Player, Attribute, Card, GAME_CONSTANTS } from '@psylent/shared';
import { ResponseContext } from './types';

export interface GameConfig {
  resonatePenalty: 'reveal' | 'skip' | 'energy';
}

// 12张属性牌（6个属性×2张）
const ATTRIBUTE_CARDS: Attribute[] = [
  'HEAT', 'HEAT',
  'THUNDER', 'THUNDER',
  'SPACE', 'SPACE',
  'PSYCHIC', 'PSYCHIC',
  'FATE', 'FATE',
  'SPIRIT', 'SPIRIT',
];

export class GameEngine {
  private stateManager: GameStateManager;
  private effectExecutor: EffectExecutor;
  private config: GameConfig;
  private pendingDraws: Map<string, Card[]> = new Map();
  private playerAttributes: Map<string, Attribute[]> = new Map();
  private playerAttributeOptions: Map<string, Attribute[]> = new Map(); // 每个玩家被分配的3张属性牌
  private pendingPeeks: Array<{ sourcePlayerId: string; targetId: string; attribute: Attribute }> = [];
  private responseContext: ResponseContext | null = null;
  private responseTimer: ReturnType<typeof setTimeout> | null = null;
  private phaseTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private onStateChange: (() => void) | null = null;

  constructor(roomId: string, players: Player[], config: GameConfig = { resonatePenalty: 'reveal' }) {
    this.stateManager = new GameStateManager(roomId, players);
    this.effectExecutor = new EffectExecutor();
    this.config = config;
  }

  setStateChangeCallback(cb: () => void): void {
    this.onStateChange = cb;
  }

  startGame(): void {
    // 分配属性牌给玩家
    this.distributeAttributeCards();
    this.stateManager.setStatus('selecting');
  }

  // 分配属性牌：12张牌（6属性×2张）分给每个玩家3张
  private distributeAttributeCards(): void {
    const players = this.stateManager.getState().players;
    const shuffledAttributes = this.shuffle([...ATTRIBUTE_CARDS]);

    // 每个玩家分配3张
    players.forEach((player, index) => {
      const startIdx = index * 3;
      const options = shuffledAttributes.slice(startIdx, startIdx + 3);
      this.playerAttributeOptions.set(player.id, options);
      console.log(`[GameEngine] Player ${player.id} received attribute options:`, options);
    });
  }

  // 获取玩家被分配的属性牌选项
  getPlayerAttributeOptions(playerId: string): Attribute[] | undefined {
    return this.playerAttributeOptions.get(playerId);
  }

  // 获取所有玩家的属性牌选项Map（用于WebSocket广播）
  getPlayerAttributeOptionsMap(): Map<string, Attribute[]> {
    return this.playerAttributeOptions;
  }

  private playerReady: Map<string, boolean> = new Map();

  selectAttributes(playerId: string, attributes: [Attribute, Attribute]): void {
    if (attributes.length !== 2) {
      throw new Error('Must select exactly 2 attributes');
    }
    if (new Set(attributes).size !== 2) {
      throw new Error('Attributes must be different');
    }

    // 验证玩家只能从分配的3张牌中选择
    const options = this.playerAttributeOptions.get(playerId);
    if (!options) {
      throw new Error('No attribute options available for player');
    }

    const validSelection = attributes.every(attr => options.includes(attr));
    if (!validSelection) {
      throw new Error(`Invalid selection. Must choose 2 from: ${options.join(', ')}`);
    }

    this.playerAttributes.set(playerId, attributes);
    this.playerReady.set(playerId, true);
    console.log(`[GameEngine] Player ${playerId} selected attributes:`, attributes);
  }

  isPlayerReady(playerId: string): boolean {
    return this.playerReady.has(playerId);
  }

  getReadyPlayers(): string[] {
    return Array.from(this.playerReady.keys());
  }

  canStartGame(): boolean {
    const players = this.stateManager.getState().players;
    // 至少需要2人才能开始游戏
    if (players.length < 2) return false;
    return players.every(p => this.playerReady.has(p.id));
  }

  startGamePlay(): void {
    if (!this.canStartGame()) {
      throw new Error('Not all players are ready');
    }
    this.initializeGame();
  }

  private initializeGame(): void {
    console.log('[GameEngine] Initializing game...');
    const state = this.stateManager.getState();

    // 为每个玩家生成牌库
    state.players.forEach(player => {
      const attrs = this.playerAttributes.get(player.id)!;
      player.attributes = attrs;
      player.deck = generateDeck(attrs as [Attribute, Attribute]);
      console.log(`[GameEngine] Player ${player.id} deck generated with ${player.deck.length} cards`);

      // 初始抽牌
      this.drawCards(player.id, GAME_CONSTANTS.STARTING_HAND_SIZE);
      console.log(`[GameEngine] Player ${player.id} hand: ${player.hand.length} cards`);
    });

    // 开始游戏
    this.stateManager.setStatus('playing');
    this.startTurnWithTimer(state.players[0].id);
    console.log('[GameEngine] Game initialized, status: playing, first player:', state.players[0].id);
  }

  drawCards(playerId: string, count: number): void {
    const player = this.getPlayer(playerId);
    for (let i = 0; i < count; i++) {
      if (player.hand.length >= GAME_CONSTANTS.MAX_HAND_SIZE) break;
      if (player.deck.length === 0) {
        if (player.discard.length === 0) break;
        player.deck = this.shuffle([...player.discard]);
        player.discard = [];
      }
      const card = player.deck.pop()!;
      player.hand.push(card);
    }
  }

  flushPendingPeeks(): Array<{ sourcePlayerId: string; targetId: string; attribute: Attribute }> {
    const peeks = [...this.pendingPeeks];
    this.pendingPeeks = [];
    return peeks;
  }

  getDrawOptions(playerId: string): Card[] | undefined {
    return this.pendingDraws.get(playerId);
  }

  startDrawPhase(playerId: string): Card[] {
    const player = this.getPlayer(playerId);
    const cards: Card[] = [];

    for (let i = 0; i < 2; i++) {
      if (player.deck.length > 0) {
        cards.push(player.deck.pop()!);
      }
    }

    this.pendingDraws.set(playerId, cards);
    return cards;
  }

  selectDrawCard(playerId: string, selectedIndex: number, isAutoAction = false): void {
    this.clearPhaseTimer(playerId);
    if (!isAutoAction) this.resetTimeout(playerId);

    const player = this.getPlayer(playerId);
    const options = this.pendingDraws.get(playerId);

    if (!options || selectedIndex < 0 || selectedIndex >= options.length) {
      throw new Error('Invalid selection');
    }

    const selected = options[selectedIndex];

    // 选中的加入手牌
    player.hand.push(selected);
    // 另一张放回牌库顶（公开），仅当有另一张时
    if (options.length > 1) {
      const revealed = options[1 - selectedIndex];
      player.deck.push(revealed);
    }

    this.pendingDraws.delete(playerId);

    // 进入超载阶段
    this.stateManager.setPhase({
      type: 'overload',
      timeout: GAME_CONSTANTS.PHASE_TIMEOUT_OVERLOAD,
      deadline: new Date(Date.now() + GAME_CONSTANTS.PHASE_TIMEOUT_OVERLOAD),
    });

    this.schedulePhaseTimeout(playerId, GAME_CONSTANTS.PHASE_TIMEOUT_OVERLOAD, () => {
      try { this.overload(playerId, false, true); } catch { /* ignore */ }
    });
  }

  overload(playerId: string, takeOverload: boolean, isAutoAction = false): void {
    this.clearPhaseTimer(playerId);
    if (!isAutoAction) this.resetTimeout(playerId);

    console.log(`[GameEngine] overload called: ${playerId}, enabled=${takeOverload}`);
    if (!takeOverload) {
      this.stateManager.setPhase({
        type: 'action',
        timeout: GAME_CONSTANTS.PHASE_TIMEOUT_ACTION,
        deadline: new Date(Date.now() + GAME_CONSTANTS.PHASE_TIMEOUT_ACTION),
      });
      console.log(`[GameEngine] overload skipped, entering action phase`);

      this.schedulePhaseTimeout(playerId, GAME_CONSTANTS.PHASE_TIMEOUT_ACTION, () => {
        try { this.skipTurn(playerId, true); } catch { /* ignore */ }
      });

      return;
    }

    const player = this.getPlayer(playerId);
    player.hp -= GAME_CONSTANTS.OVERLOAD_DAMAGE;

    // 额外抽牌
    this.drawCards(playerId, GAME_CONSTANTS.OVERLOAD_DRAW);

    this.stateManager.setPhase({
      type: 'action',
      timeout: GAME_CONSTANTS.PHASE_TIMEOUT_ACTION,
      deadline: new Date(Date.now() + GAME_CONSTANTS.PHASE_TIMEOUT_ACTION),
    });

    this.schedulePhaseTimeout(playerId, GAME_CONSTANTS.PHASE_TIMEOUT_ACTION, () => {
      try { this.skipTurn(playerId, true); } catch { /* ignore */ }
    });
  }

  playCard(playerId: string, cardId: string, targetId?: string): void {
    this.clearPhaseTimer(playerId);
    this.resetTimeout(playerId);

    const player = this.getPlayer(playerId);
    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) throw new Error('Card not in hand');

    const card = player.hand[cardIndex];

    // 检查卡牌属性要求：如果卡牌有属性，玩家必须有该属性才能打出
    if (card.attribute) {
      const playerAttrs = this.playerAttributes.get(playerId);
      if (!playerAttrs || !playerAttrs.includes(card.attribute)) {
        throw new Error(`Cannot play ${card.name}: requires ${card.attribute} attribute`);
      }
    }

    // 属性检查通过，移除手牌
    player.hand.splice(cardIndex, 1)[0];

    // Check if this is a single-target damage card that triggers response phase
    const damageEffects = card.effects.filter(e => e.type === 'damage');
    const hasSingleTargetDamage =
      !card.aoe &&
      damageEffects.length > 0 &&
      damageEffects.every(e => e.target !== 'all');

    if (hasSingleTargetDamage) {
      let pendingDamage = 0;
      const state = this.stateManager.getState();

      for (const effect of card.effects) {
        if (effect.type === 'damage') {
          const sourceIndex = state.players.findIndex(p => p.id === playerId);
          let resolvedTargetId: string;
          if (effect.target === 'select') {
            resolvedTargetId = targetId!;
          } else if (effect.target === 'left') {
            resolvedTargetId = state.players[(sourceIndex + 1) % state.players.length].id;
          } else if (effect.target === 'right') {
            resolvedTargetId = state.players[(sourceIndex - 1 + state.players.length) % state.players.length].id;
          } else {
            resolvedTargetId = targetId || state.players[(sourceIndex + 1) % state.players.length].id;
          }

          const context = {
            sourcePlayerId: playerId,
            targetPlayerId: resolvedTargetId,
            gameState: state,
            drawCards: this.drawCards.bind(this),
            onPeek: (tId: string, attribute: Attribute) => {
              this.pendingPeeks.push({ sourcePlayerId: playerId, targetId: tId, attribute });
            },
          };
          if (!effect.condition || (this.effectExecutor as any)['checkCondition'](effect.condition, context)) {
            pendingDamage += typeof effect.value === 'number' ? effect.value : 0;
          }
          if (!this.responseContext) {
            this.responseContext = {
              attackerId: playerId,
              defenderId: resolvedTargetId,
              pendingDamage: 0,
              card,
            };
          }
        }
      }

      this.responseContext!.pendingDamage = pendingDamage;

      const RESPONSE_TIMEOUT = 10000;
      this.stateManager.setPhase({
        type: 'response',
        timeout: RESPONSE_TIMEOUT,
        deadline: new Date(Date.now() + RESPONSE_TIMEOUT),
      });

      this.responseTimer = setTimeout(() => {
        this.resolveResponse(null);
        this.onStateChange?.();
      }, RESPONSE_TIMEOUT);
      if (this.responseTimer.unref) this.responseTimer.unref();

      return;
    }

    // Non-damage card or AoE: execute all effects immediately
    for (const effect of card.effects) {
      const context = {
        sourcePlayerId: playerId,
        targetPlayerId: targetId,
        gameState: this.stateManager.getState(),
        drawCards: this.drawCards.bind(this),
        onPeek: (tId: string, attribute: Attribute) => {
          this.pendingPeeks.push({ sourcePlayerId: playerId, targetId: tId, attribute });
        },
      };
      this.effectExecutor.execute(effect, context);
    }

    player.discard.push(card);

    const winCheck = this.stateManager.checkWinCondition();
    if (winCheck.winner) {
      this.stateManager.endGame(winCheck.winner, winCheck.reason);
      return;
    }

    this.endTurn();
  }

  respond(defenderId: string, cardId: string): void {
    if (!this.responseContext) throw new Error('Not in response phase');
    if (this.responseContext.defenderId !== defenderId) throw new Error('Not your turn to respond');

    const defender = this.getPlayer(defenderId);
    const cardIndex = defender.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) throw new Error('Card not in hand');

    const card = defender.hand[cardIndex];
    const shieldEffect = card.effects.find(e => e.type === 'shield');
    if (!shieldEffect) throw new Error('Card has no shield effect');

    const context = {
      sourcePlayerId: defenderId,
      targetPlayerId: defenderId,
      gameState: this.stateManager.getState(),
      drawCards: this.drawCards.bind(this),
      onPeek: () => {},
      pendingDamage: this.responseContext.pendingDamage,
    };

    const result = this.effectExecutor.execute(shieldEffect, context);
    const reducedDamage = result.value ?? this.responseContext.pendingDamage;

    defender.hand.splice(cardIndex, 1);
    defender.discard.push(card);

    this.resolveResponse(reducedDamage);
  }

  respondSkip(defenderId: string): void {
    if (!this.responseContext) throw new Error('Not in response phase');
    if (this.responseContext.defenderId !== defenderId) throw new Error('Not your turn to respond');
    this.resolveResponse(null);
  }

  private resolveResponse(reducedDamage: number | null): void {
    if (!this.responseContext) return;

    if (this.responseTimer) {
      clearTimeout(this.responseTimer);
      this.responseTimer = null;
    }

    const ctx = this.responseContext;
    this.responseContext = null;

    const damage = reducedDamage !== null ? reducedDamage : ctx.pendingDamage;
    const defender = this.getPlayer(ctx.defenderId);
    defender.hp = Math.max(0, defender.hp - damage);

    const attacker = this.getPlayer(ctx.attackerId);
    attacker.discard.push(ctx.card);

    const winCheck = this.stateManager.checkWinCondition();
    if (winCheck.winner) {
      this.stateManager.endGame(winCheck.winner, winCheck.reason);
      return;
    }

    this.endTurn();
  }

  getResponseContext(): ResponseContext | null {
    return this.responseContext;
  }

  updatePlayerId(oldId: string, newId: string): void {
    if (this.responseContext) {
      if (this.responseContext.attackerId === oldId) this.responseContext.attackerId = newId;
      if (this.responseContext.defenderId === oldId) this.responseContext.defenderId = newId;
    }
    if (this.playerAttributes.has(oldId)) {
      this.playerAttributes.set(newId, this.playerAttributes.get(oldId)!);
      this.playerAttributes.delete(oldId);
    }
    if (this.playerReady.has(oldId)) {
      this.playerReady.set(newId, this.playerReady.get(oldId)!);
      this.playerReady.delete(oldId);
    }
    const pendingDraw = this.pendingDraws.get(oldId);
    if (pendingDraw) {
      this.pendingDraws.set(newId, pendingDraw);
      this.pendingDraws.delete(oldId);
    }
  }

  resonate(playerId: string, targetId: string, guess: [Attribute, Attribute]): boolean {
    this.clearPhaseTimer(playerId);
    this.resetTimeout(playerId);

    const player = this.getPlayer(playerId);
    const target = this.getPlayer(targetId);

    if (player.energy < GAME_CONSTANTS.RESONATE_COST) {
      throw new Error('Insufficient energy');
    }

    player.energy -= GAME_CONSTANTS.RESONATE_COST;

    // 排序后比较
    const guessSorted = [...guess].sort();
    const actualSorted = [...target.attributes].sort();
    const success = guessSorted[0] === actualSorted[0] && guessSorted[1] === actualSorted[1];

    if (success) {
      target.hp = 0;
      this.stateManager.endGame(playerId, 'resonate');
    } else {
      // 应用惩罚
      this.applyResonatePenalty(playerId);
    }

    return success;
  }

  private applyResonatePenalty(playerId: string): void {
    const player = this.getPlayer(playerId);

    switch (this.config.resonatePenalty) {
      case 'reveal':
        // 随机暴露1个属性
        if (player.attributesRevealed === undefined) player.attributesRevealed = 0;
        if (player.attributesRevealed < 2) {
          player.attributesRevealed++;
        }
        break;
      case 'skip':
        // 跳过下回合（在状态管理中标记）
        player.skipNextTurn = true;
        break;
      case 'energy':
        player.energy = 0;
        break;
    }
  }

  skipTurn(playerId: string, isAutoAction = false): void {
    this.clearPhaseTimer(playerId);
    if (!isAutoAction) this.resetTimeout(playerId);
    this.endTurn();
  }

  private endTurn(): void {
    this.stateManager.nextTurn();
    const nextPlayerId = this.stateManager.getState().currentPlayerId;
    if (this.stateManager.getState().status === 'finished') return;
    this.startTurnWithTimer(nextPlayerId);
  }

  private startTurnWithTimer(playerId: string): void {
    if (this.stateManager.getState().status === 'finished') return;
    this.stateManager.startTurn(playerId);
    this.schedulePhaseTimeout(playerId, GAME_CONSTANTS.PHASE_TIMEOUT_DRAW, () => {
      // Auto-action: pass isAutoAction=true so consecutiveTimeouts increment is NOT reset
      const player = this.stateManager.getState().players.find(p => p.id === playerId);
      if (player && player.hand.length >= GAME_CONSTANTS.MAX_HAND_SIZE) {
        // Hand full — skip draw, go straight to overload
        try { this.overload(playerId, false, true); } catch { /* ignore */ }
        return;
      }
      if (!this.pendingDraws.has(playerId)) {
        try { this.startDrawPhase(playerId); } catch { return; }
      }
      try { this.selectDrawCard(playerId, 0, true); } catch { /* ignore */ }
    });
  }

  private clearPhaseTimer(playerId: string): void {
    const existing = this.phaseTimers.get(playerId);
    if (existing) {
      clearTimeout(existing);
      this.phaseTimers.delete(playerId);
    }
  }

  private schedulePhaseTimeout(playerId: string, ms: number, action: () => void): void {
    this.clearPhaseTimer(playerId);
    const timer = setTimeout(() => {
      this.phaseTimers.delete(playerId);
      if (this.stateManager.getState().status === 'finished') return;
      const player = this.stateManager.getState().players.find(p => p.id === playerId);
      if (player) {
        player.consecutiveTimeouts++;
        if (player.consecutiveTimeouts >= 3) {
          player.isConnected = false;
        }
      }
      action();
      this.onStateChange?.();
    }, ms);
    // unref so the timer doesn't prevent process exit (relevant in tests)
    if (timer.unref) timer.unref();
    this.phaseTimers.set(playerId, timer);
  }

  private resetTimeout(playerId: string): void {
    const player = this.stateManager.getState().players.find(p => p.id === playerId);
    if (player) player.consecutiveTimeouts = 0;
  }

  getState() {
    return this.stateManager.getState();
  }

  getPlayerView(playerId: string, readyPlayers?: Set<string>, attributeOptions?: Map<string, Attribute[]>) {
    return this.stateManager.getPlayerView(playerId, readyPlayers, attributeOptions);
  }

  private getPlayer(playerId: string): Player {
    const player = this.stateManager.getState().players.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found');
    return player;
  }

  private shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}
