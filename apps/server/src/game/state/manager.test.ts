import { GameStateManager } from './manager';
import { Player } from '@psylent/shared';

describe('GameStateManager', () => {
  let manager: GameStateManager;
  let mockPlayers: Player[];

  beforeEach(() => {
    mockPlayers = [
      {
        id: 'p1',
        name: 'Player1',
        hp: 10,
        maxHp: 10,
        hand: [],
        deck: [],
        discard: [],
        attributes: ['THUNDER', 'HEAT'],
        energy: 3,
        isConnected: true,
        consecutiveTimeouts: 0,
      },
      {
        id: 'p2',
        name: 'Player2',
        hp: 10,
        maxHp: 10,
        hand: [],
        deck: [],
        discard: [],
        attributes: ['PSYCHIC', 'FATE'],
        energy: 3,
        isConnected: true,
        consecutiveTimeouts: 0,
      },
    ];
    manager = new GameStateManager('room-1', mockPlayers);
  });

  describe('getPlayerView', () => {
    it('should return filtered view for player', () => {
      const view = manager.getPlayerView('p1');

      expect(view.me.id).toBe('p1');
      expect(view.me.attributes).toEqual(['THUNDER', 'HEAT']);
      expect(view.opponents).toHaveLength(1);
      expect(view.opponents[0].id).toBe('p2');
      expect(view.opponents[0].attributes).toBeUndefined(); // 隐藏属性
    });
  });

  describe('turn management', () => {
    it('should cycle through players', () => {
      manager.startTurn('p1');
      expect(manager.getState().currentPlayerId).toBe('p1');

      manager.nextTurn();
      expect(manager.getState().currentPlayerId).toBe('p2');

      manager.nextTurn();
      expect(manager.getState().currentPlayerId).toBe('p1');
    });
  });

  describe('win condition', () => {
    it('should detect last player standing', () => {
      mockPlayers[1].hp = 0;
      const result = manager.checkWinCondition();

      expect(result.winner).toBe('p1');
      expect(result.reason).toBe('kill');
    });
  });
});
