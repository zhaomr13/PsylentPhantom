import { EffectExecutor, EffectContext } from "./executor";
import { Player, Effect, Attribute } from "@psylent/shared";

describe("EffectExecutor", () => {
  let executor: EffectExecutor;
  let mockPlayers: Player[];
  let baseContext: EffectContext;

  beforeEach(() => {
    executor = new EffectExecutor();
    mockPlayers = [
      {
        id: "p1",
        name: "Player1",
        hp: 10,
        maxHp: 10,
        hand: [],
        deck: [],
        discard: [],
        attributes: ["THUNDER", "HEAT"],
        energy: 3,
        isConnected: true,
        consecutiveTimeouts: 0,
      },
      {
        id: "p2",
        name: "Player2",
        hp: 10,
        maxHp: 10,
        hand: [],
        deck: [],
        discard: [],
        attributes: ["PSYCHIC", "FATE"],
        energy: 3,
        isConnected: true,
        consecutiveTimeouts: 0,
      },
    ];
    baseContext = {
      sourcePlayerId: "p1",
      gameState: { players: mockPlayers, turn: 1 },
      drawCards: jest.fn(),
      onPeek: jest.fn(),
    };
  });

  function makeContext(overrides: Partial<EffectContext> = {}): EffectContext {
    return {
      sourcePlayerId: "p1",
      gameState: { players: mockPlayers, turn: 1 },
      ...overrides,
    };
  }

  describe("damage effect", () => {
    it("should deal damage to target", () => {
      const effect: Effect = { type: "damage", value: 3, target: "left" };
      const result = executor.execute(effect, baseContext);

      expect(result.success).toBe(true);
      expect(result.value).toBe(3);
      expect(mockPlayers[1].hp).toBe(7);
    });

    it("should not reduce hp below 0", () => {
      const effect: Effect = { type: "damage", value: 15, target: "left" };
      executor.execute(effect, baseContext);

      expect(mockPlayers[1].hp).toBe(0);
    });
  });

  describe("heal effect", () => {
    it("should heal target", () => {
      mockPlayers[0].hp = 5;
      const effect: Effect = { type: "heal", value: 3, target: "self" };
      const result = executor.execute(effect, baseContext);

      expect(result.success).toBe(true);
      expect(mockPlayers[0].hp).toBe(8);
    });

    it("should not exceed maxHp", () => {
      const effect: Effect = { type: "heal", value: 5, target: "self" };
      executor.execute(effect, baseContext);

      expect(mockPlayers[0].hp).toBe(10);
    });
  });

  describe("condition check", () => {
    it("should execute when condition is met", () => {
      const effect: Effect = {
        type: "damage",
        value: 5,
        target: "left",
        condition: { type: "targetHasAttribute", params: ["PSYCHIC"] },
      };
      const result = executor.execute(effect, baseContext);

      expect(result.success).toBe(true);
    });

    it("should not execute when condition is not met", () => {
      const effect: Effect = {
        type: "damage",
        value: 5,
        target: "left",
        condition: { type: "targetHasAttribute", params: ["THUNDER"] },
      };
      const result = executor.execute(effect, baseContext);

      expect(result.success).toBe(false);
    });
  });

  describe("peek effect", () => {
    it("should call onPeek with one target attribute", () => {
      const onPeek = jest.fn();
      const effect: Effect = { type: "peek", value: 1, target: "left" };
      const result = executor.execute(effect, makeContext({ onPeek }));

      expect(result.success).toBe(true);
      expect(onPeek).toHaveBeenCalledTimes(1);
      const [targetId, attr] = onPeek.mock.calls[0];
      expect(targetId).toBe("p2");
      expect(["PSYCHIC", "FATE"]).toContain(attr);
    });

    it("should call onPeek twice for value 2", () => {
      const onPeek = jest.fn();
      const effect: Effect = { type: "peek", value: 2, target: "left" };
      executor.execute(effect, makeContext({ onPeek }));
      expect(onPeek).toHaveBeenCalledTimes(2);
    });

    it("should not call onPeek if callback is absent", () => {
      const effect: Effect = { type: "peek", value: 1, target: "left" };
      expect(() => executor.execute(effect, makeContext({ onPeek: undefined }))).not.toThrow();
    });
  });

  describe("shield effect", () => {
    it("should return 50% reduced damage for shield value 50", () => {
      const effect: Effect = { type: "shield", value: 50, target: "self" };
      const result = executor.execute(effect, makeContext({ pendingDamage: 4 }));
      expect(result.success).toBe(true);
      expect(result.value).toBe(2); // floor(4 * 0.5)
    });

    it("should return 0 damage for shield value 100", () => {
      const effect: Effect = { type: "shield", value: 100, target: "self" };
      const result = executor.execute(effect, makeContext({ pendingDamage: 5 }));
      expect(result.value).toBe(0);
    });

    it("should return full pending damage when no pendingDamage in context", () => {
      const effect: Effect = { type: "shield", value: 50, target: "self" };
      const result = executor.execute(effect, makeContext({ pendingDamage: undefined }));
      expect(result.value).toBe(0); // floor(0 * 0.5)
    });
  });

  // Helper context with required callbacks
  const makeContextFn = (overrides: Partial<EffectContext> = {}): EffectContext => ({
    sourcePlayerId: "p1",
    gameState: { players: mockPlayers, turn: 1 },
    drawCards: jest.fn(),
    onPeek: jest.fn(),
    ...overrides,
  });

  describe("draw effect", () => {
    it("should invoke drawCards callback with correct count", () => {
      const drawCards = jest.fn();
      const effect: Effect = { type: "draw", value: 2, target: "self" };
      const result = executor.execute(effect, makeContextFn({ drawCards }));

      expect(result.success).toBe(true);
      expect(drawCards).toHaveBeenCalledWith("p1", 2);
    });

    it("should succeed even without drawCards callback", () => {
      const effect: Effect = { type: "draw", value: 1, target: "self" };
      const result = executor.execute(effect, makeContextFn({ drawCards: undefined }));
      expect(result.success).toBe(true);
    });
  });

  describe("reveal effect", () => {
    it("should increment attributesRevealed on target", () => {
      mockPlayers[1].attributesRevealed = 0;
      const effect: Effect = { type: "reveal", value: 1, target: "left" };
      executor.execute(effect, makeContextFn());
      expect(mockPlayers[1].attributesRevealed).toBe(1);
    });

    it("should cap attributesRevealed at 2", () => {
      mockPlayers[1].attributesRevealed = 2;
      const effect: Effect = { type: "reveal", value: 1, target: "left" };
      executor.execute(effect, makeContextFn());
      expect(mockPlayers[1].attributesRevealed).toBe(2);
    });
  });

  describe("discard effect", () => {
    beforeEach(() => {
      mockPlayers[1].hand = [
        { id: "c1", type: "attack", name: "A", cost: 0, effects: [], description: "" },
        { id: "c2", type: "attack", name: "B", cost: 0, effects: [], description: "" },
        { id: "c3", type: "attack", name: "C", cost: 0, effects: [], description: "" },
      ];
      mockPlayers[1].discard = [];
    });

    it("should discard the specified number of cards", () => {
      const effect: Effect = { type: "discard", value: 2, target: "left" };
      executor.execute(effect, makeContextFn());
      expect(mockPlayers[1].hand.length).toBe(1);
      expect(mockPlayers[1].discard.length).toBe(2);
    });

    it("should discard all cards when value exceeds hand size", () => {
      const effect: Effect = { type: "discard", value: 10, target: "left" };
      executor.execute(effect, makeContextFn());
      expect(mockPlayers[1].hand.length).toBe(0);
      expect(mockPlayers[1].discard.length).toBe(3);
    });
  });
});
