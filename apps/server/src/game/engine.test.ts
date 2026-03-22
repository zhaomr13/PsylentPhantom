import { GameEngine } from './engine';
import { Player, GAME_CONSTANTS } from '@psylent/shared';

function initGame(engine: GameEngine) {
  engine.startGame();
  engine.selectAttributes('p1', ['THUNDER', 'HEAT']);
  engine.selectAttributes('p2', ['PSYCHIC', 'FATE']);
  engine.startGamePlay();
}

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

  describe('response phase', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should enter response phase when single-target damage card is played', () => {
      initGame(engine);
      const state = engine.getState();
      const p1 = state.players[0];

      const punchCard = { id: 'punch-test', type: 'attack' as const, name: '拳击', cost: 0,
        effects: [{ type: 'damage' as const, value: 1, target: 'left' as const }], description: '' };
      p1.hand = [punchCard];

      engine.playCard('p1', 'punch-test');

      expect(engine.getState().phase.type).toBe('response');
      expect(engine.getResponseContext()).not.toBeNull();
      expect(engine.getResponseContext()!.pendingDamage).toBe(1);
    });

    it('should apply full damage on timeout', () => {
      initGame(engine);
      const state = engine.getState();
      const p1 = state.players[0];
      const p2 = state.players[1];

      const punchCard = { id: 'punch-test', type: 'attack' as const, name: '拳击', cost: 0,
        effects: [{ type: 'damage' as const, value: 3, target: 'left' as const }], description: '' };
      p1.hand = [punchCard];
      const initialHp = p2.hp;

      engine.playCard('p1', 'punch-test');
      jest.runAllTimers();

      expect(p2.hp).toBe(initialHp - 3);
      expect(engine.getResponseContext()).toBeNull();
    });

    it('should apply reduced damage when defender uses shield card', () => {
      initGame(engine);
      const state = engine.getState();
      const p1 = state.players[0];
      const p2 = state.players[1];

      const punchCard = { id: 'punch-test', type: 'attack' as const, name: '拳击', cost: 0,
        effects: [{ type: 'damage' as const, value: 4, target: 'left' as const }], description: '' };
      const defendCard = { id: 'defend-test', type: 'defense' as const, name: '防御', cost: 0,
        effects: [{ type: 'shield' as const, value: 50, target: 'self' as const }], description: '' };
      p1.hand = [punchCard];
      p2.hand = [defendCard];
      const initialHp = p2.hp;

      engine.playCard('p1', 'punch-test');
      engine.respond('p2', 'defend-test');

      expect(p2.hp).toBe(initialHp - 2); // floor(4 * 0.5) = 2
      expect(engine.getResponseContext()).toBeNull();
    });

    it('should apply full damage on respondSkip', () => {
      initGame(engine);
      const state = engine.getState();
      const p1 = state.players[0];
      const p2 = state.players[1];

      const punchCard = { id: 'punch-test', type: 'attack' as const, name: '拳击', cost: 0,
        effects: [{ type: 'damage' as const, value: 3, target: 'left' as const }], description: '' };
      p1.hand = [punchCard];
      const initialHp = p2.hp;

      engine.playCard('p1', 'punch-test');
      engine.respondSkip('p2');

      expect(p2.hp).toBe(initialHp - 3);
      expect(engine.getResponseContext()).toBeNull();
    });
  });

  describe('phase timers', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('should increment consecutiveTimeouts on draw phase timeout', () => {
      initGame(engine);
      const p1 = engine.getState().players[0];
      expect(p1.consecutiveTimeouts).toBe(0);

      // Expire draw phase → auto-selectDrawCard fires (isAutoAction=true, no reset)
      jest.advanceTimersByTime(GAME_CONSTANTS.PHASE_TIMEOUT_DRAW + 100);
      expect(p1.consecutiveTimeouts).toBe(1);
    });

    it('should NOT reset consecutiveTimeouts when auto-action fires', () => {
      initGame(engine);
      const p1 = engine.getState().players[0];

      // Manually set counter to 2
      p1.consecutiveTimeouts = 2;

      // Draw timeout fires auto-action
      jest.advanceTimersByTime(GAME_CONSTANTS.PHASE_TIMEOUT_DRAW + 100);

      // Counter should be 3 (incremented, not reset to 0)
      expect(p1.consecutiveTimeouts).toBe(3);
      expect(p1.isConnected).toBe(false);
    });

    it('should reset consecutiveTimeouts on real player action', () => {
      initGame(engine);
      const p1 = engine.getState().players[0];
      p1.consecutiveTimeouts = 2;

      // Player manually calls startDrawPhase then selectDrawCard
      engine.startDrawPhase('p1');
      engine.selectDrawCard('p1', 0); // real player action, isAutoAction defaults to false

      expect(p1.consecutiveTimeouts).toBe(0);
    });
  });
});
