# Gap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement five known gaps: player names, complete EffectExecutor (draw/reveal/peek/discard/shield), shield response phase, Resonate Ring UI, and timeout auto-actions with disconnect/reconnect.

**Architecture:** Server-authoritative. Shared types extended minimally (deadline, aoe, response phase). GameEngine holds response context internally (not in shared GameState). EffectExecutor gains callback-based draw/peek hooks so it stays decoupled from socket.io. Frontend gains ResonateModal component and response phase UI.

**Tech Stack:** TypeScript, Node.js, Socket.io 4, React 18, Zustand, Vite, Jest + ts-jest

**Spec:** `docs/superpowers/specs/2026-03-22-gap-implementation-design.md`

---

## File Map

| File | Status | Purpose |
|---|---|---|
| `packages/shared/src/types/game.ts` | Modify | Add `'response'` to PhaseType; add required `deadline: Date` to Phase |
| `apps/server/src/game/types.ts` | **New** | Server-internal `ResponseContext` and `ServerPhase extends Phase` interfaces |
| `packages/shared/src/types/card.ts` | Modify | Add `aoe?: boolean` to Card |
| `apps/server/src/game/cards/definitions.ts` | Modify | `aoe: true` on chainLightning; update peek descriptions |
| `apps/server/src/game/effects/executor.ts` | Modify | Extend EffectContext; implement all effect types |
| `apps/server/src/game/engine.ts` | Modify | drawCards, phase timers, response phase, pendingPeeks, updatePlayerId |
| `apps/server/src/game/state/manager.ts` | Modify | deadline on phases, skip disconnected in nextTurn |
| `apps/server/src/rooms/manager.ts` | Modify | playerName, name uniqueness, reconnect token, reconnect timer |
| `apps/server/src/websocket/server.ts` | Modify | respond/respondSkip handlers, game:peek emit, reconnect matching, playerName |
| `apps/web/src/services/socket.ts` | Modify | Add game:responseWindow and game:peek event types |
| `apps/web/src/pages/Home.tsx` | Modify | Send playerName; sessionStorage; auto-reconnect |
| `apps/web/src/pages/Join.tsx` | Modify | Send playerName; sessionStorage |
| `apps/web/src/components/ResonateModal.tsx` | **New** | Resonate Ring modal UI |
| `apps/web/src/components/PlayerBoard.tsx` | Modify | onClick → resonate handler |
| `apps/web/src/components/index.ts` | Modify | Export ResonateModal |
| `apps/web/src/pages/Game.tsx` | Modify | Response phase UI, resonate flow, game:peek handler |

---

## Task 1: Update Shared Types

**Files:**
- Modify: `packages/shared/src/types/game.ts`
- Modify: `packages/shared/src/types/card.ts`

- [ ] **Step 1: Edit `packages/shared/src/types/game.ts`**

Replace the existing `PhaseType` and `Phase` definitions:

```typescript
export type PhaseType = 'draw' | 'overload' | 'action' | 'resolution' | 'response';

export interface Phase {
  type: PhaseType;
  timeout?: number;
  validActions?: string[];
  deadline: Date;  // required; wall-clock expiry for client countdown timers
}
```

The rest of the file is unchanged.

**Note:** Making `deadline` required means all callers that construct a `Phase` object must supply it. This task fixes the shared type and the `GameStateManager` constructor/`startTurn` in the same commit so the codebase compiles after this task.

- [ ] **Step 1b: Patch `GameStateManager` constructor and `startTurn` to include `deadline`**

In `apps/server/src/game/state/manager.ts`, find every place that assigns a phase literal and add `deadline`. Specifically:

The constructor initializes the phase (find the line that sets `type: 'draw'` in the constructor body) — update it:

```typescript
this.state.phase = {
  type: 'draw',
  timeout: GAME_CONSTANTS.PHASE_TIMEOUT_DRAW,
  deadline: new Date(Date.now() + GAME_CONSTANTS.PHASE_TIMEOUT_DRAW),
};
```

The `startTurn` method does the same — update it identically.

Also find any other `setPhase` / direct phase assignments in `GameStateManager` that set `type: 'overload'` or `type: 'action'` and add matching `deadline` values using the appropriate constant. If the call is already in `GameEngine` (not in `GameStateManager`), ignore it here — those are fixed in Task 5 Step 3.

- [ ] **Step 2: Edit `packages/shared/src/types/card.ts`**

Add `aoe?: boolean` to the `Card` interface:

```typescript
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
```

- [ ] **Step 3: Rebuild shared package**

```bash
cd /Users/zhaomr/workdir/PsylentPhantom/packages/shared && npm run build
```

Expected: No errors. `dist/cjs/` and `dist/esm/` both rebuilt.

- [ ] **Step 4: Run existing server tests to check nothing broke**

```bash
cd /Users/zhaomr/workdir/PsylentPhantom/apps/server && npx jest --no-coverage
```

Expected: All existing tests pass. (The `deadline` field is required but the `GameStateManager` constructor and `startTurn` are already patched in Step 1b.)

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types/game.ts packages/shared/src/types/card.ts apps/server/src/game/state/manager.ts
git commit -m "feat(shared): add response PhaseType, Phase.deadline, Card.aoe; patch GameStateManager constructor"
```

---

## Task 2: Update Card Definitions

**Files:**
- Modify: `apps/server/src/game/cards/definitions.ts`
- Test: `apps/server/src/game/cards/definitions.test.ts`

- [ ] **Step 1: Add `aoe: true` to chainLightning; update peek descriptions**

In `ATTRIBUTE_CARDS.THUNDER.chainLightning`, add `aoe: true`:

```typescript
chainLightning: (id: string) => ({
  id: `chain-lightning-${id}`,
  type: 'ultimate',
  name: '连锁闪电',
  attribute: 'THUNDER',
  cost: 3,
  aoe: true,
  effects: [
    { type: 'damage', value: 2, target: 'left' },
    { type: 'damage', value: 2, target: 'right' },
  ],
  description: '对左右相邻玩家各造成2点伤害',
}),
```

Update `psychicSense` description:

```typescript
description: '偷看目标1个隐藏属性（自己揭示1个属性作为代价）',
```

Update `fateIntervention` description:

```typescript
description: '偷看目标2个隐藏属性，自己再抽1张牌',
```

- [ ] **Step 2: Write a test for the aoe flag**

In `apps/server/src/game/cards/definitions.test.ts`, add inside the existing `describe` block:

```typescript
it('should mark chainLightning as aoe', () => {
  const card = ATTRIBUTE_CARDS.THUNDER.chainLightning!('test');
  expect(card.aoe).toBe(true);
});

it('should not mark single-target cards as aoe', () => {
  const card = ATTRIBUTE_CARDS.THUNDER.thunderStrike!('test');
  expect(card.aoe).toBeFalsy();
});
```

- [ ] **Step 3: Run the definitions tests**

```bash
cd /Users/zhaomr/workdir/PsylentPhantom/apps/server && npx jest --testPathPattern "definitions" --no-coverage
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/game/cards/definitions.ts apps/server/src/game/cards/definitions.test.ts
git commit -m "feat(cards): mark chainLightning as aoe, update peek descriptions"
```

---

## Task 2.5: Create Server-Internal Type File

**Files:**
- Create: `apps/server/src/game/types.ts`

This file houses server-only types that extend shared types. Keeping them here prevents leaking internal state (like `responseContext`) through the shared package or via `getPlayerView()`.

**Architecture note:** `responseContext` is stored as a **private field** in `GameEngine` (not in the phase object). `getPlayerView()` naturally strips it because it reads `this.stateManager.getState().phase` which is a plain `Phase`. `ServerPhase` is defined here for completeness but is not required to be used as the phase type in practice — the private field approach is simpler and equally correct.

- [ ] **Step 1: Create `apps/server/src/game/types.ts`**

```typescript
import { Phase, Card } from '@psylent/shared';

export interface ResponseContext {
  attackerId: string;
  defenderId: string;
  pendingDamage: number;
  card: Card;  // full card object, stored until response resolves
}

// ServerPhase extends Phase with server-internal state.
// Not used as the stored phase type (responseContext lives in GameEngine private field),
// but provided for future use and documentation of the intended architecture.
export interface ServerPhase extends Phase {
  responseContext?: ResponseContext;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/zhaomr/workdir/PsylentPhantom/apps/server && npx tsc --noEmit
```

Expected: No errors (file is new; nothing imports it yet — that happens in Task 6).

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/game/types.ts
git commit -m "feat(server): add server-internal ResponseContext and ServerPhase types"
```

---

## Task 3: EffectExecutor — draw, reveal, discard

**Files:**
- Modify: `apps/server/src/game/effects/executor.ts`
- Test: `apps/server/src/game/effects/executor.test.ts`

- [ ] **Step 1: Extend EffectContext**

Replace the existing `EffectContext` interface at the top of `executor.ts`:

```typescript
import { Effect, EffectType, TargetType, Player, Condition, Attribute } from '@psylent/shared';

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
```

(Remove the unused `Card` import.)

- [ ] **Step 2: Implement `draw`, `reveal`, `discard` in `executeEffect`**

Replace the three stub cases inside `executeEffect`:

```typescript
case 'draw':
  const drawCount = typeof effect.value === 'number' ? effect.value : 0;
  if (context.drawCards) {
    context.drawCards(targetId, drawCount);
  }
  return {
    type: 'draw',
    success: true,
    value: drawCount,
    targetId,
    message: `${target.name} 抽 ${drawCount} 张牌`,
  };

case 'reveal':
  const revealCount = typeof effect.value === 'number' ? effect.value : 1;
  if (target.attributesRevealed === undefined) target.attributesRevealed = 0;
  target.attributesRevealed = Math.min(2, target.attributesRevealed + revealCount);
  return {
    type: 'reveal',
    success: true,
    value: target.attributesRevealed,
    targetId,
    message: `${target.name} 的属性被揭示（已揭示 ${target.attributesRevealed} 个）`,
  };

case 'discard':
  const discardCount = typeof effect.value === 'number' ? effect.value : 0;
  const actual = Math.min(discardCount, target.hand.length);
  for (let i = 0; i < actual; i++) {
    const idx = Math.floor(Math.random() * target.hand.length);
    const [discarded] = target.hand.splice(idx, 1);
    target.discard.push(discarded);
  }
  return {
    type: 'discard',
    success: true,
    value: actual,
    targetId,
    message: `${target.name} 弃了 ${actual} 张牌`,
  };
```

- [ ] **Step 3: Write failing tests for draw, reveal, discard**

Add to `executor.test.ts`, inside the existing `describe('EffectExecutor')`:

```typescript
// Helper context with required callbacks
const makeContext = (overrides: Partial<EffectContext> = {}): EffectContext => ({
  sourcePlayerId: 'p1',
  gameState: { players: mockPlayers, turn: 1 },
  drawCards: jest.fn(),
  onPeek: jest.fn(),
  ...overrides,
});

describe('draw effect', () => {
  it('should invoke drawCards callback with correct count', () => {
    const drawCards = jest.fn();
    const effect: Effect = { type: 'draw', value: 2, target: 'self' };
    const result = executor.execute(effect, makeContext({ drawCards }));

    expect(result.success).toBe(true);
    expect(drawCards).toHaveBeenCalledWith('p1', 2);
  });

  it('should succeed even without drawCards callback', () => {
    const effect: Effect = { type: 'draw', value: 1, target: 'self' };
    const result = executor.execute(effect, makeContext({ drawCards: undefined }));
    expect(result.success).toBe(true);
  });
});

describe('reveal effect', () => {
  it('should increment attributesRevealed on target', () => {
    mockPlayers[1].attributesRevealed = 0;
    const effect: Effect = { type: 'reveal', value: 1, target: 'left' };
    executor.execute(effect, makeContext());
    expect(mockPlayers[1].attributesRevealed).toBe(1);
  });

  it('should cap attributesRevealed at 2', () => {
    mockPlayers[1].attributesRevealed = 2;
    const effect: Effect = { type: 'reveal', value: 1, target: 'left' };
    executor.execute(effect, makeContext());
    expect(mockPlayers[1].attributesRevealed).toBe(2);
  });
});

describe('discard effect', () => {
  beforeEach(() => {
    mockPlayers[1].hand = [
      { id: 'c1', type: 'attack', name: 'A', cost: 0, effects: [], description: '' },
      { id: 'c2', type: 'attack', name: 'B', cost: 0, effects: [], description: '' },
      { id: 'c3', type: 'attack', name: 'C', cost: 0, effects: [], description: '' },
    ];
    mockPlayers[1].discard = [];
  });

  it('should discard the specified number of cards', () => {
    const effect: Effect = { type: 'discard', value: 2, target: 'left' };
    executor.execute(effect, makeContext());
    expect(mockPlayers[1].hand.length).toBe(1);
    expect(mockPlayers[1].discard.length).toBe(2);
  });

  it('should discard all cards when value exceeds hand size', () => {
    const effect: Effect = { type: 'discard', value: 10, target: 'left' };
    executor.execute(effect, makeContext());
    expect(mockPlayers[1].hand.length).toBe(0);
    expect(mockPlayers[1].discard.length).toBe(3);
  });
});
```

Also update the existing `baseContext` in `beforeEach` to add optional callbacks:

```typescript
baseContext = {
  sourcePlayerId: 'p1',
  gameState: { players: mockPlayers, turn: 1 },
  drawCards: jest.fn(),
  onPeek: jest.fn(),
};
```

- [ ] **Step 4: Run tests — expect new tests to pass, existing to still pass**

```bash
cd /Users/zhaomr/workdir/PsylentPhantom/apps/server && npx jest --testPathPattern "executor" --no-coverage
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/game/effects/executor.ts apps/server/src/game/effects/executor.test.ts
git commit -m "feat(executor): implement draw, reveal, discard effects"
```

---

## Task 4: EffectExecutor — peek and shield

**Files:**
- Modify: `apps/server/src/game/effects/executor.ts`
- Test: `apps/server/src/game/effects/executor.test.ts`

- [ ] **Step 1: Implement `peek` in `executeEffect`**

Replace the existing peek stub:

```typescript
case 'peek':
  const peekCount = typeof effect.value === 'number' ? effect.value : 1;
  if (context.onPeek) {
    // Reveal up to peekCount of target's attributes (privately to source)
    const revealed = target.attributes.slice(0, peekCount);
    revealed.forEach(attr => context.onPeek!(targetId, attr));
  }
  return {
    type: 'peek',
    success: true,
    value: peekCount,
    targetId,
    message: `偷看了 ${target.name} 的属性`,
  };
```

- [ ] **Step 2: Implement `shield` in `executeEffect`**

Replace the existing shield stub:

```typescript
case 'shield':
  const shieldPercent = typeof effect.value === 'number' ? effect.value : 0;
  const pending = context.pendingDamage ?? 0;
  const reducedDamage = Math.floor(pending * (1 - shieldPercent / 100));
  return {
    type: 'shield',
    success: true,
    value: reducedDamage,
    targetId,
    message: `${target.name} 格挡，最终伤害 ${reducedDamage}`,
  };
```

- [ ] **Step 3: Write failing tests for peek and shield**

Add to `executor.test.ts`:

```typescript
describe('peek effect', () => {
  it('should call onPeek with one target attribute', () => {
    const onPeek = jest.fn();
    const effect: Effect = { type: 'peek', value: 1, target: 'left' };
    const result = executor.execute(effect, makeContext({ onPeek }));

    expect(result.success).toBe(true);
    expect(onPeek).toHaveBeenCalledTimes(1);
    const [targetId, attr] = onPeek.mock.calls[0];
    expect(targetId).toBe('p2');
    expect(['PSYCHIC', 'FATE']).toContain(attr);
  });

  it('should call onPeek twice for value 2', () => {
    const onPeek = jest.fn();
    const effect: Effect = { type: 'peek', value: 2, target: 'left' };
    executor.execute(effect, makeContext({ onPeek }));
    expect(onPeek).toHaveBeenCalledTimes(2);
  });

  it('should not call onPeek if callback is absent', () => {
    const effect: Effect = { type: 'peek', value: 1, target: 'left' };
    expect(() => executor.execute(effect, makeContext({ onPeek: undefined }))).not.toThrow();
  });
});

describe('shield effect', () => {
  it('should return 50% reduced damage for shield value 50', () => {
    const effect: Effect = { type: 'shield', value: 50, target: 'self' };
    const result = executor.execute(effect, makeContext({ pendingDamage: 4 }));
    expect(result.success).toBe(true);
    expect(result.value).toBe(2); // floor(4 * 0.5)
  });

  it('should return 0 damage for shield value 100', () => {
    const effect: Effect = { type: 'shield', value: 100, target: 'self' };
    const result = executor.execute(effect, makeContext({ pendingDamage: 5 }));
    expect(result.value).toBe(0);
  });

  it('should return full pending damage when no pendingDamage in context', () => {
    const effect: Effect = { type: 'shield', value: 50, target: 'self' };
    const result = executor.execute(effect, makeContext({ pendingDamage: undefined }));
    expect(result.value).toBe(0); // floor(0 * 0.5)
  });
});
```

- [ ] **Step 4: Run executor tests**

```bash
cd /Users/zhaomr/workdir/PsylentPhantom/apps/server && npx jest --testPathPattern "executor" --no-coverage
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/game/effects/executor.ts apps/server/src/game/effects/executor.test.ts
git commit -m "feat(executor): implement peek and shield effects"
```

---

## Task 5: GameEngine — drawCards, phase deadlines, pendingPeeks

**Files:**
- Modify: `apps/server/src/game/engine.ts`
- Modify: `apps/server/src/game/state/manager.ts`
- Test: `apps/server/src/game/engine.test.ts`

- [ ] **Step 1: Add `drawCards` public method + `pendingPeeks` to GameEngine**

At the top of the `GameEngine` class (after existing private fields), add:

```typescript
private pendingPeeks: Array<{ sourcePlayerId: string; targetId: string; attribute: Attribute }> = [];
```

Add a public `drawCards` method (replacing the private `drawCard`):

```typescript
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
```

Update all internal uses of `this.drawCard(player)` to `this.drawCards(player.id, 1)`, then **delete the old private `drawCard` method**.

Add a method to flush pending peeks (called by websocket server after each action):

```typescript
flushPendingPeeks(): Array<{ sourcePlayerId: string; targetId: string; attribute: Attribute }> {
  const peeks = [...this.pendingPeeks];
  this.pendingPeeks = [];
  return peeks;
}
```

- [ ] **Step 2: Pass drawCards + onPeek callbacks when building EffectContext**

In `GameEngine.playCard()`, replace the context construction:

```typescript
const context = {
  sourcePlayerId: playerId,
  targetPlayerId: targetId,
  gameState: this.stateManager.getState(),
  drawCards: this.drawCards.bind(this),
  onPeek: (tId: string, attribute: Attribute) => {
    this.pendingPeeks.push({ sourcePlayerId: playerId, targetId: tId, attribute });
  },
};
```

- [ ] **Step 3: Add deadline to phases in GameStateManager**

In `apps/server/src/game/state/manager.ts`, fix the constructor's initial `phase` to include `deadline`. The constructor currently sets a phase without a deadline; since `deadline` is now required, it must be initialized:

```typescript
// In constructor, replace the initial phase assignment with:
this.state.phase = {
  type: 'draw',
  timeout: GAME_CONSTANTS.PHASE_TIMEOUT_DRAW,
  deadline: new Date(Date.now() + GAME_CONSTANTS.PHASE_TIMEOUT_DRAW),
};
```

Update `startTurn` similarly:

```typescript
startTurn(playerId: string): void {
  this.state.currentPlayerId = playerId;
  this.state.phase = {
    type: 'draw',
    timeout: GAME_CONSTANTS.PHASE_TIMEOUT_DRAW,
    deadline: new Date(Date.now() + GAME_CONSTANTS.PHASE_TIMEOUT_DRAW),
  };
}
```

Update `setPhase` — no signature change needed; callers will pass the full `Phase` including deadline:

```typescript
setPhase(phase: Phase): void {
  this.state.phase = phase;
}
```

In `GameEngine.selectDrawCard()`, update the setPhase call:

```typescript
this.stateManager.setPhase({
  type: 'overload',
  timeout: GAME_CONSTANTS.PHASE_TIMEOUT_OVERLOAD,
  deadline: new Date(Date.now() + GAME_CONSTANTS.PHASE_TIMEOUT_OVERLOAD),
});
```

In `GameEngine.overload()`, update both setPhase calls:

```typescript
this.stateManager.setPhase({
  type: 'action',
  timeout: GAME_CONSTANTS.PHASE_TIMEOUT_ACTION,
  deadline: new Date(Date.now() + GAME_CONSTANTS.PHASE_TIMEOUT_ACTION),
});
```

- [ ] **Step 3b: Fix `selectDrawCard` off-by-one when deck has only 1 card**

In `selectDrawCard`, the current line `const revealed = options[1 - selectedIndex]` crashes (returns `undefined`) when only 1 draw option exists. Apply a minimal targeted fix — add one guard around the `deck.push(revealed)` line:

```typescript
// BEFORE (current code, broken when options.length === 1):
const revealed = options[1 - selectedIndex];
player.deck.push(revealed);

// AFTER (safe):
if (options.length > 1) {
  const revealed = options[1 - selectedIndex];
  player.deck.push(revealed);
}
```

Also add `deadline` to the `setPhase` call in `selectDrawCard` (required since Task 1):

```typescript
this.stateManager.setPhase({
  type: 'overload',
  timeout: GAME_CONSTANTS.PHASE_TIMEOUT_OVERLOAD,
  deadline: new Date(Date.now() + GAME_CONSTANTS.PHASE_TIMEOUT_OVERLOAD),
});
```

**Note:** The `isAutoAction` parameter, `clearPhaseTimer`, `resetTimeout`, and `schedulePhaseTimeout` calls are added to `selectDrawCard` in **Task 7** (not here). Apply only these two changes now.

- [ ] **Step 4: Fix existing engine tests (add `startGamePlay()` call; fix card-play test)**

In `engine.test.ts`, update each test that calls `selectAttributes` for both players to then call `engine.startGamePlay()`:

```typescript
it('should start game after all players select attributes', () => {
  engine.startGame();
  expect(engine.getState().status).toBe('selecting');

  engine.selectAttributes('p1', ['THUNDER', 'HEAT']);
  engine.selectAttributes('p2', ['PSYCHIC', 'FATE']);
  engine.startGamePlay();  // <-- add this

  expect(engine.getState().status).toBe('playing');
  expect(engine.getState().players[0].hand.length).toBe(GAME_CONSTANTS.STARTING_HAND_SIZE);
});

it('should handle successful resonate', () => {
  engine.startGame();
  engine.selectAttributes('p1', ['THUNDER', 'HEAT']);
  engine.selectAttributes('p2', ['PSYCHIC', 'FATE']);
  engine.startGamePlay();  // <-- add this
  // ... rest unchanged
});

it('should handle failed resonate', () => {
  engine.startGame();
  engine.selectAttributes('p1', ['THUNDER', 'HEAT']);
  engine.selectAttributes('p2', ['PSYCHIC', 'FATE']);
  engine.startGamePlay();  // <-- add this
  // ... rest unchanged
});
```

**Card-play test fix:** The existing `it('should handle card play', ...)` test likely plays a damage card (from `generateDeck()`) and asserts `discard.length === 1`. After Task 6, damage cards enter the response phase and are NOT immediately pushed to discard — so that assertion will fail.

**Action: Find and DELETE the entire existing `it('should handle card play', ...)` block** in `engine.test.ts`. Then add the following replacement test (which uses a non-damage card that bypasses the response phase):

```typescript
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
    type: 'attack' as const,  // 'utility' is not a valid CardType; use 'attack'
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
```

- [ ] **Step 5: Run all server tests**

```bash
cd /Users/zhaomr/workdir/PsylentPhantom/apps/server && npx jest --no-coverage
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/game/engine.ts apps/server/src/game/state/manager.ts apps/server/src/game/engine.test.ts
git commit -m "feat(engine): add drawCards, phase deadlines, pendingPeeks"
```

---

## Task 6: Response Phase in GameEngine

**Files:**
- Modify: `apps/server/src/game/engine.ts`
- Test: `apps/server/src/game/engine.test.ts`

- [ ] **Step 1: Import `ResponseContext` from server types; add fields to GameEngine**

`ResponseContext` is already defined in `apps/server/src/game/types.ts` (created in Task 2.5). Import it at the top of `engine.ts`:

```typescript
import { ResponseContext } from './types';
```

Note that `ResponseContext.card` is a full `Card` object (not just a `cardId: string`). This is critical: `resolveResponse` must push the real card to discard, not a stub. The `types.ts` definition is:
```typescript
// Already in apps/server/src/game/types.ts:
export interface ResponseContext {
  attackerId: string;
  defenderId: string;
  pendingDamage: number;
  card: Card;  // full card object stored until response resolves
}
```

Inside the `GameEngine` class, add private fields:

```typescript
private responseContext: ResponseContext | null = null;
private responseTimer: ReturnType<typeof setTimeout> | null = null;
```

- [ ] **Step 2: Modify `playCard` to detect single-target damage and start response phase**

Replace the body of `playCard` with the following logic. The key change is: for non-AoE cards with a damage effect, don't apply damage immediately — enter response phase instead.

```typescript
playCard(playerId: string, cardId: string, targetId?: string): void {
  const player = this.getPlayer(playerId);
  const cardIndex = player.hand.findIndex(c => c.id === cardId);
  if (cardIndex === -1) throw new Error('Card not in hand');

  const card = player.hand.splice(cardIndex, 1)[0];

  // Check if this is a single-target damage card that triggers response phase
  const damageEffects = card.effects.filter(e => e.type === 'damage');
  const hasSingleTargetDamage =
    !card.aoe &&
    damageEffects.length > 0 &&
    damageEffects.every(e => e.target !== 'all');

  if (hasSingleTargetDamage) {
    // Resolve non-damage effects immediately (e.g., conditional non-damage chains)
    // Compute pending damage without applying it
    let pendingDamage = 0;
    const state = this.stateManager.getState();

    for (const effect of card.effects) {
      if (effect.type === 'damage') {
        // Resolve target for this damage effect
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

        // Check condition for this damage effect
        const context = {
          sourcePlayerId: playerId,
          targetPlayerId: resolvedTargetId,
          gameState: state,
          drawCards: this.drawCards.bind(this),
          onPeek: (tId: string, attribute: Attribute) => {
            this.pendingPeeks.push({ sourcePlayerId: playerId, targetId: tId, attribute });
          },
        };
        if (!effect.condition || this.effectExecutor['checkCondition'](effect.condition, context)) {
          pendingDamage += typeof effect.value === 'number' ? effect.value : 0;
        }
        // Use first damage effect's target as the defender
        if (!this.responseContext) {
          this.responseContext = {
            attackerId: playerId,
            defenderId: resolvedTargetId,
            pendingDamage: 0, // will be set below
            card,             // full Card object; moved to discard after response resolves
          };
        }
      }
    }

    this.responseContext!.pendingDamage = pendingDamage;

    // Enter response phase (10 second window)
    const RESPONSE_TIMEOUT = 10000;
    this.stateManager.setPhase({
      type: 'response',
      timeout: RESPONSE_TIMEOUT,
      deadline: new Date(Date.now() + RESPONSE_TIMEOUT),
    });

    // Timeout fires full damage
    this.responseTimer = setTimeout(() => {
      this.resolveResponse(null);
    }, RESPONSE_TIMEOUT);

    return; // Don't call endTurn yet
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
```

- [ ] **Step 3: Add `respond`, `respondSkip`, and `resolveResponse` methods**

```typescript
respond(defenderId: string, cardId: string): void {
  if (!this.responseContext) throw new Error('Not in response phase');
  if (this.responseContext.defenderId !== defenderId) throw new Error('Not your turn to respond');

  const defender = this.getPlayer(defenderId);
  const cardIndex = defender.hand.findIndex(c => c.id === cardId);
  if (cardIndex === -1) throw new Error('Card not in hand');

  const card = defender.hand[cardIndex];
  const shieldEffect = card.effects.find(e => e.type === 'shield');
  if (!shieldEffect) throw new Error('Card has no shield effect');

  // Calculate reduced damage
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

  // Remove defense card from hand
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

  // Apply damage
  const damage = reducedDamage !== null ? reducedDamage : ctx.pendingDamage;
  const defender = this.getPlayer(ctx.defenderId);
  defender.hp = Math.max(0, defender.hp - damage);

  // Move attack card to attacker's discard (ctx.card is the full Card object)
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
}
```

- [ ] **Step 4: Write tests for response phase**

In `engine.test.ts`, add a new describe block. You need to first initialize the game. Use a helper:

```typescript
function initGame(engine: GameEngine) {
  engine.startGame();
  engine.selectAttributes('p1', ['THUNDER', 'HEAT']);
  engine.selectAttributes('p2', ['PSYCHIC', 'FATE']);
  engine.startGamePlay();
}

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

    // Give p1 a punch card (single-target damage)
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
    jest.runAllTimers(); // trigger timeout

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
```

- [ ] **Step 5: Run engine tests**

```bash
cd /Users/zhaomr/workdir/PsylentPhantom/apps/server && npx jest --testPathPattern "engine" --no-coverage
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/game/engine.ts apps/server/src/game/engine.test.ts
git commit -m "feat(engine): implement response phase, respond/respondSkip, updatePlayerId"
```

---

## Task 7: Phase Timers + Timeout Auto-Actions + Turn Skip

**Files:**
- Modify: `apps/server/src/game/engine.ts`
- Modify: `apps/server/src/game/state/manager.ts`
- Test: `apps/server/src/game/engine.test.ts`

- [ ] **Step 1: Add phase timer management to GameEngine**

Add private field to `GameEngine`:

```typescript
private phaseTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
```

Add private helpers:

```typescript
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
    const player = this.stateManager.getState().players.find(p => p.id === playerId);
    if (player) {
      player.consecutiveTimeouts++;
      if (player.consecutiveTimeouts >= 3) {
        player.isConnected = false;
      }
    }
    action();
  }, ms);
  this.phaseTimers.set(playerId, timer);
}
```

- [ ] **Step 2: Schedule timers in startTurn and phase transitions**

In `GameStateManager.startTurn()` add a call back to engine after setting the phase. Actually, `stateManager` doesn't know about the engine. Instead, call `schedulePhaseTimeout` inside `GameEngine` after calling `stateManager.startTurn()`.

Add an `isAutoAction: boolean = false` parameter to `selectDrawCard`, `overload`, and `skipTurn`. Guard `resetTimeout` with `if (!isAutoAction)`:

```typescript
selectDrawCard(playerId: string, index: number, isAutoAction = false): void {
  this.clearPhaseTimer(playerId);
  if (!isAutoAction) this.resetTimeout(playerId);
  // ... rest of existing method unchanged
}

overload(playerId: string, takeOverload: boolean, isAutoAction = false): void {
  this.clearPhaseTimer(playerId);
  if (!isAutoAction) this.resetTimeout(playerId);
  // ... rest of existing method unchanged
}

skipTurn(playerId: string, isAutoAction = false): void {
  this.clearPhaseTimer(playerId);
  if (!isAutoAction) this.resetTimeout(playerId);
  // ... rest of existing method unchanged
}
```

Add a private `startTurnWithTimer(playerId)` method in `GameEngine`:

```typescript
private startTurnWithTimer(playerId: string): void {
  this.stateManager.startTurn(playerId);
  this.schedulePhaseTimeout(playerId, GAME_CONSTANTS.PHASE_TIMEOUT_DRAW, () => {
    // Auto-action: pass isAutoAction=true so consecutiveTimeouts increment is NOT reset
    if (!this.pendingDraws.has(playerId)) {
      try { this.startDrawPhase(playerId); } catch { return; }
    }
    try { this.selectDrawCard(playerId, 0, true); } catch { /* ignore */ }
  });
}
```

In `selectDrawCard`, after `stateManager.setPhase(overload)`, schedule overload timer (passes `isAutoAction = true` to overload callback):

```typescript
this.schedulePhaseTimeout(playerId, GAME_CONSTANTS.PHASE_TIMEOUT_OVERLOAD, () => {
  try { this.overload(playerId, false, true); } catch { /* ignore */ }
});
```

In `overload`, after `stateManager.setPhase(action)`, schedule action timer (passes `isAutoAction = true`):

```typescript
this.schedulePhaseTimeout(playerId, GAME_CONSTANTS.PHASE_TIMEOUT_ACTION, () => {
  try { this.skipTurn(playerId, true); } catch { /* ignore */ }
});
```

**Wire `startTurnWithTimer` into `endTurn` and `initializeGame` (CRITICAL — without this, no phase timers ever fire):**

In `endTurn()`, find the call `this.stateManager.startTurn(nextPlayerId)` (or equivalent) and replace it with:

```typescript
this.startTurnWithTimer(nextPlayerId);
```

In `initializeGame()` (or wherever the very first turn is started after `setStatus('playing')`), replace the `this.stateManager.startTurn(...)` call with:

```typescript
this.startTurnWithTimer(state.players[0].id);
```

In `playCard` (at the start, before any other logic), clear the current player's timer and reset timeout (player-initiated action):

```typescript
this.clearPhaseTimer(playerId);
this.resetTimeout(playerId);
```

In `resonate` — add `this.clearPhaseTimer(playerId)` and `this.resetTimeout(playerId)` at the top.

- [ ] **Step 3: Skip disconnected/timed-out players in nextTurn**

In `GameStateManager.nextTurn()`:

```typescript
nextTurn(): void {
  const players = this.state.players;
  let currentIndex = players.findIndex(p => p.id === this.state.currentPlayerId);
  let nextIndex = (currentIndex + 1) % players.length;
  let loops = 0;

  while (
    loops < players.length &&
    (!players[nextIndex].isConnected || players[nextIndex].consecutiveTimeouts >= 3)
  ) {
    nextIndex = (nextIndex + 1) % players.length;
    loops++;
  }

  // If all players are disconnected/kicked, end game with no winner
  if (loops >= players.length) {
    this.state.status = 'finished';
    return;
  }

  this.state.currentPlayerId = players[nextIndex].id;
  this.state.turn++;
}
```

- [ ] **Step 4: Add `resetTimeout` helper**

In `GameEngine`, add the private helper (already called per Step 2 above):

```typescript
private resetTimeout(playerId: string): void {
  const player = this.stateManager.getState().players.find(p => p.id === playerId);
  if (player) player.consecutiveTimeouts = 0;
}
```

`resetTimeout` is called only when `isAutoAction === false` (real player actions). It is **not** called in `respond`/`respondSkip` (response-phase timeouts are neutral — neither increment nor reset). See Step 2 for where each call is placed.

- [ ] **Step 5: Write timeout tests**

In `engine.test.ts`, add a new `describe('phase timers')` block:

```typescript
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
```

- [ ] **Step 6: Run all server tests**

```bash
cd /Users/zhaomr/workdir/PsylentPhantom/apps/server && npx jest --no-coverage
```

Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/game/engine.ts apps/server/src/game/state/manager.ts apps/server/src/game/engine.test.ts
git commit -m "feat(engine): phase timers, timeout auto-actions, turn skip for disconnected players"
```

---

## Task 8: RoomManager — Player Names + Reconnect

**Files:**
- Modify: `apps/server/src/rooms/manager.ts`

- [ ] **Step 1: Add playerName to createRoom and joinRoom; enforce name uniqueness; add reconnect infrastructure**

Replace the full `manager.ts` with:

```typescript
import { Room } from './types';
import { Player, GAME_CONSTANTS } from '@psylent/shared';
import { GameEngine } from '../game/engine';
import { v4 as uuidv4 } from 'uuid';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private playerRoomMap: Map<string, string> = new Map();
  private reconnectTokens: Map<string, string> = new Map();   // playerId → token
  private reconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map(); // playerId → timer

  private generateRoomCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  private truncateName(name: string): string {
    return (name || 'Player').slice(0, 20);
  }

  createRoom(name: string, maxPlayers: number, hostId: string, playerName: string): { room: Room; reconnectToken: string } {
    const roomCode = this.generateRoomCode();
    const room: Room = {
      id: roomCode,
      name: name || `Room ${roomCode}`,
      maxPlayers: Math.min(maxPlayers || 4, 4),
      players: [],
      status: 'waiting',
      hostId,
      createdAt: new Date(),
    };
    this.rooms.set(room.id, room);

    // Add host as first player
    const truncated = this.truncateName(playerName);
    const player: Player = {
      id: hostId,
      name: truncated,
      hp: GAME_CONSTANTS.STARTING_HP,
      maxHp: GAME_CONSTANTS.MAX_HP,
      hand: [], deck: [], discard: [], attributes: [],
      energy: GAME_CONSTANTS.RESONATE_COST,
      isConnected: true,
      consecutiveTimeouts: 0,
    };
    room.players.push(player);
    this.playerRoomMap.set(hostId, roomCode);

    const reconnectToken = uuidv4();
    this.reconnectTokens.set(hostId, reconnectToken);

    return { room, reconnectToken };
  }

  joinRoom(roomId: string, playerId: string, playerName: string): { room: Room; reconnectToken: string } {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    const truncated = this.truncateName(playerName);

    // Reconnect check FIRST — must work even if game is already in progress
    const disconnected = room.players.find(
      p => !p.isConnected && p.name === truncated
    );
    if (disconnected) {
      return this.reconnectPlayer(room, disconnected, playerId);
    }

    // Only allow fresh joins while room is in 'waiting' state
    if (room.status !== 'waiting') throw new Error('Game already in progress');
    if (room.players.length >= room.maxPlayers) throw new Error('Room is full');

    // Name uniqueness check
    if (room.players.some(p => p.name === truncated)) {
      throw new Error('Name already taken in this room');
    }

    const player: Player = {
      id: playerId,
      name: truncated,
      hp: GAME_CONSTANTS.STARTING_HP,
      maxHp: GAME_CONSTANTS.MAX_HP,
      hand: [], deck: [], discard: [], attributes: [],
      energy: GAME_CONSTANTS.RESONATE_COST,
      isConnected: true,
      consecutiveTimeouts: 0,
    };
    room.players.push(player);
    this.playerRoomMap.set(playerId, roomId);

    const reconnectToken = uuidv4();
    this.reconnectTokens.set(playerId, reconnectToken);

    return { room, reconnectToken };
  }

  private reconnectPlayer(room: Room, player: Player, newSocketId: string): { room: Room; reconnectToken: string } {
    const oldId = player.id;

    // Clear reconnect timer
    const timer = this.reconnectTimers.get(oldId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(oldId);
    }

    // Update maps
    this.playerRoomMap.delete(oldId);
    this.playerRoomMap.set(newSocketId, room.id);
    this.reconnectTokens.delete(oldId);

    // Update player state
    player.id = newSocketId;
    player.isConnected = true;
    player.consecutiveTimeouts = 0;

    // Patch responseContext if needed
    room.game?.updatePlayerId(oldId, newSocketId);

    const reconnectToken = uuidv4();
    this.reconnectTokens.set(newSocketId, reconnectToken);

    return { room, reconnectToken };
  }

  handleDisconnect(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === playerId);
    if (!player) return;
    player.isConnected = false;

    // Start reconnect grace period timer
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(playerId);
      this.leaveRoom(roomId, playerId);
    }, GAME_CONSTANTS.RECONNECT_GRACE_PERIOD);

    this.reconnectTimers.set(playerId, timer);
  }

  leaveRoom(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.players = room.players.filter(p => p.id !== playerId);
    this.playerRoomMap.delete(playerId);
    this.reconnectTokens.delete(playerId);
    if (room.players.length === 0) this.rooms.delete(roomId);
  }

  startGame(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');
    room.status = 'playing';
    room.game = new GameEngine(roomId, room.players);
    room.game.startGame();
  }

  getRoom(roomId: string): Room | undefined { return this.rooms.get(roomId); }
  getRoomIdForPlayer(playerId: string): string | undefined { return this.playerRoomMap.get(playerId); }
  getGame(roomId: string): GameEngine | undefined { return this.rooms.get(roomId)?.game; }

  getPublicRooms() {
    return Array.from(this.rooms.values())
      .filter(r => r.status === 'waiting')
      .map(r => ({ id: r.id, name: r.name, playerCount: r.players.length, maxPlayers: r.maxPlayers }));
  }
}
```

- [ ] **Step 2: Run all server tests**

```bash
cd /Users/zhaomr/workdir/PsylentPhantom/apps/server && npx jest --no-coverage
```

Expected: All pass (RoomManager is not directly tested; websocket integration tests exist).

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/rooms/manager.ts
git commit -m "feat(rooms): player names, name uniqueness, reconnect token and timer"
```

---

## Task 9: WebSocket Server — New Handlers

**Files:**
- Modify: `apps/server/src/websocket/server.ts`

- [ ] **Step 1: Update room:create and room:join to pass playerName and return token**

In `socket.on('room:create')`:

```typescript
socket.on('room:create', (data, callback) => {
  try {
    const { room, reconnectToken } = roomManager.createRoom(
      data.name, data.maxPlayers, socket.id, data.playerName || 'Player'
    );
    socket.join(room.id);
    callback({ success: true, room, reconnectToken });
  } catch (error) {
    callback({ success: false, error: (error as Error).message });
  }
});
```

In `socket.on('room:join')`, replace with reconnect-aware logic:

```typescript
socket.on('room:join', (data, callback) => {
  try {
    const existingRoom = roomManager.getRoom(data.roomId);
    const isAlreadyInRoom = existingRoom?.players.some(p => p.id === socket.id);

    if (isAlreadyInRoom) {
      callback({ success: true, room: existingRoom!, reconnectToken: null });
      return;
    }

    // Detect reconnect BEFORE mutating the room (joinRoom will change player.id and isConnected).
    // A reconnect is when a disconnected player with the same name exists in the room.
    const truncatedName = (data.playerName || 'Player').slice(0, 20);
    const wasReconnect = !!(existingRoom?.players.some(
      p => !p.isConnected && p.name === truncatedName
    ));

    const { room, reconnectToken } = roomManager.joinRoom(
      data.roomId, socket.id, data.playerName || 'Player'
    );
    socket.join(room.id);

    if (wasReconnect) {
      io.to(room.id).emit('player:reconnected', {
        playerId: socket.id,
        playerName: room.players.find(p => p.id === socket.id)?.name,
      });
      const game = roomManager.getGame(room.id);
      if (game) broadcastGameState(io, room.id, game);
    } else {
      io.to(room.id).emit('room:update', { players: room.players, maxPlayers: room.maxPlayers });
    }

    callback({ success: true, room, reconnectToken });
  } catch (error) {
    callback({ success: false, error: (error as Error).message });
  }
});
```

**Why this works:** `wasReconnect` is evaluated BEFORE `roomManager.joinRoom()` mutates the room. It checks for a disconnected player matching the name, which is the exact same check `RoomManager.joinRoom()` uses internally. After `joinRoom()` runs, `wasReconnect` accurately reflects what happened.

- [ ] **Step 2: Add `respond` and `respondSkip` to `handleGameAction`**

In `handleGameAction`, add two new cases:

```typescript
case 'respond':
  game.respond(playerId, action.cardId);
  break;
case 'respondSkip':
  game.respondSkip(playerId);
  break;
```

- [ ] **Step 3: Emit `game:responseWindow` to defender when response phase starts**

In `broadcastGameState`, detect when game enters response phase and emit to defender:

```typescript
function broadcastGameState(io: Server, roomId: string, game: GameEngine): void {
  const state = game.getState();
  const readyPlayers = new Set(game.getReadyPlayers());

  // Emit personalized view to each player
  state.players.forEach(player => {
    const playerView = game.getPlayerView(player.id, readyPlayers);
    io.to(player.id).emit('game:state', { state: playerView });
  });

  // Emit responseWindow to defender if entering response phase
  const responseCtx = game.getResponseContext();
  if (state.phase.type === 'response' && responseCtx) {
    const timeoutMs = Math.max(0, state.phase.deadline.getTime() - Date.now());
    io.to(responseCtx.defenderId).emit('game:responseWindow', {
      pendingDamage: responseCtx.pendingDamage,
      timeoutMs,
    });
  }

  // NOTE: Do NOT emit a room-wide game:state here. Each player already received their
  // personalized view above. A room-wide emit would overwrite those with a minimal
  // object, breaking the per-player state model.
}
```

- [ ] **Step 4: Emit `game:peek` after each action**

In `socket.on('game:action')`, after `broadcastGameState`, flush peeks:

```typescript
socket.on('game:action', (data, callback) => {
  try {
    const roomId = roomManager.getRoomIdForPlayer(socket.id);
    if (!roomId) throw new Error('Not in a room');
    const game = roomManager.getGame(roomId);
    if (!game) throw new Error('Game not started');

    const result = handleGameAction(game, socket.id, data);
    broadcastGameState(io, roomId, game);

    // Emit peek events to source player only
    const peeks = game.flushPendingPeeks();
    peeks.forEach(peek => {
      io.to(peek.sourcePlayerId).emit('game:peek', {
        targetId: peek.targetId,
        attribute: peek.attribute,
      });
    });

    callback?.({ success: true, result });
  } catch (error) {
    callback?.({ success: false, error: (error as Error).message });
  }
});
```

- [ ] **Step 5: Build server to check for TypeScript errors**

```bash
cd /Users/zhaomr/workdir/PsylentPhantom/apps/server && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/websocket/server.ts
git commit -m "feat(websocket): respond/respondSkip handlers, game:peek, game:responseWindow, reconnect matching"
```

---

## Task 10: Frontend — Socket Types + Player Names + Session Storage

**Files:**
- Modify: `apps/web/src/services/socket.ts`
- Modify: `apps/web/src/pages/Home.tsx`
- Modify: `apps/web/src/pages/Join.tsx`

- [ ] **Step 1: Update `socket.ts` event types**

Add to `ServerEvents`:

```typescript
export interface ServerEvents {
  'game:state': (data: { state: PlayerViewState }) => void;
  'room:update': (data: { players: any[]; maxPlayers: number }) => void;
  'player:disconnected': (data: { playerId: string }) => void;
  'player:reconnected': (data: { playerId: string; playerName: string }) => void;
  'game:responseWindow': (data: { pendingDamage: number; timeoutMs: number }) => void;
  'game:peek': (data: { targetId: string; attribute: string }) => void;
}
```

Update `ClientEvents` to include `playerName`:

```typescript
export interface ClientEvents {
  'room:create': (data: { name: string; maxPlayers: number; playerName: string }, callback: (result: any) => void) => void;
  'room:join': (data: { roomId: string; playerName: string }, callback: (result: any) => void) => void;
  'game:selectAttributes': (data: { attributes: [string, string] }, callback: (result: any) => void) => void;
  'game:action': (data: any, callback: (result: any) => void) => void;
}
```

- [ ] **Step 2: Update `Home.tsx`**

Changes:
1. Send `playerName` in `room:create`
2. Store session data in `sessionStorage` on success
3. On mount, attempt silent reconnect if session exists

Replace the `createRoom` function and `useEffect`:

```typescript
useEffect(() => {
  const socket = connectSocket();

  socket.on('connect', () => {
    setConnected(true);
    setSocketId(socket.id || null);

    // Attempt silent reconnect if session exists
    const savedRoomId = sessionStorage.getItem('roomId');
    const savedPlayerName = sessionStorage.getItem('playerName');
    if (savedRoomId && savedPlayerName) {
      socket.emit('room:join', { roomId: savedRoomId, playerName: savedPlayerName }, (result: any) => {
        if (result.success) {
          const status = result.room?.status;
          if (status === 'playing' || status === 'selecting') {
            navigate(`/game/${savedRoomId}`);
          } else {
            navigate(`/room/${savedRoomId}`);
          }
        } else {
          // Session expired — clear storage
          sessionStorage.removeItem('roomId');
          sessionStorage.removeItem('playerName');
          sessionStorage.removeItem('reconnectToken');
        }
      });
    }
  });

  socket.on('disconnect', () => setConnected(false));
}, [navigate]);

const createRoom = () => {
  const socket = getSocket();
  if (!socket || !playerName.trim()) return;

  setIsConnecting(true);
  socket.emit('room:create', { name: roomName, maxPlayers, playerName: playerName.trim() }, (result: any) => {
    setIsConnecting(false);
    if (result.success) {
      sessionStorage.setItem('roomId', result.room.id);
      sessionStorage.setItem('playerName', playerName.trim());
      if (result.reconnectToken) sessionStorage.setItem('reconnectToken', result.reconnectToken);
      navigate(`/room/${result.room.id}`);
    } else {
      alert(result.error);
    }
  });
};
```

- [ ] **Step 3: Update `Join.tsx`**

Send `playerName` in `room:join` and save session:

```typescript
socket.emit('room:join', { roomId: roomCode.trim(), playerName: playerName.trim() }, (result: any) => {
  setIsConnecting(false);
  if (result.success) {
    sessionStorage.setItem('roomId', roomCode.trim());
    sessionStorage.setItem('playerName', playerName.trim());
    if (result.reconnectToken) sessionStorage.setItem('reconnectToken', result.reconnectToken);
    navigate(`/room/${roomCode.trim()}`);
  } else {
    setError(result.error || '加入房间失败');
  }
});
```

- [ ] **Step 4: Build web to check for TypeScript errors**

```bash
cd /Users/zhaomr/workdir/PsylentPhantom/apps/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/services/socket.ts apps/web/src/pages/Home.tsx apps/web/src/pages/Join.tsx
git commit -m "feat(web): player names in socket events, session storage, auto-reconnect"
```

---

## Task 11: ResonateModal Component

**Files:**
- Create: `apps/web/src/components/ResonateModal.tsx`
- Modify: `apps/web/src/components/index.ts`

- [ ] **Step 1: Create `ResonateModal.tsx`**

```tsx
import { useState } from 'react';
import { Attribute, ATTRIBUTES, ATTRIBUTE_COLORS, OpponentView } from '@psylent/shared';

interface ResonateModalProps {
  target: OpponentView;
  myEnergy: number;
  onConfirm: (guess: [Attribute, Attribute]) => void;
  onCancel: () => void;
}

export function ResonateModal({ target, myEnergy, onConfirm, onCancel }: ResonateModalProps) {
  const knownAttrs: Attribute[] = target.attributes ?? [];
  const [selected, setSelected] = useState<Attribute[]>([]);

  const totalSelected = knownAttrs.length + selected.length;
  const canConfirm = totalSelected === 2 && myEnergy >= 3;

  const toggleAttr = (attr: Attribute) => {
    if (knownAttrs.includes(attr)) return; // already known, not selectable
    setSelected(prev =>
      prev.includes(attr)
        ? prev.filter(a => a !== attr)
        : prev.length + knownAttrs.length < 2
        ? [...prev, attr]
        : prev
    );
  };

  const handleConfirm = () => {
    const guess = [...knownAttrs, ...selected] as [Attribute, Attribute];
    onConfirm(guess);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-sm border border-purple-500 shadow-lg shadow-purple-500/30">
        <h2 className="text-xl font-bold text-center mb-1">共鸣指环</h2>
        <p className="text-center text-gray-400 text-sm mb-4">
          对 <span className="text-white font-semibold">{target.name}</span> 使用 ·
          消耗 3 能量（当前: {myEnergy}）
        </p>

        {knownAttrs.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-400 mb-1">已知属性</div>
            <div className="flex gap-2">
              {knownAttrs.map(attr => (
                <span
                  key={attr}
                  className="px-3 py-1 rounded text-xs font-bold opacity-60 cursor-not-allowed"
                  style={{ backgroundColor: ATTRIBUTE_COLORS[attr].primary, color: '#000' }}
                >
                  {attr}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4">
          <div className="text-xs text-gray-400 mb-2">
            猜测未知属性（还需选 {2 - totalSelected} 个）
          </div>
          <div className="grid grid-cols-3 gap-2">
            {ATTRIBUTES.map(attr => {
              const isKnown = knownAttrs.includes(attr);
              const isSelected = selected.includes(attr);
              return (
                <button
                  key={attr}
                  onClick={() => toggleAttr(attr)}
                  disabled={isKnown}
                  className={`
                    px-2 py-2 rounded text-xs font-bold transition-all
                    ${isKnown ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
                    ${isSelected ? 'ring-2 ring-white scale-105' : ''}
                  `}
                  style={{
                    backgroundColor: ATTRIBUTE_COLORS[attr].primary,
                    color: '#000',
                  }}
                >
                  {attr}
                  {isSelected && <span className="ml-1">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded font-bold transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded font-bold transition-colors"
          >
            确认猜测
          </button>
        </div>

        {myEnergy < 3 && (
          <p className="text-center text-red-400 text-xs mt-2">能量不足（需要 3 点）</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Export from `components/index.ts`**

Add to the existing barrel export file:

```typescript
export { ResonateModal } from './ResonateModal';
```

- [ ] **Step 3: Build check**

```bash
cd /Users/zhaomr/workdir/PsylentPhantom/apps/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ResonateModal.tsx apps/web/src/components/index.ts
git commit -m "feat(web): ResonateModal component"
```

---

## Task 12: PlayerBoard — Resonate Click Handler

**Files:**
- Modify: `apps/web/src/components/PlayerBoard.tsx`

- [ ] **Step 1: Add `onResonateClick` prop to PlayerBoard**

Update the `PlayerBoardProps` interface:

```typescript
interface PlayerBoardProps {
  player: OpponentView;
  isCurrentTurn?: boolean;
  isSelf?: boolean;
  onResonateClick?: (player: OpponentView) => void;
}
```

Add `onResonateClick` to the destructured props, and update the root `<div>` to call it on click:

```tsx
export function PlayerBoard({ player, isCurrentTurn, isSelf, onResonateClick }: PlayerBoardProps) {
  // ...
  return (
    <div
      onClick={() => onResonateClick?.(player)}
      className={`
        relative p-4 rounded-lg border-2 min-w-[180px]
        ${onResonateClick ? 'cursor-pointer hover:border-purple-400 hover:shadow-purple-400/20 hover:shadow-md' : ''}
        ${isCurrentTurn ? 'border-yellow-400 shadow-lg shadow-yellow-400/30 animate-pulse' : 'border-gray-600'}
        ${isSelf ? 'bg-blue-900/30 border-blue-500' : 'bg-gray-800'}
        transition-all duration-200
      `}
    >
      {/* rest unchanged */}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/zhaomr/workdir/PsylentPhantom/apps/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/PlayerBoard.tsx
git commit -m "feat(web): PlayerBoard resonate click handler prop"
```

---

## Task 13: Game.tsx — Response Phase UI + Resonate Integration

**Files:**
- Modify: `apps/web/src/pages/Game.tsx`

- [ ] **Step 1: Add state for response phase and resonate modal**

At the top of `GamePage`, add new state variables:

```typescript
const [resonateTarget, setResonateTarget] = useState<import('@psylent/shared').OpponentView | null>(null);
const [responseWindow, setResponseWindow] = useState<{ pendingDamage: number; deadline: number } | null>(null);
const [peekedAttributes, setPeekedAttributes] = useState<Array<{ targetName: string; attribute: string }>>([]);
```

- [ ] **Step 2: Listen to `game:responseWindow` and `game:peek` events**

Inside the `useEffect` (alongside `game:state`):

```typescript
const handleResponseWindow = (data: { pendingDamage: number; timeoutMs: number }) => {
  setResponseWindow({ pendingDamage: data.pendingDamage, deadline: Date.now() + data.timeoutMs });
};

const handlePeek = (data: { targetId: string; attribute: string }) => {
  const targetName = gameState?.opponents.find(o => o.id === data.targetId)?.name ?? data.targetId;
  setPeekedAttributes(prev => [...prev, { targetName, attribute: data.attribute }]);
  // Auto-dismiss after 5 seconds
  setTimeout(() => setPeekedAttributes(prev => prev.slice(1)), 5000);
};

socket.on('game:responseWindow', handleResponseWindow);
socket.on('game:peek', handlePeek);

return () => {
  socket.off('game:state', handleGameState);
  socket.off('game:responseWindow', handleResponseWindow);
  socket.off('game:peek', handlePeek);
  clearTimeout(timeout);
};
```

- [ ] **Step 3: Add resonate and respond handlers**

```typescript
const canResonate = isMyTurn && phase === 'action' && (gameState?.me?.energy ?? 0) >= 3;

const handleResonateClick = (opponent: import('@psylent/shared').OpponentView) => {
  if (!canResonate) return;
  setResonateTarget(opponent);
};

const handleResonateConfirm = (guess: [import('@psylent/shared').Attribute, import('@psylent/shared').Attribute]) => {
  const socket = getSocket();
  if (!socket || !resonateTarget) return;
  socket.emit('game:action', { type: 'resonate', targetId: resonateTarget.id, guess });
  setResonateTarget(null);
};

const handleRespond = (cardId: string) => {
  const socket = getSocket();
  if (!socket) return;
  socket.emit('game:action', { type: 'respond', cardId });
  setResponseWindow(null);
};

const handleRespondSkip = () => {
  const socket = getSocket();
  if (!socket) return;
  socket.emit('game:action', { type: 'respondSkip' });
  setResponseWindow(null);
};
```

- [ ] **Step 4: Update opponent PlayerBoard renders to pass onResonateClick**

In the opponents map:

```tsx
{gameState.opponents.map((opponent) => (
  <PlayerBoard
    key={opponent.id}
    player={opponent}
    isCurrentTurn={gameState.currentPlayerId === opponent.id}
    onResonateClick={canResonate ? handleResonateClick : undefined}
  />
))}
```

- [ ] **Step 5: Add response phase UI to the middle game area**

After the overload phase UI block, add:

```tsx
{/* Response Phase UI — shown to defender */}
{phase === 'response' && responseWindow && (
  <div className="text-center bg-gray-800 border-2 border-red-500 rounded-xl p-6">
    <div className="text-xl font-bold mb-2 text-red-400">⚔️ 防御机会！</div>
    <div className="text-gray-300 mb-4">
      即将受到 <span className="text-red-400 font-bold text-2xl">{responseWindow.pendingDamage}</span> 点伤害
    </div>
    <div className="text-sm text-gray-400 mb-4">
      打出防御牌可以减少伤害，或者选择承受
    </div>
    <div className="flex justify-center gap-4 mb-4">
      {gameState.me.hand
        .filter(c => c.effects.some(e => e.type === 'shield'))
        .map(card => (
          <button
            key={card.id}
            onClick={() => handleRespond(card.id)}
            className="bg-blue-700 hover:bg-blue-600 border-2 border-blue-400 rounded-lg p-3 w-28"
          >
            <div className="font-bold text-sm">{card.name}</div>
            <div className="text-xs text-gray-300 mt-1">{card.description}</div>
          </button>
        ))}
    </div>
    <button
      onClick={handleRespondSkip}
      className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded font-bold"
    >
      承受全部伤害
    </button>
  </div>
)}
```

- [ ] **Step 6: Add peek notifications and ResonateModal**

Before the closing `</div>` of the component, add:

```tsx
{/* Peek notification */}
{peekedAttributes.length > 0 && (
  <div className="fixed top-4 right-4 space-y-2 z-40">
    {peekedAttributes.map((p, i) => (
      <div key={i} className="bg-purple-900 border border-purple-400 rounded-lg px-4 py-2 text-sm">
        🔍 偷看到 <span className="font-bold">{p.targetName}</span> 的属性：
        <span className="text-purple-300 font-bold ml-1">{p.attribute}</span>
      </div>
    ))}
  </div>
)}

{/* Resonate Modal */}
{resonateTarget && (
  <ResonateModal
    target={resonateTarget}
    myEnergy={gameState.me.energy}
    onConfirm={handleResonateConfirm}
    onCancel={() => setResonateTarget(null)}
  />
)}
```

Import `ResonateModal` at the top of `Game.tsx`:

```typescript
import { ResonateModal } from '../components';
```

- [ ] **Step 7: Build check**

```bash
cd /Users/zhaomr/workdir/PsylentPhantom/apps/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/pages/Game.tsx
git commit -m "feat(web): response phase UI, resonate modal integration, peek notifications"
```

---

## Task 14: Final Build + Smoke Test

- [ ] **Step 1: Full build**

```bash
cd /Users/zhaomr/workdir/PsylentPhantom && npm run build 2>&1 | tail -20
```

Expected: No errors.

- [ ] **Step 2: Run all server tests**

```bash
cd /Users/zhaomr/workdir/PsylentPhantom/apps/server && npx jest --no-coverage
```

Expected: All pass.

- [ ] **Step 3: Restart dev servers if running**

```bash
# Kill and restart background tasks if needed
cd /Users/zhaomr/workdir/PsylentPhantom/apps/server && npm run dev
cd /Users/zhaomr/workdir/PsylentPhantom/apps/web && npm run dev
```

- [ ] **Step 4: Manual smoke test checklist**

Open two browser windows to `http://localhost:3000`:

1. **Player Names:** Enter different names in each window → create/join room → confirm names appear in room player list (not "Player 1", "Player 2")
2. **Attribute Selection:** Start game → both windows show attribute selector → select attributes → names appear on ready list
3. **Draw Phase:** Start gameplay → draw phase shows card options → selecting a card advances to overload phase
4. **Response Phase:** Player 1 plays an attack card → Player 2's browser shows defense window with pending damage → Player 2 plays a defend card → confirm reduced damage applied
5. **Resonate Ring:** During action phase with ≥3 energy → click opponent's PlayerBoard → ResonateModal opens → select 2 attributes → confirm sends resonate action
6. **Timeout:** Wait 30 seconds during draw phase without acting → auto-draw fires, turn advances

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final build verification for gap implementation"
```
