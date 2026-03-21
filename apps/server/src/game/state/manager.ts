import { GameState, PlayerViewState, Player, Phase, GameStatus, MyPlayerView, OpponentView, PublicLogEntry } from '@psylent/shared';
import { GAME_CONSTANTS } from '@psylent/shared';

export class GameStateManager {
  private state: GameState;

  constructor(roomId: string, players: Player[]) {
    this.state = {
      roomId,
      status: 'waiting',
      turn: 0,
      currentPlayerId: '',
      players,
      phase: { type: 'draw' },
      log: [],
    };
  }

  getState(): GameState {
    return this.state;
  }

  setStatus(status: GameStatus): void {
    this.state.status = status;
  }

  startGame(): void {
    this.state.status = 'selecting';
    this.state.turn = 1;
  }

  startTurn(playerId: string): void {
    this.state.currentPlayerId = playerId;
    this.state.phase = { type: 'draw', timeout: GAME_CONSTANTS.PHASE_TIMEOUT_DRAW };
  }

  setPhase(phase: Phase): void {
    this.state.phase = phase;
  }

  nextTurn(): void {
    const currentIndex = this.state.players.findIndex(p => p.id === this.state.currentPlayerId);
    const nextIndex = (currentIndex + 1) % this.state.players.length;
    this.state.currentPlayerId = this.state.players[nextIndex].id;
    this.state.turn++;
  }

  addLogEntry(type: string, playerId?: string, data?: unknown): void {
    this.state.log.push({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type,
      playerId,
      data,
    });
  }

  getPlayerView(playerId: string, readyPlayers?: Set<string>): PlayerViewState {
    const player = this.state.players.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found');

    const me: MyPlayerView = {
      id: player.id,
      name: player.name,
      hp: player.hp,
      maxHp: player.maxHp,
      hand: player.hand,
      handCount: player.hand.length,
      deckCount: player.deck.length,
      discard: player.discard,
      attributes: player.attributes,
      energy: player.energy,
      isConnected: player.isConnected,
      consecutiveTimeouts: player.consecutiveTimeouts,
      isReady: readyPlayers?.has(player.id),
    };

    const opponents: OpponentView[] = this.state.players
      .filter(p => p.id !== playerId)
      .map(p => ({
        id: p.id,
        name: p.name,
        hp: p.hp,
        maxHp: p.maxHp,
        handCount: p.hand.length,
        deckCount: p.deck.length,
        discard: p.discard,
        attributes: p.attributesRevealed && p.attributesRevealed > 0
          ? p.attributes.slice(0, p.attributesRevealed)
          : undefined,
        attributesRevealed: p.attributesRevealed || 0,
        energy: p.energy,
        isConnected: p.isConnected,
        isReady: readyPlayers?.has(p.id),
      }));

    return {
      roomId: this.state.roomId,
      status: this.state.status,
      turn: this.state.turn,
      currentPlayerId: this.state.currentPlayerId,
      hostId: this.state.players[0]?.id || '',
      me,
      opponents,
      phase: this.state.phase,
      log: this.state.log.map(entry => ({
        timestamp: entry.timestamp,
        message: this.formatLogEntry(entry),
      })),
      winner: this.state.winner,
    };
  }

  private formatLogEntry(entry: any): string {
    switch (entry.type) {
      case 'damage':
        return `${entry.playerId} 造成 ${entry.data?.damage} 点伤害`;
      case 'heal':
        return `${entry.playerId} 恢复 ${entry.data?.heal} 点生命`;
      case 'card_played':
        return `${entry.playerId} 使用了 ${entry.data?.cardName}`;
      case 'resonate_success':
        return `${entry.playerId} 共振成功！游戏结束`;
      case 'resonate_fail':
        return `${entry.playerId} 共振失败`;
      default:
        return `${entry.type}: ${JSON.stringify(entry.data)}`;
    }
  }

  checkWinCondition(): { winner: string | null; reason: string } {
    // 检查击杀胜利
    const alivePlayers = this.state.players.filter(p => p.hp > 0);
    if (alivePlayers.length === 1) {
      return { winner: alivePlayers[0].id, reason: 'kill' };
    }

    // 共振胜利在共振指环逻辑中处理
    return { winner: null, reason: '' };
  }

  endGame(winnerId: string, reason: string): void {
    this.state.status = 'finished';
    this.state.winner = winnerId;
    this.addLogEntry('game_end', winnerId, { reason });
  }
}
