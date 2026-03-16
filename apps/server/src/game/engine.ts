import { GameStateManager } from './state/manager';
import { EffectExecutor } from './effects/executor';
import { generateDeck } from './cards/definitions';
import { Player, Attribute, Card, GAME_CONSTANTS } from '@psylent/shared';

export interface GameConfig {
  resonatePenalty: 'reveal' | 'skip' | 'energy';
}

export class GameEngine {
  private stateManager: GameStateManager;
  private effectExecutor: EffectExecutor;
  private config: GameConfig;
  private pendingDraws: Map<string, Card[]> = new Map();
  private playerAttributes: Map<string, Attribute[]> = new Map();

  constructor(roomId: string, players: Player[], config: GameConfig = { resonatePenalty: 'reveal' }) {
    this.stateManager = new GameStateManager(roomId, players);
    this.effectExecutor = new EffectExecutor();
    this.config = config;
  }

  startGame(): void {
    this.stateManager.setStatus('selecting');
  }

  selectAttributes(playerId: string, attributes: [Attribute, Attribute]): void {
    if (attributes.length !== 2) {
      throw new Error('Must select exactly 2 attributes');
    }
    if (new Set(attributes).size !== 2) {
      throw new Error('Attributes must be different');
    }

    this.playerAttributes.set(playerId, attributes);

    // 检查是否所有玩家都已选择
    if (this.allPlayersSelected()) {
      this.initializeGame();
    }
  }

  private allPlayersSelected(): boolean {
    const players = this.stateManager.getState().players;
    return players.every(p => this.playerAttributes.has(p.id));
  }

  private initializeGame(): void {
    const state = this.stateManager.getState();

    // 为每个玩家生成牌库
    state.players.forEach(player => {
      const attrs = this.playerAttributes.get(player.id)!;
      player.attributes = attrs;
      player.deck = generateDeck(attrs as [Attribute, Attribute]);

      // 初始抽牌
      for (let i = 0; i < GAME_CONSTANTS.STARTING_HAND_SIZE; i++) {
        this.drawCard(player);
      }
    });

    // 开始游戏
    this.stateManager.setStatus('playing');
    this.stateManager.startTurn(state.players[0].id);
  }

  private drawCard(player: Player): Card | undefined {
    if (player.deck.length === 0) {
      // 牌库空了，洗牌
      if (player.discard.length === 0) return undefined;
      player.deck = this.shuffle([...player.discard]);
      player.discard = [];
    }

    const card = player.deck.pop()!;
    if (player.hand.length < GAME_CONSTANTS.MAX_HAND_SIZE) {
      player.hand.push(card);
    } else {
      // 手牌满，直接弃置
      player.discard.push(card);
    }
    return card;
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

  selectDrawCard(playerId: string, selectedIndex: number): void {
    const player = this.getPlayer(playerId);
    const options = this.pendingDraws.get(playerId);

    if (!options || selectedIndex < 0 || selectedIndex >= options.length) {
      throw new Error('Invalid selection');
    }

    const selected = options[selectedIndex];
    const revealed = options[1 - selectedIndex];

    // 选中的加入手牌
    player.hand.push(selected);
    // 另一张放回牌库顶（公开）
    player.deck.push(revealed);

    this.pendingDraws.delete(playerId);

    // 进入超载阶段
    this.stateManager.setPhase({
      type: 'overload',
      timeout: GAME_CONSTANTS.PHASE_TIMEOUT_OVERLOAD,
    });
  }

  overload(playerId: string, enabled: boolean): void {
    if (!enabled) {
      this.stateManager.setPhase({
        type: 'action',
        timeout: GAME_CONSTANTS.PHASE_TIMEOUT_ACTION,
      });
      return;
    }

    const player = this.getPlayer(playerId);
    player.hp -= GAME_CONSTANTS.OVERLOAD_DAMAGE;

    // 额外抽牌
    for (let i = 0; i < GAME_CONSTANTS.OVERLOAD_DRAW; i++) {
      this.drawCard(player);
    }

    this.stateManager.setPhase({
      type: 'action',
      timeout: GAME_CONSTANTS.PHASE_TIMEOUT_ACTION,
    });
  }

  playCard(playerId: string, cardId: string, targetId?: string): void {
    const player = this.getPlayer(playerId);
    const cardIndex = player.hand.findIndex(c => c.id === cardId);

    if (cardIndex === -1) {
      throw new Error('Card not in hand');
    }

    const card = player.hand.splice(cardIndex, 1)[0];

    // 执行卡牌效果
    for (const effect of card.effects) {
      const context = {
        sourcePlayerId: playerId,
        targetPlayerId: targetId,
        gameState: this.stateManager.getState(),
      };
      this.effectExecutor.execute(effect, context);
    }

    // 弃置使用的牌
    player.discard.push(card);

    // 检查胜利条件
    const winCheck = this.stateManager.checkWinCondition();
    if (winCheck.winner) {
      this.stateManager.endGame(winCheck.winner, winCheck.reason);
      return;
    }

    // 进入下一回合
    this.endTurn();
  }

  resonate(playerId: string, targetId: string, guess: [Attribute, Attribute]): boolean {
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

  skipTurn(playerId: string): void {
    this.endTurn();
  }

  private endTurn(): void {
    this.stateManager.nextTurn();
    const nextPlayerId = this.stateManager.getState().currentPlayerId;
    this.stateManager.startTurn(nextPlayerId);
  }

  getState() {
    return this.stateManager.getState();
  }

  getPlayerView(playerId: string) {
    return this.stateManager.getPlayerView(playerId);
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
