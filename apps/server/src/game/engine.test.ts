import { GameEngine } from './engine';
import { Player, GAME_CONSTANTS } from '@psylent/shared';

describe('GameEngine', () => {
  let engine: GameEngine;
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
        attributes: [],
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
        attributes: [],
        energy: 3,
        isConnected: true,
        consecutiveTimeouts: 0,
      },
    ];
    engine = new GameEngine('room-1', mockPlayers);
  });

  describe('game flow', () => {
    it('should start game after all players select attributes', () => {
      engine.startGame();
      expect(engine.getState().status).toBe('selecting');

      engine.selectAttributes('p1', ['THUNDER', 'HEAT']);
      engine.selectAttributes('p2', ['PSYCHIC', 'FATE']);
      engine.startGamePlay();

      expect(engine.getState().status).toBe('playing');
      expect(engine.getState().players[0].hand.length).toBe(GAME_CONSTANTS.STARTING_HAND_SIZE);
    });

    it('should handle card play (non-damage)', () => {
      engine.startGame();
      engine.selectAttributes('p1', ['THUNDER', 'HEAT']);
      engine.selectAttributes('p2', ['PSYCHIC', 'FATE']);
      engine.startGamePlay();

      const state = engine.getState();
      const p1 = state.players[0];

      // Place a draw card in p1's hand — draw cards have no damage effect
      const drawCard = {
        id: 'test-draw-card',
        type: 'attack' as const,
        name: '抽牌',
        cost: 0,
        effects: [{ type: 'draw' as const, value: 1, target: 'self' as const }],
        description: '',
      };
      p1.hand = [drawCard];

      engine.playCard('p1', 'test-draw-card');

      // Non-damage card goes directly to discard
      expect(p1.discard.length).toBe(1);
      expect(p1.discard[0].id).toBe('test-draw-card');
      // Phase should have advanced past action phase
      expect(engine.getState().phase.type).not.toBe('response');
    });

    it('should handle successful resonate', () => {
      engine.startGame();
      engine.selectAttributes('p1', ['THUNDER', 'HEAT']);
      engine.selectAttributes('p2', ['PSYCHIC', 'FATE']);
      engine.startGamePlay();

      const p1 = engine.getState().players[0];
      const p2 = engine.getState().players[1];

      const success = engine.resonate(p1.id, p2.id, ['PSYCHIC', 'FATE']);

      expect(success).toBe(true);
      expect(p2.hp).toBe(0);
      expect(engine.getState().status).toBe('finished');
    });

    it('should handle failed resonate', () => {
      engine.startGame();
      engine.selectAttributes('p1', ['THUNDER', 'HEAT']);
      engine.selectAttributes('p2', ['PSYCHIC', 'FATE']);
      engine.startGamePlay();

      const p1 = engine.getState().players[0];
      const p2 = engine.getState().players[1];
      const initialEnergy = p1.energy;

      const success = engine.resonate(p1.id, p2.id, ['THUNDER', 'HEAT']);

      expect(success).toBe(false);
      expect(p1.energy).toBe(initialEnergy - GAME_CONSTANTS.RESONATE_COST);
    });
  });
});
