# 幻默灵影电子版 - 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个基于 Web 的多人在线卡牌游戏，忠实还原 Psylent Phantom 的核心玩法（隐藏身份 + 卡牌对战 + 共振指环）。

**Architecture:** 采用集中式服务器架构（方案A），服务器维护唯一的游戏状态机，客户端仅负责渲染。使用 Socket.io 实现实时通信，Redis 缓存房间状态，PostgreSQL 持久化游戏记录。

**Tech Stack:** React 18 + TypeScript 5 (前端), Node.js 20 + Express + Socket.io (后端), PostgreSQL 15, Redis 7

---

## 文件结构规划

```
psylent-phantom/
├── apps/
│   ├── web/                    # React 前端
│   │   ├── src/
│   │   │   ├── components/     # UI 组件
│   │   │   ├── hooks/          # 自定义 Hooks
│   │   │   ├── services/       # API/Websocket 服务
│   │   │   ├── stores/         # Zustand 状态管理
│   │   │   ├── types/          # TypeScript 类型
│   │   │   └── utils/          # 工具函数
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── server/                 # Node.js 后端
│       ├── src/
│       │   ├── game/           # 游戏核心逻辑
│       │   │   ├── engine.ts   # 游戏引擎
│       │   │   ├── cards.ts    # 卡牌定义
│       │   │   ├── effects.ts  # 效果系统
│       │   │   └── state.ts    # 状态管理
│       │   ├── rooms/          # 房间管理
│       │   ├── websocket/      # Socket.io 处理
│       │   ├── database/       # 数据库连接
│       │   └── index.ts        # 入口
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   └── shared/                 # 共享类型和常量
│       ├── src/
│       │   ├── types/          # 共享类型定义
│       │   ├── constants/      # 游戏常量
│       │   └── index.ts
│       └── package.json
│
├── docker-compose.yml
├── package.json                # Workspace root
└── turbo.json                  # Turborepo 配置
```

---

## Chunk 1: 项目脚手架和共享类型

### Task 1.1: 初始化 Monorepo 结构

**Files:**
- Create: `package.json`
- Create: `turbo.json`
- Create: `docker-compose.yml`

- [ ] **Step 1: 创建根 package.json**

```json
{
  "name": "psylent-phantom",
  "private": true,
  "version": "1.0.0",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "^2.0.0"
  }
}
```

- [ ] **Step 2: 创建 turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {}
  }
}
```

- [ ] **Step 3: 创建 docker-compose.yml**

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: psylent
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

- [ ] **Step 4: 验证配置**

Run: `docker-compose up -d`
Expected: PostgreSQL 和 Redis 容器启动成功

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: initialize monorepo structure"
```

### Task 1.2: 创建共享类型包

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/src/types/game.ts`
- Create: `packages/shared/src/types/player.ts`
- Create: `packages/shared/src/types/card.ts`
- Create: `packages/shared/src/constants/index.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: 创建 shared package.json**

```json
{
  "name": "@psylent/shared",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: 创建游戏常量**

Create: `packages/shared/src/constants/index.ts`

```typescript
export const GAME_CONSTANTS = {
  MAX_HP: 10,
  STARTING_HP: 10,
  STARTING_HAND_SIZE: 4,
  DECK_SIZE: 32,
  MAX_HAND_SIZE: 8,
  RESONATE_COST: 3,
  OVERLOAD_DAMAGE: 1,
  OVERLOAD_DRAW: 1,
  PHASE_TIMEOUT_DRAW: 30000,
  PHASE_TIMEOUT_OVERLOAD: 15000,
  PHASE_TIMEOUT_ACTION: 60000,
  DISCONNECT_TIMEOUT: 60000,
  RECONNECT_GRACE_PERIOD: 300000,
} as const;

export const ATTRIBUTES = [
  'THUNDER',
  'HEAT',
  'PSYCHIC',
  'FATE',
  'SPACE',
  'SPIRIT',
] as const;

export type Attribute = typeof ATTRIBUTES[number];

export const ATTRIBUTE_COLORS: Record<Attribute, { primary: string; secondary: string }> = {
  THUNDER: { primary: '#FFD700', secondary: '#4A0080' },
  HEAT: { primary: '#FF4500', secondary: '#8B0000' },
  PSYCHIC: { primary: '#9370DB', secondary: '#191970' },
  FATE: { primary: '#00CED1', secondary: '#FFD700' },
  SPACE: { primary: '#4169E1', secondary: '#00FFFF' },
  SPIRIT: { primary: '#FF69B4', secondary: '#8A2BE2' },
};
```

- [ ] **Step 3: 创建卡牌类型**

Create: `packages/shared/src/types/card.ts`

```typescript
import { Attribute } from '../constants';

export type CardType = 'attack' | 'defense' | 'negotiation' | 'ultimate';

export type EffectType = 'damage' | 'heal' | 'draw' | 'shield' | 'reveal' | 'peek' | 'discard' | 'custom';

export type TargetType = 'self' | 'left' | 'right' | 'all' | 'select' | 'random';

export interface Condition {
  type: 'hasAttribute' | 'hpBelow' | 'hpAbove' | 'hasCard' | 'targetHasAttribute';
  params: unknown[];
}

export interface Effect {
  type: EffectType;
  value: number | 'all' | 'half';
  target: TargetType;
  timing?: 'immediate' | 'delayed' | 'endOfTurn' | 'nextDamage';
  condition?: Condition;
  chain?: Effect[];
}

export interface Card {
  id: string;
  type: CardType;
  name: string;
  attribute?: Attribute;
  cost: number;
  effects: Effect[];
  description: string;
}
```

- [ ] **Step 4: 创建玩家类型**

Create: `packages/shared/src/types/player.ts`

```typescript
import { Attribute } from '../constants';
import { Card } from './card';

export interface Player {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  hand: Card[];
  deck: Card[];
  discard: Card[];
  attributes: Attribute[];
  energy: number;
  isConnected: boolean;
  consecutiveTimeouts: number;
  // 游戏过程中动态添加的字段
  attributesRevealed?: number;  // 已暴露的属性数量（0-2）
  skipNextTurn?: boolean;       // 是否跳过下一回合（共振失败惩罚）
}

export interface MyPlayerView {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  hand: Card[];
  handCount: number;
  deckCount: number;
  discard: Card[];
  attributes: Attribute[];
  energy: number;
  isConnected: boolean;
  consecutiveTimeouts: number;
}

export interface OpponentView {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  handCount: number;
  deckCount: number;
  discard: Card[];
  attributes?: Attribute[];
  attributesRevealed: number;
  energy: number;
  isConnected: boolean;
}
```

- [ ] **Step 5: 创建游戏状态类型**

Create: `packages/shared/src/types/game.ts`

```typescript
import { MyPlayerView, OpponentView, Player } from './player';

export interface GameLogEntry {
  id: string;
  timestamp: number;
  type: string;
  playerId?: string;
  targetId?: string;
  data: unknown;
}

export interface PublicLogEntry {
  timestamp: number;
  message: string;
}

export type GameStatus = 'waiting' | 'selecting' | 'playing' | 'finished';

export type PhaseType = 'draw' | 'overload' | 'action' | 'resolution';

export interface Phase {
  type: PhaseType;
  timeout?: number;
  validActions?: string[];
}

export interface GameState {
  roomId: string;
  status: GameStatus;
  turn: number;
  currentPlayerId: string;
  players: Player[];
  phase: Phase;
  log: GameLogEntry[];
  winner?: string;
}

export interface PlayerViewState {
  roomId: string;
  status: GameStatus;
  turn: number;
  currentPlayerId: string;
  me: MyPlayerView;
  opponents: OpponentView[];
  phase: Phase;
  log: PublicLogEntry[];
  winner?: string;
}

export interface GameLogEntry {
  id: string;
  timestamp: number;
  type: string;
  playerId?: string;
  targetId?: string;
  data: unknown;
}

export interface PublicLogEntry {
  timestamp: number;
  message: string;
}
```

- [ ] **Step 6: 创建入口文件**

Create: `packages/shared/src/index.ts`

```typescript
export * from './constants';
export * from './types/card';
export * from './types/player';
export * from './types/game';
```

- [ ] **Step 7: 创建 tsconfig.json**

Create: `packages/shared/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 8: 构建验证**

Run:
```bash
cd packages/shared
npm install
npm run build
```

Expected: 编译成功，生成 dist 目录

- [ ] **Step 9: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add game types and constants"
```

---

## Chunk 2: 游戏核心逻辑 - 卡牌和效果系统

### Task 2.1: 创建卡牌定义库

**Files:**
- Create: `apps/server/src/game/cards/index.ts`
- Create: `apps/server/src/game/cards/definitions.ts`

- [ ] **Step 1: 创建卡牌定义**

Create: `apps/server/src/game/cards/definitions.ts`

```typescript
import { Card, Attribute } from '@psylent/shared';

export const COMMON_CARDS = {
  punch: (id: string): Card => ({
    id: `punch-${id}`,
    type: 'attack',
    name: '拳击',
    cost: 0,
    effects: [{ type: 'damage', value: 1, target: 'left' }],
    description: '造成1点伤害',
  }),

  kick: (id: string): Card => ({
    id: `kick-${id}`,
    type: 'attack',
    name: '脚踢',
    cost: 1,
    effects: [{ type: 'damage', value: 2, target: 'left' }],
    description: '造成2点伤害',
  }),

  heavyStrike: (id: string): Card => ({
    id: `heavy-${id}`,
    type: 'attack',
    name: '重击',
    cost: 2,
    effects: [{ type: 'damage', value: 3, target: 'left' }],
    description: '造成3点伤害',
  }),

  defend: (id: string): Card => ({
    id: `defend-${id}`,
    type: 'defense',
    name: '防御',
    cost: 0,
    effects: [{ type: 'shield', value: 50, target: 'self' }],
    description: '减少50%受到的伤害',
  }),

  dodge: (id: string): Card => ({
    id: `dodge-${id}`,
    type: 'defense',
    name: '闪避',
    cost: 1,
    effects: [{ type: 'shield', value: 100, target: 'self' }],
    description: '免疫下一次伤害',
  }),
};

export const ATTRIBUTE_CARDS: Record<Attribute, Partial<Record<string, (id: string) => Card>>> = {
  THUNDER: {
    thunderStrike: (id: string) => ({
      id: `thunder-strike-${id}`,
      type: 'attack',
      name: '雷电打击',
      attribute: 'THUNDER',
      cost: 1,
      effects: [
        { type: 'damage', value: 3, target: 'left' },
        {
          type: 'damage',
          value: 1,
          target: 'left',
          condition: { type: 'targetHasAttribute', params: ['HEAT'] },
        },
      ],
      description: '造成3点伤害，对热源属性额外造成1点',
    }),
    chainLightning: (id: string) => ({
      id: `chain-lightning-${id}`,
      type: 'ultimate',
      name: '连锁闪电',
      attribute: 'THUNDER',
      cost: 3,
      effects: [
        { type: 'damage', value: 2, target: 'left' },
        { type: 'damage', value: 2, target: 'right' },
      ],
      description: '对所有敌人造成2点伤害',
    }),
  },
  HEAT: {
    fireball: (id: string) => ({
      id: `fireball-${id}`,
      type: 'attack',
      name: '火球',
      attribute: 'HEAT',
      cost: 1,
      effects: [
        { type: 'damage', value: 2, target: 'left' },
        { type: 'damage', value: 1, target: 'left', timing: 'endOfTurn' },
      ],
      description: '造成2点伤害，回合结束时再造成1点燃烧伤害',
    }),
    inferno: (id: string) => ({
      id: `inferno-${id}`,
      type: 'ultimate',
      name: '炼狱',
      attribute: 'HEAT',
      cost: 3,
      effects: [{ type: 'damage', value: 5, target: 'left' }],
      description: '造成5点伤害',
    }),
  },
  PSYCHIC: {
    psychicSense: (id: string) => ({
      id: `psychic-sense-${id}`,
      type: 'negotiation',
      name: '精神感应',
      attribute: 'PSYCHIC',
      cost: 0,
      effects: [
        {
          type: 'peek',
          value: 1,
          target: 'select',
          chain: [{ type: 'reveal', value: 1, target: 'self' }],
        },
      ],
      description: '查看目标玩家手牌顶的一张牌',
    }),
    mindBlast: (id: string) => ({
      id: `mind-blast-${id}`,
      type: 'ultimate',
      name: '精神冲击',
      attribute: 'PSYCHIC',
      cost: 3,
      effects: [
        { type: 'damage', value: 3, target: 'left' },
        { type: 'discard', value: 1, target: 'left' },
      ],
      description: '造成3点伤害，目标弃1张牌',
    }),
  },
  FATE: {
    fortuneDraw: (id: string) => ({
      id: `fortune-draw-${id}`,
      type: 'negotiation',
      name: '命运抽牌',
      attribute: 'FATE',
      cost: 0,
      effects: [{ type: 'draw', value: 2, target: 'self' }],
      description: '抽2张牌',
    }),
    fateIntervention: (id: string) => ({
      id: `fate-intervention-${id}`,
      type: 'ultimate',
      name: '命运干涉',
      attribute: 'FATE',
      cost: 3,
      effects: [
        { type: 'peek', value: 2, target: 'select' },
        { type: 'draw', value: 1, target: 'self' },
      ],
      description: '查看目标2张手牌，自己抽1张',
    }),
  },
  SPACE: {
    teleport: (id: string) => ({
      id: `teleport-${id}`,
      type: 'negotiation',
      name: '空间传送',
      attribute: 'SPACE',
      cost: 1,
      effects: [{ type: 'shield', value: 100, target: 'self' }],
      description: '免疫下一次伤害',
    }),
    dimensionalSlash: (id: string) => ({
      id: `dimensional-slash-${id}`,
      type: 'ultimate',
      name: '次元斩',
      attribute: 'SPACE',
      cost: 3,
      effects: [{ type: 'damage', value: 4, target: 'select' }],
      description: '对任意目标造成4点伤害',
    }),
  },
  SPIRIT: {
    spiritProbe: (id: string) => ({
      id: `spirit-probe-${id}`,
      type: 'negotiation',
      name: '心灵探测',
      attribute: 'SPIRIT',
      cost: 0,
      effects: [
        {
          type: 'reveal',
          value: 1,
          target: 'select',
          condition: { type: 'targetHasAttribute', params: ['PSYCHIC'] },
        },
      ],
      description: '如果目标是念动属性，揭示其1个隐藏属性',
    }),
    soulDrain: (id: string) => ({
      id: `soul-drain-${id}`,
      type: 'ultimate',
      name: '灵魂吸取',
      attribute: 'SPIRIT',
      cost: 3,
      effects: [
        { type: 'damage', value: 3, target: 'left' },
        { type: 'heal', value: 2, target: 'self' },
      ],
      description: '造成3点伤害，恢复2点生命',
    }),
  },
};

export function generateDeck(attributes: [Attribute, Attribute]): Card[] {
  const deck: Card[] = [];
  let cardId = 0;

  // 通用攻击牌：8张
  for (let i = 0; i < 4; i++) deck.push(COMMON_CARDS.punch(`g-${cardId++}`));
  for (let i = 0; i < 2; i++) deck.push(COMMON_CARDS.kick(`g-${cardId++}`));
  for (let i = 0; i < 2; i++) deck.push(COMMON_CARDS.heavyStrike(`g-${cardId++}`));

  // 通用防御牌：4张
  for (let i = 0; i < 3; i++) deck.push(COMMON_CARDS.defend(`g-${cardId++}`));
  deck.push(COMMON_CARDS.dodge(`g-${cardId++}`));

  // 属性牌：每个属性2张攻击 + 1张交涉
  attributes.forEach((attr) => {
    const cards = ATTRIBUTE_CARDS[attr];
    const cardFactories = Object.values(cards);
    const attackFactories = cardFactories.filter((factory) => factory('test').type === 'attack');
    const negotiationFactories = cardFactories.filter((factory) => factory('test').type === 'negotiation');

    attackFactories.forEach((factory) => {
      deck.push(factory(`a-${cardId++}`));
      deck.push(factory(`a-${cardId++}`));
    });

    negotiationFactories.forEach((factory) => {
      deck.push(factory(`a-${cardId++}`));
    });
  });

  // 必杀技：2张
  attributes.forEach((attr) => {
    const cards = ATTRIBUTE_CARDS[attr];
    const cardFactories = Object.values(cards);
    const ultimateFactory = cardFactories.find((factory) => factory('test').type === 'ultimate');
    if (ultimateFactory) {
      deck.push(ultimateFactory(`u-${cardId++}`));
    }
  });

  // 洗牌
  return shuffle(deck);
}

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
```

- [ ] **Step 2: 创建卡牌模块入口**

Create: `apps/server/src/game/cards/index.ts`

```typescript
export * from './definitions';
```

- [ ] **Step 3: 创建测试**

Create: `apps/server/src/game/cards/definitions.test.ts`

```typescript
import { generateDeck, COMMON_CARDS } from './definitions';
import { GAME_CONSTANTS, Attribute } from '@psylent/shared';

describe('Card Definitions', () => {
  describe('generateDeck', () => {
    it('should generate correct deck size', () => {
      const deck = generateDeck(['THUNDER', 'HEAT']);
      expect(deck.length).toBe(GAME_CONSTANTS.DECK_SIZE);
    });

    it('should include attribute-specific cards', () => {
      const deck = generateDeck(['THUNDER', 'HEAT']);
      const thunderCards = deck.filter((c) => c.attribute === 'THUNDER');
      const heatCards = deck.filter((c) => c.attribute === 'HEAT');

      expect(thunderCards.length).toBeGreaterThan(0);
      expect(heatCards.length).toBeGreaterThan(0);
    });

    it('should shuffle the deck with good distribution', () => {
      // 统计测试：连续生成多个牌库，检查顺序是否随机
      const sampleSize = 100;
      const decks = Array.from({ length: sampleSize }, () => generateDeck(['THUNDER', 'HEAT']));
      const firstCards = decks.map((d) => d[0].id);

      // 统计每种牌出现的次数
      const counts = firstCards.reduce((acc, id) => {
        acc[id] = (acc[id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const uniqueFirstCards = Object.keys(counts);

      // 应该至少有10种不同的首张牌（32种牌的合理分布）
      expect(uniqueFirstCards.length).toBeGreaterThanOrEqual(10);

      // 检查分布是否相对均匀（没有牌出现超过20%）
      const maxCount = Math.max(...Object.values(counts));
      expect(maxCount).toBeLessThan(sampleSize * 0.2);
    });
  });

  describe('COMMON_CARDS', () => {
    it('should create punch with correct stats', () => {
      const punch = COMMON_CARDS.punch('test');
      expect(punch.name).toBe('拳击');
      expect(punch.cost).toBe(0);
      expect(punch.effects[0].value).toBe(1);
    });
  });
});
```

- [ ] **Step 4: 运行测试**

Run:
```bash
cd apps/server
npm test -- cards/definitions.test.ts
```

Expected: 所有测试通过

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/game/cards
git commit -m "feat(server): add card definitions and deck generation"
```

### Task 2.2: 实现效果执行引擎

**Files:**
- Create: `apps/server/src/game/effects/executor.ts`
- Create: `apps/server/src/game/effects/executor.test.ts`

- [ ] **Step 1: 创建效果执行器**

Create: `apps/server/src/game/effects/executor.ts`

```typescript
import { Effect, EffectType, TargetType, Player, Card, Condition } from '@psylent/shared';

export interface EffectContext {
  sourcePlayerId: string;
  targetPlayerId?: string;
  gameState: {
    players: Player[];
    turn: number;
  };
}

export interface EffectResult {
  type: EffectType;
  success: boolean;
  value?: number;
  targetId?: string;
  message: string;
}

export class EffectExecutor {
  execute(effect: Effect, context: EffectContext): EffectResult {
    // 检查条件
    if (effect.condition && !this.checkCondition(effect.condition, context)) {
      return {
        type: effect.type,
        success: false,
        message: 'Condition not met',
      };
    }

    const targetId = this.resolveTarget(effect.target, context);
    if (!targetId && effect.target !== 'self') {
      return {
        type: effect.type,
        success: false,
        message: 'No valid target',
      };
    }

    const result = this.executeEffect(effect, targetId || context.sourcePlayerId, context);

    // 执行连锁效果
    if (effect.chain && result.success) {
      for (const chainEffect of effect.chain) {
        this.execute(chainEffect, { ...context, targetPlayerId: targetId });
      }
    }

    return result;
  }

  private checkCondition(condition: Condition, context: EffectContext): boolean {
    const playerId = context.targetPlayerId || context.sourcePlayerId;
    const target = context.gameState.players.find((p) => p.id === playerId);

    switch (condition.type) {
      case 'targetHasAttribute':
        return target?.attributes.includes(condition.params[0] as string) ?? false;
      case 'hpBelow':
        return (target?.hp ?? 0) < (condition.params[0] as number);
      case 'hpAbove':
        return (target?.hp ?? 0) > (condition.params[0] as number);
      default:
        return true;
    }
  }

  private resolveTarget(target: TargetType, context: EffectContext): string | undefined {
    const sourceIndex = context.gameState.players.findIndex((p) => p.id === context.sourcePlayerId);

    switch (target) {
      case 'self':
        return context.sourcePlayerId;
      case 'left':
        return context.gameState.players[(sourceIndex + 1) % context.gameState.players.length]?.id;
      case 'right':
        return context.gameState.players[(sourceIndex - 1 + context.gameState.players.length) % context.gameState.players.length]?.id;
      case 'select':
        return context.targetPlayerId;
      case 'all':
        return undefined; // 特殊处理
      case 'random':
        const others = context.gameState.players.filter((p) => p.id !== context.sourcePlayerId);
        return others[Math.floor(Math.random() * others.length)]?.id;
      default:
        return undefined;
    }
  }

  private executeEffect(effect: Effect, targetId: string, context: EffectContext): EffectResult {
    const target = context.gameState.players.find((p) => p.id === targetId);
    if (!target) {
      return { type: effect.type, success: false, message: 'Target not found' };
    }

    switch (effect.type) {
      case 'damage':
        const damage = typeof effect.value === 'number' ? effect.value : 0;
        target.hp = Math.max(0, target.hp - damage);
        return {
          type: 'damage',
          success: true,
          value: damage,
          targetId,
          message: `${target.name} 受到 ${damage} 点伤害`,
        };

      case 'heal':
        const heal = typeof effect.value === 'number' ? effect.value : 0;
        target.hp = Math.min(target.maxHp, target.hp + heal);
        return {
          type: 'heal',
          success: true,
          value: heal,
          targetId,
          message: `${target.name} 恢复 ${heal} 点生命`,
        };

      case 'draw':
        const drawCount = typeof effect.value === 'number' ? effect.value : 0;
        // 实际抽牌逻辑在 GameEngine 中处理
        return {
          type: 'draw',
          success: true,
          value: drawCount,
          targetId,
          message: `${target.name} 抽 ${drawCount} 张牌`,
        };

      case 'shield':
        const shieldValue = typeof effect.value === 'number' ? effect.value : 0;
        // 护盾逻辑在伤害计算时处理
        return {
          type: 'shield',
          success: true,
          value: shieldValue,
          targetId,
          message: `${target.name} 获得 ${shieldValue}% 护盾`,
        };

      case 'reveal':
        return {
          type: 'reveal',
          success: true,
          targetId,
          message: '揭示了信息',
        };

      case 'peek':
        return {
          type: 'peek',
          success: true,
          targetId,
          message: '查看了信息',
        };

      case 'discard':
        const discardCount = typeof effect.value === 'number' ? effect.value : 0;
        return {
          type: 'discard',
          success: true,
          value: discardCount,
          targetId,
          message: `${target.name} 弃 ${discardCount} 张牌`,
        };

      default:
        return { type: effect.type, success: false, message: 'Unknown effect type' };
    }
  }
}
```

- [ ] **Step 2: 创建效果执行器测试**

Create: `apps/server/src/game/effects/executor.test.ts`

```typescript
import { EffectExecutor, EffectContext } from './executor';
import { Player, Effect } from '@psylent/shared';

describe('EffectExecutor', () => {
  let executor: EffectExecutor;
  let mockPlayers: Player[];
  let baseContext: EffectContext;

  beforeEach(() => {
    executor = new EffectExecutor();
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
    baseContext = {
      sourcePlayerId: 'p1',
      gameState: { players: mockPlayers, turn: 1 },
    };
  });

  describe('damage effect', () => {
    it('should deal damage to target', () => {
      const effect: Effect = { type: 'damage', value: 3, target: 'left' };
      const result = executor.execute(effect, baseContext);

      expect(result.success).toBe(true);
      expect(result.value).toBe(3);
      expect(mockPlayers[1].hp).toBe(7);
    });

    it('should not reduce hp below 0', () => {
      const effect: Effect = { type: 'damage', value: 15, target: 'left' };
      executor.execute(effect, baseContext);

      expect(mockPlayers[1].hp).toBe(0);
    });
  });

  describe('heal effect', () => {
    it('should heal target', () => {
      mockPlayers[0].hp = 5;
      const effect: Effect = { type: 'heal', value: 3, target: 'self' };
      const result = executor.execute(effect, baseContext);

      expect(result.success).toBe(true);
      expect(mockPlayers[0].hp).toBe(8);
    });

    it('should not exceed maxHp', () => {
      const effect: Effect = { type: 'heal', value: 5, target: 'self' };
      executor.execute(effect, baseContext);

      expect(mockPlayers[0].hp).toBe(10);
    });
  });

  describe('condition check', () => {
    it('should execute when condition is met', () => {
      const effect: Effect = {
        type: 'damage',
        value: 5,
        target: 'left',
        condition: { type: 'targetHasAttribute', params: ['PSYCHIC'] },
      };
      const result = executor.execute(effect, baseContext);

      expect(result.success).toBe(true);
    });

    it('should not execute when condition is not met', () => {
      const effect: Effect = {
        type: 'damage',
        value: 5,
        target: 'left',
        condition: { type: 'targetHasAttribute', params: ['THUNDER'] },
      };
      const result = executor.execute(effect, baseContext);

      expect(result.success).toBe(false);
    });
  });
});
```

- [ ] **Step 3: 运行测试**

Run:
```bash
npm test -- effects/executor.test.ts
```

Expected: 测试通过（可能需要调整实现以处理 players 查找）

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/game/effects
git commit -m "feat(server): add effect execution engine"
```

---

## Chunk 3: 游戏引擎和状态管理

### Task 3.1: 实现游戏状态管理

**Files:**
- Create: `apps/server/src/game/state/manager.ts`
- Create: `apps/server/src/game/state/manager.test.ts`

- [ ] **Step 1: 创建状态管理器**

Create: `apps/server/src/game/state/manager.ts`

```typescript
import { GameState, PlayerViewState, Player, Phase, GameStatus, Attribute, MyPlayerView, OpponentView } from '@psylent/shared';
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

  getPlayerView(playerId: string): PlayerViewState {
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
        attributes: p.attributesRevealed > 0 ? p.attributes.slice(0, p.attributesRevealed) : undefined,
        attributesRevealed: p.attributesRevealed || 0,
        energy: p.energy,
        isConnected: p.isConnected,
      }));

    return {
      roomId: this.state.roomId,
      status: this.state.status,
      turn: this.state.turn,
      currentPlayerId: this.state.currentPlayerId,
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
    // 简化实现，实际需要根据 entry.type 格式化
    return `${entry.type}: ${JSON.stringify(entry.data)}`;
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
```

- [ ] **Step 2: 创建状态管理器测试**

Create: `apps/server/src/game/state/manager.test.ts`

```typescript
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
```

- [ ] **Step 3: 运行测试**

Run:
```bash
npm test -- state/manager.test.ts
```

Expected: 所有测试通过

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/game/state
git commit -m "feat(server): add game state manager"
```

### Task 3.2: 实现游戏引擎核心

**Files:**
- Create: `apps/server/src/game/engine.ts`
- Create: `apps/server/src/game/engine.test.ts`

- [ ] **Step 1: 创建游戏引擎**

Create: `apps/server/src/game/engine.ts`

```typescript
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

    // 开始第一回合
    this.stateManager.startGame();
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
```

- [ ] **Step 2: 创建游戏引擎测试**

Create: `apps/server/src/game/engine.test.ts`

```typescript
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

      expect(engine.getState().status).toBe('playing');
      expect(engine.getState().players[0].hand.length).toBe(GAME_CONSTANTS.STARTING_HAND_SIZE);
    });

    it('should handle card play', () => {
      engine.startGame();
      engine.selectAttributes('p1', ['THUNDER', 'HEAT']);
      engine.selectAttributes('p2', ['PSYCHIC', 'FATE']);

      const p1 = engine.getState().players[0];
      const initialHandSize = p1.hand.length;

      // 出第一张牌
      const cardToPlay = p1.hand[0];
      engine.playCard(p1.id, cardToPlay.id);

      expect(p1.hand.length).toBe(initialHandSize - 1);
      expect(p1.discard.length).toBe(1);
    });

    it('should handle successful resonate', () => {
      engine.startGame();
      engine.selectAttributes('p1', ['THUNDER', 'HEAT']);
      engine.selectAttributes('p2', ['PSYCHIC', 'FATE']);

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

      const p1 = engine.getState().players[0];
      const initialEnergy = p1.energy;

      const success = engine.resonate(p1.id, p2.id, ['THUNDER', 'HEAT']);

      expect(success).toBe(false);
      expect(p1.energy).toBe(initialEnergy - GAME_CONSTANTS.RESONATE_COST);
    });
  });
});
```

- [ ] **Step 3: 运行测试**

Run:
```bash
npm test -- engine.test.ts
```

Expected: 所有测试通过

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/game/engine.ts apps/server/src/game/engine.test.ts
git commit -m "feat(server): add game engine with full game flow"
```

---

## Chunk 4: WebSocket 服务器和房间系统

### Task 4.1: 设置 Express + Socket.io 服务器

**Files:**
- Create: `apps/server/src/index.ts`
- Create: `apps/server/src/websocket/server.ts`
- Create: `apps/server/package.json`

- [ ] **Step 1: 创建服务器 package.json**

Create: `apps/server/package.json`

```json
{
  "name": "@psylent/server",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest"
  },
  "dependencies": {
    "@psylent/shared": "workspace:*",
    "express": "^4.19.0",
    "socket.io": "^4.7.0",
    "redis": "^4.6.0",
    "pg": "^8.11.0",
    "uuid": "^9.0.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "@types/uuid": "^9.0.0",
    "@types/jest": "^29.5.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "tsx": "^4.7.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: 创建服务器入口**

Create: `apps/server/src/index.ts`

```typescript
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createSocketServer } from './websocket/server';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// 基础健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 设置 Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

createSocketServer(io);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

- [ ] **Step 3: 创建 Socket.io 服务器处理**

Create: `apps/server/src/websocket/server.ts`

```typescript
import { Server, Socket } from 'socket.io';
import { RoomManager } from '../rooms/manager';
import { GameEngine } from '../game/engine';

const roomManager = new RoomManager();

export function createSocketServer(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    // 房间相关事件
    socket.on('room:create', (data, callback) => {
      try {
        const room = roomManager.createRoom(data.name, data.maxPlayers, socket.id);
        socket.join(room.id);
        callback({ success: true, room });
      } catch (error) {
        callback({ success: false, error: (error as Error).message });
      }
    });

    socket.on('room:join', (data, callback) => {
      try {
        const room = roomManager.joinRoom(data.roomId, socket.id);
        socket.join(room.id);
        socket.to(room.id).emit('room:update', { players: room.players });
        callback({ success: true, room });
      } catch (error) {
        callback({ success: false, error: (error as Error).message });
      }
    });

    socket.on('room:leave', () => {
      const roomId = roomManager.getRoomIdForPlayer(socket.id);
      if (roomId) {
        roomManager.leaveRoom(roomId, socket.id);
        socket.leave(roomId);
        socket.to(roomId).emit('room:update', { players: roomManager.getRoom(roomId)?.players });
      }
    });

    socket.on('game:selectAttributes', (data, callback) => {
      try {
        const roomId = roomManager.getRoomIdForPlayer(socket.id);
        if (!roomId) throw new Error('Not in a room');

        const game = roomManager.getGame(roomId);
        if (!game) throw new Error('Game not started');

        game.selectAttributes(socket.id, data.attributes);

        // 广播状态更新
        broadcastGameState(io, roomId, game);

        callback({ success: true });
      } catch (error) {
        callback({ success: false, error: (error as Error).message });
      }
    });

    socket.on('game:action', (data, callback) => {
      try {
        const roomId = roomManager.getRoomIdForPlayer(socket.id);
        if (!roomId) throw new Error('Not in a room');

        const game = roomManager.getGame(roomId);
        if (!game) throw new Error('Game not started');

        handleGameAction(game, socket.id, data);

        // 广播状态更新
        broadcastGameState(io, roomId, game);

        callback({ success: true });
      } catch (error) {
        callback({ success: false, error: (error as Error).message });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      const roomId = roomManager.getRoomIdForPlayer(socket.id);
      if (roomId) {
        roomManager.handleDisconnect(roomId, socket.id);
        socket.to(roomId).emit('player:disconnected', { playerId: socket.id });
      }
    });
  });
}

function handleGameAction(game: GameEngine, playerId: string, action: any): void {
  switch (action.type) {
    case 'drawSelect':
      game.selectDrawCard(playerId, action.selectedIndex);
      break;
    case 'overload':
      game.overload(playerId, action.enabled);
      break;
    case 'playCard':
      game.playCard(playerId, action.cardId, action.targetId);
      break;
    case 'resonate':
      game.resonate(playerId, action.targetId, action.guess);
      break;
    case 'skip':
      game.skipTurn(playerId);
      break;
    default:
      throw new Error('Unknown action type');
  }
}

function broadcastGameState(io: Server, roomId: string, game: GameEngine): void {
  const state = game.getState();

  // 向每个玩家发送其专属视图
  state.players.forEach(player => {
    const playerView = game.getPlayerView(player.id);
    io.to(player.id).emit('game:state', { state: playerView });
  });
}
```

- [ ] **Step 4: 创建 tsconfig.json**

Create: `apps/server/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 5: 安装依赖并测试**

Run:
```bash
cd apps/server
npm install
npm run dev
```

Expected: 服务器启动，监听端口 3001

- [ ] **Step 6: Commit**

```bash
git add apps/server
git commit -m "feat(server): setup Express and Socket.io server"
```

### Task 4.2: 实现房间管理器

**Files:**
- Create: `apps/server/src/rooms/manager.ts`
- Create: `apps/server/src/rooms/types.ts`

- [ ] **Step 1: 创建房间类型定义**

Create: `apps/server/src/rooms/types.ts`

```typescript
import { Player } from '@psylent/shared';
import { GameEngine } from '../game/engine';

export interface Room {
  id: string;
  name: string;
  maxPlayers: number;
  players: Player[];
  status: 'waiting' | 'playing' | 'finished';
  hostId: string;
  game?: GameEngine;
  createdAt: Date;
}
```

- [ ] **Step 2: 创建房间管理器**

Create: `apps/server/src/rooms/manager.ts`

```typescript
import { Room } from './types';
import { Player, GAME_CONSTANTS } from '@psylent/shared';
import { GameEngine } from '../game/engine';
import { v4 as uuidv4 } from 'uuid';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private playerRoomMap: Map<string, string> = new Map();

  createRoom(name: string, maxPlayers: number, hostId: string): Room {
    const room: Room = {
      id: uuidv4(),
      name: name || `Room ${Math.floor(Math.random() * 10000)}`,
      maxPlayers: Math.min(maxPlayers || 4, 4),
      players: [],
      status: 'waiting',
      hostId,
      createdAt: new Date(),
    };

    this.rooms.set(room.id, room);
    return room;
  }

  joinRoom(roomId: string, playerId: string): Room {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.status !== 'waiting') {
      throw new Error('Game already in progress');
    }

    if (room.players.length >= room.maxPlayers) {
      throw new Error('Room is full');
    }

    if (room.players.some(p => p.id === playerId)) {
      throw new Error('Already in room');
    }

    const player: Player = {
      id: playerId,
      name: `Player ${room.players.length + 1}`,
      hp: GAME_CONSTANTS.STARTING_HP,
      maxHp: GAME_CONSTANTS.MAX_HP,
      hand: [],
      deck: [],
      discard: [],
      attributes: [],
      energy: GAME_CONSTANTS.RESONATE_COST,
      isConnected: true,
      consecutiveTimeouts: 0,
    };

    room.players.push(player);
    this.playerRoomMap.set(playerId, roomId);

    // 如果人满了，自动开始游戏
    if (room.players.length === room.maxPlayers) {
      this.startGame(roomId);
    }

    return room;
  }

  leaveRoom(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== playerId);
    this.playerRoomMap.delete(playerId);

    if (room.players.length === 0) {
      this.rooms.delete(roomId);
    }
  }

  startGame(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    room.status = 'playing';
    room.game = new GameEngine(roomId, room.players);
    room.game.startGame();
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getRoomIdForPlayer(playerId: string): string | undefined {
    return this.playerRoomMap.get(playerId);
  }

  getGame(roomId: string): GameEngine | undefined {
    return this.rooms.get(roomId)?.game;
  }

  handleDisconnect(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.isConnected = false;
    }

    // TODO: 启动断线超时计时器
  }

  getPublicRooms(): Array<{ id: string; name: string; playerCount: number; maxPlayers: number }> {
    return Array.from(this.rooms.values())
      .filter(room => room.status === 'waiting')
      .map(room => ({
        id: room.id,
        name: room.name,
        playerCount: room.players.length,
        maxPlayers: room.maxPlayers,
      }));
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/rooms
git commit -m "feat(server): add room management"
```

---

## Chunk 5: 前端 React 应用框架

### Task 5.1: 设置 React + Vite 前端

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/index.html`

- [ ] **Step 1: 创建前端 package.json**

Create: `apps/web/package.json`

```json
{
  "name": "@psylent/web",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@psylent/shared": "workspace:*",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0",
    "socket.io-client": "^4.7.0",
    "zustand": "^4.5.0",
    "framer-motion": "^11.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.4.0",
    "vite": "^5.1.0"
  }
}
```

- [ ] **Step 2: 创建 Vite 配置**

Create: `apps/web/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
});
```

- [ ] **Step 3: 创建 tsconfig.json**

Create: `apps/web/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: 创建 tsconfig.node.json**

Create: `apps/web/tsconfig.node.json`

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: 创建 index.html**

Create: `apps/web/index.html`

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>幻默灵影 - Psylent Phantom</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: 安装依赖**

Run:
```bash
cd apps/web
npm install
```

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): setup React + Vite frontend"
```

### Task 5.2: 创建前端基础结构

**Files:**
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/index.css`
- Create: `apps/web/tailwind.config.js`

- [ ] **Step 1: 创建 Tailwind 配置**

Create: `apps/web/tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 灵影属性色彩
        thunder: { DEFAULT: '#FFD700', dark: '#4A0080' },
        heat: { DEFAULT: '#FF4500', dark: '#8B0000' },
        psychic: { DEFAULT: '#9370DB', dark: '#191970' },
        fate: { DEFAULT: '#00CED1', dark: '#FFD700' },
        space: { DEFAULT: '#4169E1', dark: '#00FFFF' },
        spirit: { DEFAULT: '#FF69B4', dark: '#8A2BE2' },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'cursive'],
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 2: 创建 CSS**

Create: `apps/web/src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

body {
  @apply bg-gray-900 text-white;
  font-family: system-ui, -apple-system, sans-serif;
}

.pixel-font {
  font-family: 'Press Start 2P', cursive;
}

/* 卡牌样式 */
.card {
  @apply relative rounded-lg border-2 border-gray-600 bg-gray-800 p-4 transition-transform hover:scale-105;
  aspect-ratio: 2/3;
}

.card-attack {
  @apply border-red-500 bg-red-900/20;
}

.card-defense {
  @apply border-blue-500 bg-blue-900/20;
}

.card-negotiation {
  @apply border-purple-500 bg-purple-900/20;
}

.card-ultimate {
  @apply border-yellow-500 bg-yellow-900/20;
}

/* 像素边框效果 */
.pixel-border {
  box-shadow:
    -4px 0 0 0 black,
    4px 0 0 0 black,
    0 -4px 0 0 black,
    0 4px 0 0 black;
}
```

- [ ] **Step 3: 创建主入口**

Create: `apps/web/src/main.tsx`

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 4: 创建 App 组件**

Create: `apps/web/src/App.tsx`

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/Home';
import { RoomPage } from './pages/Room';
import { GamePage } from './pages/Game';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-900 text-white">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/room/:roomId" element={<RoomPage />} />
          <Route path="/game/:roomId" element={<GamePage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
```

- [ ] **Step 5: 创建页面目录和文件**

Run:
```bash
mkdir -p apps/web/src/pages apps/web/src/components apps/web/src/stores apps/web/src/services
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): add frontend base structure and routing"
```

---

## Chunk 6: 前端游戏界面组件

### Task 6.1: 创建 Socket 服务和状态管理

**Files:**
- Create: `apps/web/src/services/socket.ts`
- Create: `apps/web/src/stores/game.ts`

- [ ] **Step 1: 创建 Socket 服务**

Create: `apps/web/src/services/socket.ts`

```typescript
import { io, Socket } from 'socket.io-client';
import { PlayerViewState } from '@psylent/shared';

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3001');
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

// Socket 事件类型
export interface ServerEvents {
  'game:state': (data: { state: PlayerViewState }) => void;
  'room:update': (data: { players: any[] }) => void;
  'player:disconnected': (data: { playerId: string }) => void;
}

export interface ClientEvents {
  'room:create': (data: { name: string; maxPlayers: number }, callback: (result: any) => void) => void;
  'room:join': (data: { roomId: string }, callback: (result: any) => void) => void;
  'game:selectAttributes': (data: { attributes: [string, string] }, callback: (result: any) => void) => void;
  'game:action': (data: any, callback: (result: any) => void) => void;
}
```

- [ ] **Step 2: 创建游戏状态管理**

Create: `apps/web/src/stores/game.ts`

```typescript
import { create } from 'zustand';
import { PlayerViewState, Attribute } from '@psylent/shared';

interface GameState {
  // 连接状态
  isConnected: boolean;
  socketId: string | null;

  // 房间状态
  currentRoomId: string | null;
  roomName: string;
  players: Array<{ id: string; name: string; isConnected: boolean }>;

  // 游戏状态
  gameState: PlayerViewState | null;
  selectedAttributes: Attribute[];

  // Actions
  setConnected: (connected: boolean) => void;
  setSocketId: (id: string | null) => void;
  setCurrentRoom: (roomId: string | null, name?: string) => void;
  setPlayers: (players: any[]) => void;
  setGameState: (state: PlayerViewState | null) => void;
  setSelectedAttributes: (attrs: Attribute[]) => void;
  reset: () => void;
}

const initialState = {
  isConnected: false,
  socketId: null,
  currentRoomId: null,
  roomName: '',
  players: [],
  gameState: null,
  selectedAttributes: [],
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,

  setConnected: (connected) => set({ isConnected: connected }),
  setSocketId: (id) => set({ socketId: id }),
  setCurrentRoom: (roomId, name) => set({ currentRoomId: roomId, roomName: name || '' }),
  setPlayers: (players) => set({ players }),
  setGameState: (state) => set({ gameState: state }),
  setSelectedAttributes: (attrs) => set({ selectedAttributes: attrs }),
  reset: () => set(initialState),
}));
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/services apps/web/src/stores
git commit -m "feat(web): add socket service and game state store"
```

### Task 6.2: 创建游戏界面组件

**Files:**
- Create: `apps/web/src/components/Card.tsx`
- Create: `apps/web/src/components/Hand.tsx`
- Create: `apps/web/src/components/PlayerBoard.tsx`
- Create: `apps/web/src/components/AttributeSelector.tsx`

- [ ] **Step 1: 创建卡牌组件**

Create: `apps/web/src/components/Card.tsx`

```typescript
import { motion } from 'framer-motion';
import { Card as CardType } from '@psylent/shared';

interface CardProps {
  card: CardType;
  onClick?: () => void;
  disabled?: boolean;
  isSelected?: boolean;
}

export function Card({ card, onClick, disabled, isSelected }: CardProps) {
  const cardClass = {
    attack: 'card-attack',
    defense: 'card-defense',
    negotiation: 'card-negotiation',
    ultimate: 'card-ultimate',
  }[card.type];

  return (
    <motion.div
      whileHover={disabled ? {} : { scale: 1.05, y: -10 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      onClick={disabled ? undefined : onClick}
      className={`
        card ${cardClass} cursor-pointer
        ${isSelected ? 'ring-4 ring-yellow-400' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      style={{ width: '120px', height: '180px' }}
    >
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-start mb-2">
          <span className="text-xs font-bold">{card.cost}⚡</span>
          {card.attribute && (
            <span className="text-xs px-1 rounded bg-white/20">{card.attribute.slice(0, 2)}</span>
          )}
        </div>

        <h3 className="text-sm font-bold text-center mb-2 leading-tight">{card.name}</h3>

        <p className="text-xs text-gray-300 flex-1 leading-relaxed">{card.description}</p>

        <div className="text-xs text-center mt-2 capitalize text-gray-400">{card.type}</div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: 创建手牌组件**

Create: `apps/web/src/components/Hand.tsx`

```typescript
import { Card } from './Card';
import { Card as CardType } from '@psylent/shared';

interface HandProps {
  cards: CardType[];
  onCardClick?: (card: CardType) => void;
  disabled?: boolean;
  selectedCardId?: string;
}

export function Hand({ cards, onCardClick, disabled, selectedCardId }: HandProps) {
  return (
    <div className="flex gap-2 justify-center items-end p-4">
      {cards.map((card, index) => (
        <div
          key={card.id}
          style={{
            transform: `translateY(${Math.abs(index - cards.length / 2) * -5}px)`,
            zIndex: index,
          }}
        >
          <Card
            card={card}
            onClick={() => onCardClick?.(card)}
            disabled={disabled}
            isSelected={card.id === selectedCardId}
          />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: 创建玩家面板组件**

Create: `apps/web/src/components/PlayerBoard.tsx`

```typescript
import { OpponentView } from '@psylent/shared';
import { ATTRIBUTE_COLORS } from '@psylent/shared';

interface PlayerBoardProps {
  player: OpponentView;
  isCurrentTurn: boolean;
  position: 'left' | 'right' | 'top';
}

export function PlayerBoard({ player, isCurrentTurn, position }: PlayerBoardProps) {
  return (
    <div
      className={`
        relative p-4 rounded-lg border-2
        ${isCurrentTurn ? 'border-yellow-400 bg-yellow-900/20' : 'border-gray-600 bg-gray-800'}
        ${!player.isConnected ? 'opacity-50' : ''}
      `}
    >
      {/* 玩家信息 */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-xl">
          {player.name[0]}
        </div>
        <div>
          <div className="font-bold">{player.name}</div>
          <div className="text-xs text-gray-400">{player.handCount} 张手牌</div>
        </div>
      </div>

      {/* 生命值 */}
      <div className="mb-2">
        <div className="flex justify-between text-sm mb-1">
          <span>HP</span>
          <span>{player.hp}/{player.maxHp}</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${(player.hp / player.maxHp) * 100}%` }}
          />
        </div>
      </div>

      {/* 能量 */}
      <div className="flex items-center gap-1">
        <span className="text-xs">⚡</span>
        <span className="text-sm">{player.energy}</span>
      </div>

      {/* 已暴露的属性 */}
      {player.attributes && player.attributes.length > 0 && (
        <div className="mt-2 flex gap-1">
          {player.attributes.map((attr) => (
            <span
              key={attr}
              className="text-xs px-2 py-1 rounded"
              style={{
                backgroundColor: ATTRIBUTE_COLORS[attr].primary,
                color: '#000',
              }}
            >
              {attr}
            </span>
          ))}
        </div>
      )}

      {/* 当前回合标记 */}
      {isCurrentTurn && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2">
          <span className="text-yellow-400 text-2xl">▲</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 创建属性选择器组件**

Create: `apps/web/src/components/AttributeSelector.tsx`

```typescript
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ATTRIBUTES, Attribute, ATTRIBUTE_COLORS } from '@psylent/shared';

interface AttributeSelectorProps {
  onSelect: (attributes: [Attribute, Attribute]) => void;
  disabled?: boolean;
}

export function AttributeSelector({ onSelect, disabled }: AttributeSelectorProps) {
  const [selected, setSelected] = useState<Attribute[]>([]);

  const handleSelect = (attr: Attribute) => {
    if (disabled) return;

    if (selected.includes(attr)) {
      setSelected(selected.filter((a) => a !== attr));
    } else if (selected.length < 2) {
      const newSelected = [...selected, attr];
      setSelected(newSelected);

      if (newSelected.length === 2) {
        onSelect(newSelected as [Attribute, Attribute]);
      }
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-center mb-6">选择你的灵影属性（2个）</h2>

      <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
        {ATTRIBUTES.map((attr) => {
          const isSelected = selected.includes(attr);
          const colors = ATTRIBUTE_COLORS[attr];

          return (
            <motion.button
              key={attr}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleSelect(attr)}
              disabled={disabled || (!isSelected && selected.length >= 2)}
              className={`
                p-6 rounded-lg border-2 transition-all
                ${isSelected ? 'ring-4 ring-white' : ''}
                ${!isSelected && selected.length >= 2 ? 'opacity-50' : ''}
              `}
              style={{
                backgroundColor: colors.primary,
                borderColor: colors.secondary,
                color: '#000',
              }}
            >
              <div className="text-xl font-bold">{attr}</div>
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="mt-2 text-2xl"
                >
                  ✓
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>

      <div className="text-center mt-6 text-gray-400">
        已选择: {selected.length}/2
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components
git commit -m "feat(web): add game UI components"
```

### Task 6.3: 创建页面组件

**Files:**
- Create: `apps/web/src/pages/Home.tsx`
- Create: `apps/web/src/pages/Room.tsx`
- Create: `apps/web/src/pages/Game.tsx`

- [ ] **Step 1: 创建主页**

Create: `apps/web/src/pages/Home.tsx`

```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { connectSocket, disconnectSocket, getSocket } from '../services/socket';
import { useGameStore } from '../stores/game';

export function HomePage() {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const { setConnected, setSocketId } = useGameStore();

  useEffect(() => {
    const socket = connectSocket();

    socket.on('connect', () => {
      setConnected(true);
      setSocketId(socket.id || null);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    return () => {
      disconnectSocket();
    };
  }, []);

  const createRoom = () => {
    const socket = getSocket();
    if (!socket) return;

    setIsConnecting(true);
    socket.emit('room:create', { name: roomName, maxPlayers: 4 }, (result: any) => {
      setIsConnecting(false);
      if (result.success) {
        navigate(`/room/${result.room.id}`);
      } else {
        alert(result.error);
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-5xl font-bold mb-2 pixel-font text-center">
        幻默灵影
      </h1>
      <p className="text-gray-400 mb-8">Psylent Phantom</p>

      <div className="w-full max-w-md space-y-4">
        <input
          type="text"
          placeholder="你的昵称"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          className="w-full px-4 py-3 rounded bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none"
        />

        <input
          type="text"
          placeholder="房间名称（可选）"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          className="w-full px-4 py-3 rounded bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none"
        />

        <button
          onClick={createRoom}
          disabled={isConnecting || !playerName}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded font-bold transition-colors"
        >
          {isConnecting ? '创建中...' : '创建房间'}
        </button>

        <div className="text-center text-gray-500">或</div>

        <button
          onClick={() => navigate('/join')}
          className="w-full py-3 bg-gray-800 hover:bg-gray-700 rounded font-bold transition-colors"
        >
          加入房间
        </button>
      </div>

      <div className="mt-8 text-sm text-gray-500">
        2-4人在线对战 · 隐藏身份 · 像素风格
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建房间页面**

Create: `apps/web/src/pages/Room.tsx`

```typescript
import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSocket } from '../services/socket';
import { useGameStore } from '../stores/game';

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const { players, setPlayers, setCurrentRoom } = useGameStore();

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !roomId) return;

    // 加入房间
    socket.emit('room:join', { roomId }, (result: any) => {
      if (!result.success) {
        alert(result.error);
        navigate('/');
        return;
      }
      setCurrentRoom(roomId, result.room.name);
      setPlayers(result.room.players);
    });

    // 监听房间更新
    socket.on('room:update', (data) => {
      setPlayers(data.players);
    });

    // 监听游戏开始
    socket.on('game:state', () => {
      navigate(`/game/${roomId}`);
    });

    return () => {
      socket.off('room:update');
      socket.off('game:state');
    };
  }, [roomId]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h2 className="text-3xl font-bold mb-8">等待其他玩家...</h2>

      <div className="flex gap-4 mb-8">
        {players.map((player, index) => (
          <div
            key={player.id}
            className={`
              w-20 h-20 rounded-full flex items-center justify-center text-2xl
              ${player.isConnected ? 'bg-green-600' : 'bg-gray-600'}
            `}
          >
            {index + 1}
          </div>
        ))}
        {Array.from({ length: 4 - players.length }).map((_, index) => (
          <div
            key={`empty-${index}`}
            className="w-20 h-20 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-600"
          >
            ?
          </div>
        ))}
      </div>

      <p className="text-gray-400">
        {players.length}/4 玩家已加入
      </p>

      <button
        onClick={() => navigate('/')}
        className="mt-8 text-gray-400 hover:text-white"
      >
        离开房间
      </button>
    </div>
  );
}
```

- [ ] **Step 3: 创建游戏页面**

Create: `apps/web/src/pages/Game.tsx`

```typescript
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getSocket } from '../services/socket';
import { useGameStore } from '../stores/game';
import { Hand } from '../components/Hand';
import { PlayerBoard } from '../components/PlayerBoard';
import { AttributeSelector } from '../components/AttributeSelector';
import { Card as CardType, Attribute } from '@psylent/shared';

export function GamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { gameState, setGameState, selectedAttributes, setSelectedAttributes } = useGameStore();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('game:state', (data) => {
      setGameState(data.state);
    });

    return () => {
      socket.off('game:state');
    };
  }, []);

  const handleAttributeSelect = (attrs: [Attribute, Attribute]) => {
    const socket = getSocket();
    if (!socket) return;

    setSelectedAttributes(attrs);
    socket.emit('game:selectAttributes', { attributes: attrs }, (result: any) => {
      if (!result.success) {
        alert(result.error);
      }
    });
  };

  const handleCardClick = (card: CardType) => {
    if (selectedCardId === card.id) {
      // 出牌
      const socket = getSocket();
      if (!socket) return;

      socket.emit('game:action', {
        type: 'playCard',
        cardId: card.id,
      });
      setSelectedCardId(null);
    } else {
      setSelectedCardId(card.id);
    }
  };

  if (!gameState) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  }

  // 属性选择阶段
  if (gameState.status === 'selecting') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AttributeSelector onSelect={handleAttributeSelect} />
      </div>
    );
  }

  const isMyTurn = gameState.currentPlayerId === gameState.me.id;

  return (
    <div className="min-h-screen p-4">
      {/* 顶部 - 其他玩家 */}
      <div className="flex justify-center gap-4 mb-8">
        {gameState.opponents.map((opponent) => (
          <PlayerBoard
            key={opponent.id}
            player={opponent}
            isCurrentTurn={gameState.currentPlayerId === opponent.id}
            position="top"
          />
        ))}
      </div>

      {/* 中间 - 游戏区域 */}
      <div className="flex-1 flex items-center justify-center min-h-[200px]">
        <div className="text-center">
          <div className="text-2xl font-bold mb-2">
            回合 {gameState.turn}
          </div>
          <div className="text-gray-400">
            {isMyTurn ? '你的回合' : '等待其他玩家...'}
          </div>
          <div className="mt-4 text-sm text-gray-500">
            阶段: {gameState.phase.type}
          </div>
        </div>
      </div>

      {/* 底部 - 自己的信息 */}
      <div className="fixed bottom-0 left-0 right-0 p-4">
        {/* 自己的生命值和信息 */}
        <div className="flex justify-center mb-4">
          <div className="bg-gray-800 rounded-lg p-4 border-2 border-blue-500">
            <div className="flex items-center gap-4">
              <div className="text-2xl font-bold">{gameState.me.name}</div>
              <div className="flex gap-2">
                {gameState.me.attributes.map((attr) => (
                  <span key={attr} className="px-2 py-1 rounded bg-blue-600 text-sm">
                    {attr}
                  </span>
                ))}
              </div>
              <div>HP: {gameState.me.hp}/{gameState.me.maxHp}</div>
              <div>⚡ {gameState.me.energy}</div>
            </div>
          </div>
        </div>

        {/* 手牌 */}
        <Hand
          cards={gameState.me.hand}
          onCardClick={handleCardClick}
          disabled={!isMyTurn || gameState.phase.type !== 'action'}
          selectedCardId={selectedCardId || undefined}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages
git commit -m "feat(web): add game pages"
```

---

## 总结

此实现计划涵盖了完整的幻默灵影电子版开发：

**已完成 Chunk:**
- Chunk 1: 项目脚手架和共享类型
- Chunk 2: 游戏核心逻辑（卡牌、效果）
- Chunk 3: 游戏引擎和状态管理
- Chunk 4: WebSocket 服务器和房间系统
- Chunk 5: 前端 React 框架
- Chunk 6: 前端游戏界面

**文件结构:**
- 6个主要代码模块
- 完整的类型定义
- 单元测试覆盖核心逻辑
- 前后端分离架构

**下一步:**
运行 `npm run dev` 在 `apps/server` 和 `apps/web` 中启动开发服务器，开始实现！
