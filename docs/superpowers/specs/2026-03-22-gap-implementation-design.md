# Gap Implementation Design
**Date:** 2026-03-22
**Project:** Psylent Phantom (幻默灵影)
**Scope:** Five known implementation gaps in the current codebase

---

## Overview

This document covers the design for completing five known gaps in the Psylent Phantom multiplayer card game:

1. Player name transmission (frontend → server)
2. EffectExecutor complete implementation (draw / reveal / peek / discard / shield)
3. Shield response phase (reactive defense mechanic)
4. Resonate Ring UI (共鸣指环 frontend interface)
5. Timeout auto-actions + disconnect/reconnect

---

## 1. Player Names

### Problem
Players are currently assigned `"Player N"` by the server regardless of the name entered in the UI.

### Design

**Frontend changes (Home.tsx, Join.tsx):**
- `room:create` payload gains `playerName: string`
- `room:join` payload gains `playerName: string`
- Both pages already have name input fields; read the value and include it in the event
- Store `playerName` in `sessionStorage` alongside `roomId` for reconnect use

**Validation:**
- Frontend: non-empty, max 12 characters (UX constraint)
- Backend: truncate to 20 characters (safety cap, no other validation)
- Names **must be unique within a room** (enforced by server) to support reliable reconnect matching. If a duplicate name is submitted, server returns an error event.

**Backend changes (rooms/manager.ts):**
- `createRoom(name, maxPlayers, hostId, playerName)` — host is added as the first player using the provided name
- `joinRoom(roomId, socketId, playerName)` — validate name uniqueness within room; use provided name; return error if duplicate

**No shared type changes required** — `Player.name` already exists.

---

## 2. EffectExecutor Complete Implementation

### Problem
`draw`, `shield`, `reveal`, `peek`, and `discard` effects return a success result but do not apply side effects.

### EffectContext Extension

`EffectContext` gains a `drawCards` callback so `EffectExecutor` can trigger draws without coupling to `GameEngine` internals:

```typescript
interface EffectContext {
  // existing fields...
  sourcePlayerId: string
  targetPlayerId?: string
  gameState: GameState
  // new:
  drawCards: (playerId: string, count: number) => void
  pendingDamage?: number  // only set during response phase resolution
}
```

`GameEngine` passes `this.drawCards.bind(this)` when constructing the context.

### Effect Implementations

#### `draw`
- Call `context.drawCards(targetPlayerId, value)` — the callback handles deck-empty, shuffle-discard, and `MAX_HAND_SIZE` capping
- `GameEngine.drawCards(playerId, count)`: take from top of deck; if deck empty, shuffle discard into deck and continue; stop if hand reaches `MAX_HAND_SIZE = 8`

#### `reveal`
- Increment `target.attributesRevealed` by `value`, capped at `2`
- No additional events needed — `getPlayerView()` already filters opponent attributes using this field

#### `peek`
- Server emits `game:peek { targetId, attribute: Attribute }` to the source player's socket **only**
- For `value > 1`: emit one `game:peek` event per attribute (sequential, one per revealed attribute)
- Does **not** modify `attributesRevealed` — invisible to other players
- `peek` always reveals **attributes**, not hand cards
- Both PSYCHIC card 精神感应 (psychicSense) and FATE card 命运干涉 (fateIntervention) use `peek` — both card descriptions in `definitions.ts` must be updated to describe attribute-peeking (not hand card peeking)
- 精神感应's existing chain effect `{ type: 'reveal', value: 1, target: 'self' }` is **intentional and kept**: after peeking at the target's attribute, the caster reveals 1 of their own attributes to all players. This is the balancing cost for the peek.

#### `discard`
- Target player randomly discards `value` cards from hand to discard pile
- If hand has fewer cards than `value`, discard all

#### `shield`
- Shield is not executed directly inside `EffectExecutor.execute()` during `playCard`
- It is executed during **response phase resolution** (see Section 3)
- When `GameEngine` resolves the response, it calls `effectExecutor.execute(shieldEffect, context)` where `context.pendingDamage` is set
- `EffectExecutor` computes `Math.floor(pendingDamage * (1 - value/100))` and stores it in `EffectResult.value`
- `GameEngine` reads `result.value` as the final damage to apply: `player.hp -= result.value`
- `EffectResult.value` is already typed as `number | undefined` in the existing interface, so no type changes are needed

---

## 3. Shield Response Phase

### Problem
Defense cards (防御, 闪避) have shield effects but there is no mechanism for a player to play them in reaction to an incoming attack.

### AoE Convention
A card is AoE — and skips the response phase — if it has `damage` effects targeting **different** players (i.e., damage effects with two or more distinct `target` values, each resolving to a different player). Only 连锁闪电 currently qualifies (`target: 'left'` AND `target: 'right'`).

Cards with multiple `damage` effects targeting the **same** player (such as 雷电打击: 3 damage to `'left'` plus 1 conditional damage to `'left'`) are **not** AoE. They trigger one response phase window. After the window resolves, all applicable damage effects (primary + conditional) are evaluated and applied in sequence against the final (possibly reduced) damage context.

The `Card` interface in `packages/shared/src/types/card.ts` gains an optional field: `aoe?: boolean`. Only 连锁闪电 sets this to `true`; all other cards omit it (default falsy).

### New PhaseType
Add `'response'` to `PhaseType` in `packages/shared/src/types/game.ts`.

### Phase Architecture (shared vs. server-only)

The shared `Phase` interface currently has `timeout?: number` and `validActions?: string[]`. Add a `deadline: Date` field to carry the phase expiry as a wall-clock timestamp (used by clients to render countdown timers). `timeout?: number` can remain for backward compatibility or be removed — the spec requires `deadline: Date` to be present:

```typescript
// packages/shared/src/types/game.ts
interface Phase {
  type: PhaseType   // now includes 'response'
  deadline: Date    // ADD: wall-clock expiry; replaces the role of timeout?: number
  validActions?: string[]
}
```

A **server-only** `ServerPhase` interface extends `Phase` with internal state. It is defined in `apps/server/src/game/` (not in the shared package):
```typescript
// apps/server/src/game/types.ts  (new server-internal file)
import { Phase } from '@psylent/shared'

interface ResponseContext {
  attackerId: string
  defenderId: string
  pendingDamage: number
  cardId: string       // the attack card, held until response resolves
}

interface ServerPhase extends Phase {
  responseContext?: ResponseContext
}
```

`GameState.phase` on the server uses `ServerPhase`. When `getPlayerView()` builds `PlayerViewState`, it maps `ServerPhase → Phase` by destructuring only `{ type, deadline }`, which naturally strips `responseContext`. The defender receives `pendingDamage` via the separate `game:responseWindow` event (single-socket, not broadcast).

### New Socket Events

`game:responseWindow` (Server → defender socket only):
```typescript
{ pendingDamage: number, timeoutMs: number }
```

`player:reconnected` (Server → room broadcast):
```typescript
{ playerId: string, playerName: string }
```

### Attack Card Discard Timing
When `playCard` is called for a single-target attack card:
1. Remove the card from the player's hand
2. **Hold** it in `responseContext.cardId` (do not push to discard yet)
3. Transition to response phase

After response resolves (either way):
4. Move the held card to the attacker's discard pile

For non-attack cards and AoE cards, the card moves to discard immediately as before.

### Flow

**Attack plays single-target damage card:**
1. Server removes card from hand, computes `pendingDamage`, stores in `responseContext`
2. Transition to `response` phase with `deadline = now + 10s`
3. Emit `game:responseWindow { pendingDamage, timeoutMs: 10000 }` to defender's socket
4. Broadcast `game:state` to all (all see `phase.type = 'response'`, no damage value leaked)

**Defender responds within 10 seconds:**

- **Plays a defense card** (`game:action { type: 'respond', cardId }`):
  - Validate: card must have a `shield` effect and belong to defender's hand
  - Execute shield: `reducedDamage = effectExecutor.execute(shieldEffect, context)` with `context.pendingDamage` set
  - Apply `reducedDamage` to defender's HP
  - Move attack card to attacker's discard; move defense card to defender's discard
  - Return to attacker's `action` phase

- **Skips** (`game:action { type: 'respondSkip' }`) or **timeout fires**:
  - Apply full `pendingDamage` to defender's HP
  - Move attack card to attacker's discard
  - Return to attacker's `action` phase

**Multi-target attacks** (tagged `aoe: true`): skip response phase entirely, damage all targets immediately.

### Timer Management
- `GameEngine` maintains `phaseTimers: Map<string, NodeJS.Timeout>` keyed by playerId
- Every phase start clears any existing timer for that player before setting a new one
- Every successful player action clears the player's timer before processing

---

## 4. Resonate Ring UI (共鸣指环)

### Problem
The server-side resonate mechanic is fully implemented but the frontend has no UI to trigger it.

### Trigger
- During action phase, clicking an opponent's `PlayerBoard` component opens the Resonate Modal
- Guard condition in `Game.tsx`: `isMyTurn && phase.type === 'action' && me.energy >= 3`
- If condition not met, click on PlayerBoard is ignored (no modal, no error)

### New Component: `ResonateModal.tsx`

```
┌─────────────────────────────────┐
│  对 [PlayerName] 使用共鸣指环    │
│  消耗 3 能量（当前：X 能量）     │
├─────────────────────────────────┤
│  已知属性：[THUNDER] [???]       │
│                                 │
│  猜测未知属性：                   │
│  [THUNDER] [HEAT] [PSYCHIC]     │
│  [FATE]   [SPACE] [SPIRIT]      │
│                                 │
│  已选：[属性1] [属性2]           │
├─────────────────────────────────┤
│    [取消]        [确认猜测]      │
└─────────────────────────────────┘
```

**Attribute selection rules:**
- Already-revealed attributes (present in `OpponentView.attributes`) are **auto-included** in the guess and shown as pre-selected (grayed, non-interactive). The player does not need to re-select them.
- The player selects from the **remaining unknown attributes** until the total (known + newly selected) reaches exactly 2.
- Example: opponent has 1 revealed attribute → player picks 1 more. Opponent has 0 revealed → player picks 2.
- "Confirm" is enabled only when `(known.length + selected.length) === 2`
- "Confirm" is disabled when `me.energy < 3`
- Uses `ATTRIBUTE_COLORS` from `@psylent/shared` for button styling

### Event
```typescript
// guess includes both known and newly-selected attributes
game:action { type: 'resonate', targetId: string, guess: [Attribute, Attribute] }
```

**Note:** The `resonate` case in `websocket/server.ts` `handleGameAction` already exists and passes `action.guess` to `game.resonate()`. No server-side changes needed for this specific event path.

### Result
Outcome is communicated via the next `game:state` broadcast. The `log` array contains a human-readable entry describing success (target eliminated) or failure (penalty type applied).

---

## 5. Timeout Auto-Actions + Disconnect/Reconnect

### Timeout Auto-Actions

#### Timer Setup
`GameEngine` sets a `setTimeout` at the start of each phase. Any in-flight timer for the current player is always cleared before setting a new one.

| Phase    | Timeout constant              | Auto-action                                          |
|----------|-------------------------------|------------------------------------------------------|
| draw     | `PHASE_TIMEOUT_DRAW` (30s)    | Call `startDrawPhase(playerId)` then `selectDrawCard(playerId, 0)` |
| overload | `PHASE_TIMEOUT_OVERLOAD` (15s)| `overload(playerId, false)`                          |
| action   | `PHASE_TIMEOUT_ACTION` (60s)  | `skipTurn(playerId)`                                 |
| response | 10 000 ms (hardcoded)         | Apply full `pendingDamage`, skip defense             |

**Draw phase note:** The draw phase requires the player to first trigger `startDraw` (which populates `pendingDraws`). The auto-action must call `startDrawPhase()` internally before calling `selectDrawCard(0)` to ensure `pendingDraws` is populated. If `pendingDraws` is already populated (player called `startDraw` manually), skip the first step.

#### Consecutive Timeout Counter Rules (three-state)
| Event | Effect on `consecutiveTimeouts` |
|---|---|
| Successful non-response action | Reset to `0` |
| Main-phase timeout (draw / overload / action) | Increment by `1` |
| Response phase timeout or `respondSkip` | **No change** (neither increment nor reset) |

When `consecutiveTimeouts >= 3`:
- Mark `player.isConnected = false` (treated same as disconnect)
- Broadcast `player:disconnected` to room
- `nextTurn()` will skip this player automatically (see below)

#### Turn Skipping for Kicked/Disconnected Players
`GameStateManager.nextTurn()` advances the turn index, then loops forward while the candidate player has `isConnected === false` or `consecutiveTimeouts >= 3`. If all remaining players are in this state (degenerate case), the game ends with no winner.

---

### Disconnect/Reconnect

#### Identity Matching
Reconnect is matched by **room code + player name**. Because duplicate names within a room are now disallowed (Section 1), the combination is unique.

#### Reconnect Token (alternative fallback)
On first successful `room:create` **or** `room:join`, the server generates a `reconnectToken` (UUID) and includes it in the callback response. The client stores it in `sessionStorage`. On reconnect, the client may send `{ roomId, playerName, reconnectToken }`. If `reconnectToken` is present and matches the stored value, it supersedes name matching (handles edge cases like name display bugs). Both paths result in the same reconnect logic.

This applies equally to the room host (who calls `room:create`) and regular players (who call `room:join`).

#### Disconnect Flow
```
socket 'disconnect' event fires
  → RoomManager.handleDisconnect(roomId, socketId)
  → player.isConnected = false
  → start reconnectTimer (RECONNECT_GRACE_PERIOD = 5 min)
      → on expiry: removePlayer(roomId, playerId), broadcast room:update
  → store timer in reconnectTimers: Map<string, NodeJS.Timeout>  (key: playerId)
  → broadcast player:disconnected to room
  → if a response phase is active and this player is the defender:
      response timer fires normally → full damage applied
      (no special handling; the existing response timeout covers this)
```

#### Reconnect Flow
```
client sends room:join { roomId, playerName, reconnectToken? }
  → RoomManager checks for disconnected player matching name (or token) in that room
  → if found:
      oldId = player.id
      clearTimeout(reconnectTimer)
      update playerRoomMap: remove oldId entry, add newSocketId → roomId
      new socket joins socket.io room channel
      player.isConnected = true
      player.id = newSocketId
      reset player.consecutiveTimeouts to 0
      // patch any live responseContext via GameEngine method:
      room.game?.updatePlayerId(oldId, newSocketId)
      emit player:reconnected { playerId: newSocketId, playerName } to room
      broadcastGameState (reconnecting player receives their current game view)
  → if not found: normal new-player join flow
```

#### Client-Side Reconnect Support
- On successful `room:join` callback, store `{ roomId, playerName, reconnectToken }` in `sessionStorage`
- On app load (`App.tsx` or `Home.tsx` mount), check `sessionStorage` for a saved `roomId` and attempt `room:join` silently
- On reconnect success (detected via `game:state` arriving with `status === 'playing'` or `'selecting'`), navigate to the appropriate page (`/game/:roomId` or `/room/:roomId`)

---

## Files Changed Summary

| File | Change type | Notes |
|---|---|---|
| `packages/shared/src/types/game.ts` | Modify | Add `'response'` to `PhaseType`; add `deadline: Date` to `Phase` interface |
| `packages/shared/src/types/card.ts` | Modify | Add optional `aoe?: boolean` field to `Card` interface |
| `apps/server/src/game/types.ts` | **New** | Server-internal `ServerPhase` (extends `Phase` with `responseContext`) and `ResponseContext` interfaces |
| `apps/server/src/rooms/manager.ts` | Modify | `playerName` param, name-uniqueness check, reconnect timer, reconnect token generation (for both `create` and `join`), patch `responseContext` IDs on reconnect |
| `apps/server/src/game/engine.ts` | Modify | Use `ServerPhase`, `drawCards()` method, phase timers, timeout auto-actions, kick logic, response phase orchestration, `updatePlayerId(oldId, newId)` public method to patch `responseContext` IDs |
| `apps/server/src/game/state/manager.ts` | Modify | `startResponsePhase()`, strip `responseContext` when building `PlayerViewState` (destructure only `{ type, deadline }`) |
| `apps/server/src/game/effects/executor.ts` | Modify | Extend `EffectContext` with `drawCards` callback and optional `pendingDamage`; implement draw, reveal, peek, discard, shield (`result.value` = reduced damage) |
| `apps/server/src/game/cards/definitions.ts` | Modify | Add `aoe: true` to 连锁闪电; update 精神感应 and 命运干涉 descriptions to reflect attribute-peeking |
| `apps/server/src/websocket/server.ts` | Modify | Handle `respond` / `respondSkip` actions; emit `game:peek`; reconnect matching on `room:join`; emit `game:responseWindow`; send `reconnectToken` in create/join callbacks |
| `apps/web/src/pages/Home.tsx` | Modify | Send `playerName` in `room:create`; store `{ roomId, playerName, reconnectToken }` in sessionStorage; attempt silent reconnect on load |
| `apps/web/src/pages/Join.tsx` | Modify | Send `playerName` in `room:join`; store session data; attempt silent reconnect on load |
| `apps/web/src/pages/Game.tsx` | Modify | Response phase UI; response countdown; pass resonate/respond handlers to children |
| `apps/web/src/components/PlayerBoard.tsx` | Modify | Click handler → invoke resonate modal (guarded by `canResonate`) |
| `apps/web/src/components/ResonateModal.tsx` | **New** | Resonate Ring UI component |
| `apps/web/src/services/socket.ts` | Modify | Add `game:responseWindow` and `game:peek` to event type definitions |
