# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Psylent Phantom is a multiplayer card game built as a TypeScript monorepo. Players select 2 attributes from 6 possible options (THUNDER, HEAT, PSYCHIC, FATE, SPACE, SPIRIT) and build decks from 38 unique action cards. The game features a unique "resonate" mechanic where players can guess opponents' hidden attributes for an instant win.

## Development Commands

All commands run from the repository root:

```bash
# Install dependencies
npm install

# Development - starts both frontend (port 3000) and backend (port 3001)
npm run dev

# Build all packages
npm run build

# Run tests (server-side Jest tests)
npm run test

# Run tests for a specific file
npx jest src/game/engine.test.ts --config apps/server/jest.config.js

# Lint all packages
npm run lint
```

### Individual Package Commands

```bash
# Server only (apps/server/)
npm run dev    # tsx watch src/index.ts
npm run test   # Jest with ts-jest
npm run build  # tsc

# Web only (apps/web/)
npm run dev    # vite --host (port 3000)
npm run build  # tsc && vite build
npm run preview # vite preview

# Shared package (packages/shared/)
npm run build  # Builds both ESM and CJS outputs
```

### Infrastructure

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Services:
# - PostgreSQL: localhost:5432 (dev/dev)
# - Redis: localhost:6379
```

## Architecture

### Monorepo Structure

```
psylent-phantom/
├── apps/
│   ├── server/          # Express + Socket.io game server
│   └── web/             # React + Vite frontend
├── packages/
│   └── shared/          # Shared types, constants, and types
├── deploy/              # Deployment artifacts (copies of built packages)
└── turbo.json           # Turborepo pipeline config
```

### Server Architecture (apps/server/)

**Entry Point**: `src/index.ts` - Express server with Socket.io setup, health check endpoint, and static file serving for the frontend build.

**WebSocket Server** (`src/websocket/server.ts`):
- Socket.io event handlers for room management and game actions
- Rooms are identified by 4-digit codes (e.g., "1234")
- Events: `room:create`, `room:join`, `room:startGame`, `game:action`, `game:selectAttributes`, etc.
- Each player receives personalized game state via `game:state` events

**Game Engine** (`src/game/engine.ts`):
- `GameEngine` class manages a single game instance
- Phases: draw → overload (optional) → action → response (if attacked)
- Phase timeouts: draw (30s), overload (15s), action (60s), response (10s)
- Auto-actions triggered on timeout with `unref()` timers to prevent process hangs in tests
- Key mechanics:
  - Attribute selection: Each player gets 3 random attributes, selects 2
  - Deck generation: 32 cards based on selected attributes
  - Draw phase: Choose 1 of 2 revealed cards, other goes to deck bottom
  - Overload: Take 1 damage to draw extra card
  - Resonate: Spend 3 energy to guess an opponent's attributes for instant win
  - Response phase: Defender can play shield cards when targeted by damage

**State Management** (`src/game/state/manager.ts`):
- `GameStateManager` holds canonical `GameState`
- Converts to `PlayerViewState` which hides opponents' hands and unrevealed attributes

**Effect System** (`src/game/effects/executor.ts`):
- `EffectExecutor` processes card effects (damage, heal, draw, shield, peek, reveal, discard)
- Supports conditions (`targetHasAttribute`, `hpBelow`, etc.) and chained effects
- Target resolution: self, left, right, all, select, random

**Card System** (`src/game/cards/`):
- `actionCards.ts`: 38 action card definitions with IDs 1200-1237
- `definitions.ts`: Deck generation, attribute card definitions, shuffling
- Cards have costs, attributes (optional), effects, and descriptions

**Room Management** (`src/rooms/manager.ts`):
- `RoomManager` handles room lifecycle, player connections, reconnections
- Reconnection grace period: 5 minutes (preserves game state)
- Players disconnected for >3 consecutive timeouts are marked offline

### Frontend Architecture (apps/web/)

**Entry Point**: `src/main.tsx` → `App.tsx` with React Router

**State Management** (`src/stores/game.ts`):
- Zustand store for socket connection, room state, and game state
- Game state is `PlayerViewState` from server (personalized view)

**Socket Service** (`src/services/socket.ts`):
- Singleton socket.io client connecting to `localhost:3001`
- Type definitions for server/client events

**Pages**:
- `Home.tsx`: Create or join rooms
- `Room.tsx`: Lobby with player list, attribute selection, game start
- `Game.tsx`: Main gameplay UI with player boards, hand, phase indicators
- `Join.tsx`: Join room by code

**Components**:
- `PlayerBoard.tsx`: Opponent/player display with HP, energy, attributes
- `Hand.tsx`: Card display with cost, name, effects
- `Card.tsx`: Individual card rendering
- `AttributeSelector.tsx`/`AttributeCardSelector.tsx`: Attribute selection UI
- `ResonateModal.tsx`: Resonate mechanic UI

### Shared Package (packages/shared/)

**Types** (`src/types/`):
- `game.ts`: `GameState`, `Phase`, `GameStatus`, `PlayerViewState`
- `player.ts`: `Player`, `MyPlayerView`, `OpponentView`
- `card.ts`: `Card`, `Effect`, `EffectType`, `TargetType`, `Condition`

**Constants** (`src/constants/index.ts`):
- `GAME_CONSTANTS`: HP values, deck sizes, timeouts, costs
- `ATTRIBUTES`: Six attribute types
- `ATTRIBUTE_COLORS`: Color schemes for UI

## Game Flow

1. **Room Creation**: Host creates 4-digit room, selects max players (2-4)
2. **Lobby**: Players join, host can start when ready
3. **Attribute Selection**: Each player receives 3 random attributes, selects 2
4. **Gameplay Loop**:
   - **Draw Phase**: Choose 1 of 2 revealed cards
   - **Overload Phase**: Optionally take 1 damage to draw +1 card
   - **Action Phase**: Play cards, use resonate, or skip
   - **Response Phase** (if single-target damage): Defender plays shield or takes damage
5. **Win Conditions**:
   - Eliminate all opponents (reduce HP to 0)
   - Successful resonate (correctly guess both attributes)

## Testing

Server tests use Jest with ts-jest (ESM mode):

```bash
# Run all tests
npm run test

# Run specific test file
npx jest src/game/engine.test.ts --config apps/server/jest.config.js

# Watch mode
npx jest --watch --config apps/server/jest.config.js
```

Key test files:
- `engine.test.ts`: Game flow, turns, phases, resonate mechanics
- `manager.test.ts`: State management, win conditions
- `executor.test.ts`: Effect execution
- `definitions.test.ts`: Card generation, deck building

Tests use `unref()` on timers to prevent process hangs. Always clear timers in `afterEach`.

## Build & Deployment

```bash
# Full build (shared → server → web)
npm run build

# The deploy/ folder contains copies of built packages for deployment:
# - deploy/web/ is copied from apps/web/dist/
# - deploy/shared/ is copied from packages/shared/dist/
```

Server serves static files from `WEB_PATH` env var or `../../web` (relative to dist).
