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

**Validation:**
- Frontend: non-empty, max 12 characters (UX constraint)
- Backend: truncate to 20 characters (safety cap, no other validation)
- Same-room duplicate names allowed (no uniqueness check)

**Backend changes (rooms/manager.ts):**
- `createRoom(name, maxPlayers, hostId, playerName)` — host is added as the first player using the provided name
- `joinRoom(roomId, playerId, playerName)` — use provided name instead of `"Player N"`

**No shared type changes required** — `Player.name` already exists.

---

## 2. EffectExecutor Complete Implementation

### Problem
`draw`, `shield`, `reveal`, `peek`, and `discard` effects return a success result but do not apply side effects.

### Design

#### `draw`
- Take `value` cards from the top of `player.deck`, append to `player.hand`
- Cap at `MAX_HAND_SIZE = 8` (stop drawing if hand is full)
- If deck runs out: shuffle `player.discard` into a new deck, continue drawing
- If deck + discard are both empty: draw whatever is available (no error)

#### `reveal`
- Increment `target.attributesRevealed` by `value`, capped at `2`
- No additional events needed — `getPlayerView()` already uses `attributesRevealed` to filter opponent attribute visibility

#### `peek`
- Source player privately learns one of target's attributes
- Server emits `game:peek { targetId, attribute: Attribute }` to the source player's socket only
- Does **not** modify `attributesRevealed` — no visible change to other players

#### `discard`
- Target player randomly discards `value` cards from hand to discard pile
- If hand has fewer cards than `value`, discard all

#### `shield`
- Shield is handled via the **response phase** (see Section 3)
- In `EffectExecutor`, the shield effect calculates damage reduction: `Math.floor(pendingDamage * (1 - value/100))`
- Returns the reduced damage value for the engine to apply

---

## 3. Shield Response Phase

### Problem
Defense cards (防御, 闪避) have shield effects but there is no mechanism for a player to play them in reaction to an incoming attack.

### Design

#### New PhaseType
Add `'response'` to `PhaseType` in `packages/shared/src/types/game.ts`.

#### Phase Extension
```typescript
interface Phase {
  type: PhaseType
  deadline: Date
  responseContext?: {
    attackerId: string
    defenderId: string
    pendingDamage: number
    cardId: string       // the attack card, moved to discard after resolution
  }
}
```

#### New Socket Event
`game:responseWindow` (Server → single client):
```typescript
{ pendingDamage: number, timeoutMs: number }
```

#### Flow

1. Attacker plays a card whose effects include `damage` against a single target
2. Server computes `pendingDamage` but does **not** apply it yet
3. Server transitions to `response` phase with `responseContext`
4. Server emits `game:responseWindow` to the defender's socket
5. Server broadcasts `game:state` to all players (everyone sees phase = response)

**Defender responds within 10 seconds:**

- **Plays a defense card** (`game:action { type: 'respond', cardId }`):
  - Server validates: card must have a `shield` effect, defender must own it
  - `EffectExecutor` calculates reduced damage
  - Attack card moves to attacker's discard; defense card moves to defender's discard
  - Reduced damage applied to defender
  - Phase returns to attacker's `action` phase

- **Times out or skips** (`game:action { type: 'respondSkip' }` or timeout fires):
  - Full `pendingDamage` applied
  - Phase returns to attacker's `action` phase

**Multi-target attacks** (e.g., 连锁闪电 targeting `'all'`): no response phase, damage applies immediately to all targets.

#### Timer Management
- `GameEngine` maintains `phaseTimers: Map<string, NodeJS.Timeout>` keyed by playerId
- Every phase start clears any existing timer for that player before setting a new one
- Every successful player action clears the player's timer

---

## 4. Resonate Ring UI (共鸣指环)

### Problem
The server-side resonate mechanic is fully implemented but the frontend has no UI to trigger it.

### Design

#### Trigger
- During action phase, clicking an opponent's `PlayerBoard` opens the Resonate Modal
- Guard condition: `isMyTurn && phase.type === 'action' && me.energy >= 3`
- If condition not met, click on PlayerBoard does nothing

#### New Component: `ResonateModal.tsx`

```
┌─────────────────────────────────┐
│  对 [PlayerName] 使用共鸣指环    │
│  消耗 3 能量（当前：X 能量）     │
├─────────────────────────────────┤
│  已知属性：[THUNDER] [???]      │
│                                 │
│  猜测两个属性：                  │
│  [THUNDER] [HEAT] [PSYCHIC]     │
│  [FATE]  [SPACE]  [SPIRIT]      │
│                                 │
│  已选：[属性1] [属性2]           │
├─────────────────────────────────┤
│    [取消]        [确认猜测]      │
└─────────────────────────────────┘
```

**Interaction rules:**
- Attributes already visible in `OpponentView.attributes` are grayed out and non-selectable (no need to guess known attributes)
- Exactly 2 attributes must be selected to enable "Confirm"
- "Confirm" disabled when `me.energy < 3`
- Uses `ATTRIBUTE_COLORS` from `@psylent/shared` for styling (consistent with `AttributeSelector`)

#### Event
```typescript
game:action { type: 'resonate', targetId: string, guess: [Attribute, Attribute] }
```

#### Result
Outcome is communicated via the next `game:state` broadcast. The `log` array will contain a human-readable entry describing success or failure + penalty applied.

---

## 5. Timeout Auto-Actions + Disconnect/Reconnect

### Timeout Auto-Actions

#### Timer Setup
`GameEngine` sets a `setTimeout` at the start of each phase:

| Phase    | Timeout constant              | Auto-action               |
|----------|-------------------------------|---------------------------|
| draw     | `PHASE_TIMEOUT_DRAW` (30s)    | `selectDrawCard(0)`       |
| overload | `PHASE_TIMEOUT_OVERLOAD` (15s)| `overload(false)`         |
| action   | `PHASE_TIMEOUT_ACTION` (60s)  | `skipTurn()`              |
| response | 10 000 ms (hardcoded)         | apply full damage, skip   |

#### Consecutive Timeout Kick
- `Player.consecutiveTimeouts` (already in type) increments on each timeout
- On successful player action: reset to `0`
- When `consecutiveTimeouts >= 3`: mark player as disconnected, broadcast `player:disconnected`, skip their turns automatically
- Response phase timeouts do **not** count toward the consecutive total

---

### Disconnect/Reconnect

#### Identity Matching
Reconnect is matched by **room code + player name** (socket.id changes on reconnect).

#### Disconnect Flow
```
socket 'disconnect' event fires
  → RoomManager.handleDisconnect(roomId, socketId)
  → player.isConnected = false
  → start reconnectTimer (RECONNECT_GRACE_PERIOD = 5 min)
      → on expiry: removePlayer(roomId, playerId), broadcast room:update
  → store timer in reconnectTimers: Map<string, NodeJS.Timeout>
  → broadcast player:disconnected to room
```

#### Reconnect Flow
```
client sends room:join { roomId, playerName }
  → RoomManager checks for disconnected player with matching name in that room
  → if found:
      clearTimeout(reconnectTimer)
      update playerRoomMap (new socketId → roomId)
      new socket joins socket.io room channel
      player.isConnected = true
      player.id updated to new socketId
      emit player:reconnected to room
      broadcastGameState (reconnecting player receives current game view)
  → if not found: normal new-player join flow
```

#### Client-Side Reconnect Support
- On successful room join or game start, store `roomId` in `sessionStorage`
- On app load, if `sessionStorage` has a `roomId`, attempt `room:join` with that roomId and the stored player name
- On reconnect success (detected via `game:state` arriving with `status === 'playing'`), navigate to `/game/:roomId`

---

## Files Changed Summary

| File | Change type |
|---|---|
| `packages/shared/src/types/game.ts` | Add `'response'` to `PhaseType`, add `responseContext` to `Phase` |
| `packages/shared/src/types/player.ts` | Add `shieldActive?: boolean` (internal use only, not in views) |
| `apps/server/src/rooms/manager.ts` | Add `playerName` param to create/join, reconnect timer logic |
| `apps/server/src/game/engine.ts` | Phase timers, timeout auto-actions, kick logic, response phase |
| `apps/server/src/game/state/manager.ts` | `startResponsePhase()` method |
| `apps/server/src/game/effects/executor.ts` | Implement draw, reveal, peek, discard, shield |
| `apps/server/src/websocket/server.ts` | Handle `respond` / `respondSkip` actions, `game:peek` emit, reconnect matching |
| `apps/web/src/pages/Home.tsx` | Send `playerName` in `room:create`, store roomId in sessionStorage |
| `apps/web/src/pages/Join.tsx` | Send `playerName` in `room:join`, store roomId in sessionStorage |
| `apps/web/src/pages/Game.tsx` | Response phase UI, response countdown, pass resonate handler to PlayerBoard |
| `apps/web/src/components/PlayerBoard.tsx` | Click handler → trigger resonate modal |
| `apps/web/src/components/ResonateModal.tsx` | New component |
| `apps/web/src/services/socket.ts` | Add `game:responseWindow` and `game:peek` to event types |
