# 幻默灵影电子版 - 技术设计文档

**日期**: 2026-03-16
**版本**: 1.0
**状态**: 设计阶段

---

## 1. 项目概述

### 1.1 项目背景

《幻默灵影》（Psylent Phantom）是一款由日本 BakaFire Party 于2019年推出的桌游，融合了**隐藏身份推理**与**卡牌格斗对战**两种核心机制。本设计文档描述将其改编为在线多人 Web 游戏的完整技术方案。

### 1.2 核心体验

- **双重胜利条件**：通过战斗击杀或共振指环猜测获胜
- **隐藏身份**：每位玩家秘密拥有2个灵影属性，其他玩家需要通过推理来猜测
- **心理博弈**：出牌会暴露信息，但不出牌难以取胜

### 1.3 目标平台

- Web 浏览器（桌面端优先，移动端适配）
- 支持 2-4 人在线实时对战

---

## 2. 需求分析

### 2.1 功能需求

| 优先级 | 功能 | 描述 |
|:---:|:---|:---|
| P0 | 用户系统 | 游客登录、简单账号注册 |
| P0 | 房间系统 | 创建房间、加入房间、房间列表 |
| P0 | 完整游戏流程 | 选属性 → 回合循环 → 胜负判定 |
| P0 | 实时同步 | WebSocket 实时通信 |
| P1 | 断线重连 | 支持玩家断线后恢复游戏 |
| P1 | 聊天系统 | 预设快捷短语、表情 |
| P2 | 排行榜 | 胜负统计、段位系统 |
| P2 | AI 对战 | 单机练习模式 |

### 2.2 非功能需求

- **公平性**：服务器 authoritative，杜绝客户端作弊
- **低延迟**：操作响应 < 300ms
- **可扩展性**：支持水平扩展，容纳同时在线 1000+ 房间
- **兼容性**：Chrome/Firefox/Safari/Edge 最新2个版本

---

## 3. 系统架构

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                          客户端层                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   玩家A     │  │   玩家B     │  │   玩家C     │              │
│  │  React App  │  │  React App  │  │  React App  │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       网关层 (Nginx)                             │
│              负载均衡、SSL终止、静态资源服务                       │
└─────────────────────────────┬───────────────────────────────────┘
                              │ WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       游戏服务器层                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Game       │  │  Game       │  │  Game       │              │
│  │  Server 1   │  │  Server 2   │  │  Server N   │              │
│  │  (Node.js)  │  │  (Node.js)  │  │  (Node.js)  │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          └────────────────┼────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                       数据层                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Redis     │  │  PostgreSQL │  │   (可选)    │              │
│  │  状态缓存   │  │  持久化存储  │  │   消息队列   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 技术栈

| 层级 | 技术选择 | 理由 |
|:---|:---|:---|
| 前端 | React 18 + TypeScript 5 | 组件化、类型安全、生态丰富 |
| 前端状态 | Zustand | 轻量、TypeScript 友好 |
| UI 样式 | Tailwind CSS | 原子化、开发效率高 |
| 动画 | Framer Motion | 声明式动画、React 原生支持 |
| 后端 | Node.js 20 + Express | 事件驱动、WebSocket 支持好 |
| 实时通信 | Socket.io 4 | 自动回退、房间管理、断线检测 |
| 缓存 | Redis 7 | 高性能、Pub/Sub 支持 |
| 数据库 | PostgreSQL 15 | 关系型、JSON 支持、可靠 |
| 部署 | Docker + Docker Compose | 开发/生产一致性 |

### 3.3 集中式服务器设计

**核心理念**：服务器是唯一的真相来源，客户端仅负责渲染和输入收集。

**服务器职责**：
1. **游戏状态机**：维护所有房间的游戏状态
2. **随机数生成**：洗牌、抽牌、属性分配（确保公平）
3. **判定逻辑**：所有游戏规则判定
4. **信息过滤**：只下发玩家可见的信息
5. **反作弊验证**：校验所有操作的合法性

**客户端职责**：
1. 渲染服务器下发的游戏状态
2. 收集玩家输入并发送"意图"
3. 播放动画和音效
4. 本地预览（如卡牌悬停效果）

---

## 4. 游戏核心机制

### 4.1 灵影属性系统

六种灵影属性，每位玩家游戏开始时秘密选择2个（组合数 C(6,2) = 15 种）：

| 属性 | 代码 | 攻击特色 | 防御特色 | 专属能力 |
|:---:|:---:|:---|:---|:---|
| 轰雷 | THUNDER | 高爆发伤害 | 护盾减伤 | 雷电连锁（伤害传导） |
| 热源 | HEAT | 持续燃烧 | 热能护盾 | 燃烧（持续伤害） |
| 念动 | PSYCHIC | 多段攻击 | 闪避 | 精神感应（测试卡牌） |
| 命运 | FATE | 随机伤害 | 命运护盾 | 命运干涉（查看/置换手牌） |
| 空间 | SPACE | 瞬移攻击 | 空间护盾 | 传送（改变目标） |
| 精神 | SPIRIT | 精神冲击 | 精神屏障 | 心灵探测（获取情报） |

### 4.2 卡牌系统

**卡牌类型**：

| 类型 | 描述 | 示例 |
|:---|:---|:---|
| 攻击牌 | 造成伤害 | 拳击(1)、脚踢(2)、武器攻击(3) |
| 防御牌 | 格挡/闪避 | 防御(减伤)、闪避(免疫) |
| 交涉牌 | 特殊效果 | 精神感应、命运干涉 |
| 必杀技 | 属性专属大招 | 各属性独特必杀 |

**牌库构成**（标准模式）：

每位玩家独立牌库，根据所选2个属性生成，牌库大小32张：

| 卡牌类型 | 数量 | 说明 |
|:---|:---:|:---|
| 通用攻击牌 | 8张 | 拳击×4(1伤)、脚踢×2(2伤)、重击×2(3伤) |
| 通用防御牌 | 4张 | 防御×3(减伤50%)、闪避×1(免疫) |
| 属性A攻击牌 | 4张 | 属性A专属攻击牌，各2张 |
| 属性A交涉牌 | 2张 | 属性A专属能力 |
| 属性B攻击牌 | 4张 | 属性B专属攻击牌，各2张 |
| 属性B交涉牌 | 2张 | 属性B专属能力 |
| 必杀技牌 | 2张 | 属性A、B必杀技各1张 |
| 万能牌 | 6张 | 可当攻击/防御使用，伤害/效果-1 |

**卡牌效果系统**：

```typescript
// 效果 DSL 定义
// 效果 DSL 定义 - 这是权威定义，所有效果系统实现应基于此
interface Effect {
  type: 'damage' | 'heal' | 'draw' | 'shield' | 'reveal' | 'peek' | 'discard' | 'custom';
  value: number | 'all' | 'half';
  target: 'self' | 'left' | 'right' | 'all' | 'select' | 'random';
  timing?: 'immediate' | 'delayed' | 'endOfTurn' | 'nextDamage';
  condition?: Condition;
  chain?: Effect[];  // 连锁效果
}

interface Condition {
  type: 'hasAttribute' | 'hpBelow' | 'hpAbove' | 'hasCard' | 'targetHasAttribute';
  params: any[];
}

// 效果执行顺序规则：
// 1. 支付cost（能量/弃牌）
// 2. 检查condition，不满足则效果取消
// 3. 按顺序执行effects数组中的效果
// 4. 如有chain，递归执行chain
// 5. 触发时机效果（delayed/endOfTurn等）
```

**示例卡牌定义**：

```typescript
const thunderStrike: Card = {
  id: 'thunder-strike',
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
      condition: { type: 'targetHasAttribute', params: ['HEAT'] }  // 对热源属性额外伤害
    }
  ],
  image: '/cards/thunder-strike.png'
};

const psychicSense: Card = {
  id: 'psychic-sense',
  type: 'negotiation',
  name: '精神感应',
  attribute: 'PSYCHIC',
  cost: 0,
  effects: [
    {
      type: 'peek',
      value: 1,
      target: 'select',
      chain: [
        { type: 'reveal', value: 1, target: 'self' }  // 揭示目标手牌顶一张
      ]
    }
  ],
  image: '/cards/psychic-sense.png'
};
```

### 4.3 回合流程

```
回合开始
    │
    ▼
┌─────────────┐
│  抽牌阶段    │ ◄── 查看牌库顶2张，选1张加入手牌，另1张正面朝上放回
└──────┬──────┘       (超时：自动选择第一张)
       │
       ▼
┌─────────────┐
│   超载阶段   │ ◄── （可选）自损1生命，换取额外抽牌或调整手牌
└──────┬──────┘       (超时：视为不超载，进入下一阶段)
       │
       ▼
┌─────────────┐
│  主要行动    │ ◄── 选择：攻击 / 使用交涉牌 / 启动共振指环 / 跳过
└──────┬──────┘       (超时：自动跳过回合)
       │
       ▼
┌─────────────┐
│  胜负判定    │ ◄── 检查击杀胜利或共振胜利条件
└──────┬──────┘
       │
       ▼
   回合结束
```

**超时处理规则**：

| 阶段 | 超时时间 | 超时行为 |
|:---|:---:|:---|
| 抽牌 | 30s | 自动选择第一张，另一张放回 |
| 超载 | 15s | 视为不超载，跳过此阶段 |
| 主要行动 | 60s | 自动跳过回合（视为pass） |
| 目标选择 | 15s | 自动选择最近的有效目标 |

**注意**：连续超时3次的玩家将被标记为"托管"，系统自动执行基本操作（防御优先）。

### 4.4 共振指环机制

**启动条件**：消耗3点能量

**效果**：
1. 玩家声明目标的2个灵影属性
2. 服务器验证猜测
3. 若正确：目标立即死亡，猜测者获胜
4. 若错误：猜测者受到惩罚（见下方）

**共振失败惩罚**：

| 惩罚类型 | 效果 | 说明 |
|:---|:---|:---|
| 暴露属性 | 随机暴露猜测者的1个灵影属性给所有玩家 | 最严厉的惩罚 |
| 失去回合 | 猜测者跳过下1个回合 | 中等惩罚 |
| 能量清空 | 猜测者能量归零 | 轻微惩罚 |

*注：惩罚类型可通过房间设置调整，默认使用"暴露属性"。*

**战略意义**：
- 快速结束游戏的手段
- 需要收集足够情报才能准确猜测
- 过早猜测风险高，过晚可能错失机会

---

## 4.5 游戏平衡常数

| 常数 | 默认值 | 说明 |
|:---|:---:|:---|
| `MAX_HP` | 10 | 玩家最大生命值 |
| `STARTING_HP` | 10 | 初始生命值 |
| `STARTING_HAND_SIZE` | 4 | 初始手牌数 |
| `DECK_SIZE` | 32 | 牌库总张数 |
| `MAX_HAND_SIZE` | 8 | 手牌上限 |
| `RESONATE_COST` | 3 | 共振指环能量消耗 |
| `OVERLOAD_DAMAGE` | 1 | 超载自伤值 |
| `OVERLOAD_DRAW` | 1 | 超载额外抽牌数 |
| `PHASE_TIMEOUT_DRAW` | 30000 | 抽牌阶段超时(ms) |
| `PHASE_TIMEOUT_OVERLOAD` | 15000 | 超载阶段超时(ms) |
| `PHASE_TIMEOUT_ACTION` | 60000 | 主要行动阶段超时(ms) |
| `DISCONNECT_TIMEOUT` | 60000 | 断线超时(ms) |
| `RECONNECT_GRACE_PERIOD` | 300000 | 重连宽限期(ms) |

---

## 5. 数据模型

### 5.1 游戏状态（GameState）

**服务器完整状态**（Server-side Full State）：

```typescript
interface GameState {
  roomId: string;
  status: 'waiting' | 'selecting' | 'playing' | 'finished';
  turn: number;
  currentPlayerId: string;
  players: Player[];
  phase: Phase;
  log: GameLogEntry[];
  winner?: string;
}

interface Player {
  id: string;
  name: string;
  hp: number;              // 当前生命值
  maxHp: number;           // 最大生命值（通常10）
  hand: Card[];            // 手牌
  deck: Card[];            // 牌库
  discard: Card[];         // 弃牌堆（公开信息）
  attributes: Attribute[]; // 灵影属性（2个）
  energy: number;          // 能量
  isConnected: boolean;    // 是否在线
  consecutiveTimeouts: number; // 连续超时次数
}
```

**客户端可见状态**（Player View Model）：

```typescript
// 服务器下发给每位玩家的过滤后状态
interface PlayerViewState {
  roomId: string;
  status: 'waiting' | 'selecting' | 'playing' | 'finished';
  turn: number;
  currentPlayerId: string;
  me: MyPlayerView;           // 自己的完整信息
  opponents: OpponentView[];  // 对手的部分信息
  phase: PhaseView;
  log: PublicLogEntry[];      // 公开日志
  winner?: string;
}

interface MyPlayerView {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  hand: Card[];              // 自己的手牌（完整）
  handCount: number;         // 手牌数
  deckCount: number;         // 牌库剩余张数
  discard: Card[];           // 自己的弃牌堆
  attributes: Attribute[];   // 自己的2个属性
  energy: number;
  isConnected: boolean;
  consecutiveTimeouts: number; // 连续超时次数（用于UI警告）
}

interface OpponentView {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  handCount: number;         // 仅能看到手牌数量
  deckCount: number;         // 牌库剩余张数
  discard: Card[];           // 对手的弃牌堆（公开）
  attributes?: Attribute[];  // 仅当该玩家被共振暴露后才可见
  attributesRevealed: number; // 已暴露的属性数量（0-2）
  energy: number;            // 能量公开（影响共振威胁评估）
  isConnected: boolean;
}

interface PhaseView {
  type: 'draw' | 'overload' | 'action' | 'resolution';
  timeout?: number;
  // 抽牌阶段：当前玩家看到自己的抽牌选项，其他人只看到"抽牌中"
  drawOptions?: Card[];      // 仅当前玩家可见
  // 主要行动阶段：可能的行动选项
  validActions?: ActionType[];
}
```

**信息过滤规则**：

| 信息 | 自己可见 | 对手可见 | 说明 |
|:---|:---:|:---:|:---|
| 手牌内容 | ✅ | ❌ | 手牌是核心秘密 |
| 手牌数量 | ✅ | ✅ | 公开信息，影响策略 |
| 属性 | ✅ | 部分 | 被共振暴露后才可见 |
| 牌库数 | ✅ | ✅ | 公开信息 |
| 弃牌堆 | ✅ | ✅ | 公开信息，可推理 |
| 能量 | ✅ | ✅ | 公开信息，影响威胁评估 |
| HP | ✅ | ✅ | 公开信息 |

### 5.2 卡牌定义

```typescript
interface Card {
  id: string;
  type: 'attack' | 'defense' | 'negotiation' | 'ultimate';
  name: string;
  attribute?: Attribute;   // 所属属性（必杀技有）
  cost: number;            // 使用成本
  effects: Effect[];       // 效果列表
  image: string;           // 卡牌图片
}

// 简化版 Effect 接口（用于基础卡牌定义）
// 完整功能使用上面的 DSL 定义
interface Effect {
  type: 'damage' | 'heal' | 'draw' | 'shield' | 'reveal' | 'peek' | 'discard' | 'custom';
  value: number;
  target: 'self' | 'left' | 'right' | 'all' | 'select';
  condition?: Condition;
}
```

### 5.3 消息协议（Socket.io Events）

**客户端 → 服务器**

| Event | Payload | 说明 |
|:---|:---|:---|
| `room:create` | `{ name: string, maxPlayers: number }` | 创建房间 |
| `room:join` | `{ roomId: string }` | 加入房间 |
| `room:leave` | `{}` | 离开房间 |
| `game:selectAttributes` | `{ attributes: [Attr, Attr] }` | 选择灵影属性 |
| `game:action` | `{ type: ActionType, data: any }` | 执行游戏操作 |
| `game:overload` | `{ enabled: boolean }` | 超载开关 |
| `game:resonate` | `{ guess: [Attr, Attr], target: string }` | 启动共振指环 |
| `chat:send` | `{ message: string }` | 发送聊天消息 |

**服务器 → 客户端**

| Event | Payload | 说明 |
|:---|:---|:---|
| `room:joined` | `{ room: Room, player: Player }` | 加入成功 |
| `room:update` | `{ players: Player[] }` | 房间信息更新 |
| `game:started` | `{ state: GameState }` | 游戏开始 |
| `game:state` | `{ state: GameState }` | 完整游戏状态同步 |
| `game:turnStart` | `{ playerId: string, turn: number }` | 回合开始 |
| `game:phaseChange` | `{ phase: Phase }` | 阶段变更 |
| `game:actionResult` | `{ action: Action, result: Result }` | 操作结果 |
| `game:cardDrawn` | `{ card?: Card }` | 抽牌结果（对手看不到具体牌） |
| `game:damaged` | `{ playerId: string, damage: number, hp: number }` | 受伤通知 |
| `game:resonateResult` | `{ success: boolean, guess: [Attr, Attr], actual?: [Attr, Attr] }` | 共振结果 |
| `game:ended` | `{ winner: string, reason: string }` | 游戏结束 |
| `chat:message` | `{ playerId: string, message: string }` | 聊天消息 |
| `error` | `{ code: string, message: string }` | 错误通知 |

**错误代码定义**：

| 错误代码 | 说明 | 客户端处理建议 |
|:---|:---|:---|
| `ROOM_NOT_FOUND` | 房间不存在 | 返回房间列表 |
| `ROOM_FULL` | 房间已满 | 提示用户选择其他房间 |
| `GAME_IN_PROGRESS` | 游戏进行中 | 以观战者身份加入或返回 |
| `INVALID_ACTION` | 非法操作 | 刷新状态，显示正确选项 |
| `NOT_YOUR_TURN` | 非当前玩家回合 | 等待回合开始 |
| `INSUFFICIENT_RESOURCES` | 资源不足（能量/手牌） | 提示资源不足 |
| `INVALID_SELECTION` | 选择无效 | 刷新选项重新选择 |
| `RESONATE_ON_COOLDOWN` | 共振指环冷却中 | 提示冷却剩余时间 |
| `CONNECTION_LOST` | 连接断开 | 尝试重连 |
| `SERVER_ERROR` | 服务器内部错误 | 提示用户稍后再试 |

**错误处理策略**：
- 客户端收到错误后应显示友好的错误提示
- 对于可恢复错误（如 `INVALID_ACTION`），客户端应自动刷新状态
- 对于连接错误，客户端应自动重试（指数退避，最多5次）
- 对于严重错误，应记录日志并引导用户刷新页面

---

## 6. 游戏逻辑流程

### 6.1 房间生命周期

```
[空闲] ──create──► [等待中] ──all ready──► [选属性] ──all selected──► [游戏中]
   ▲                  │                                              │
   │                  │ leave                                         │
   │                  ▼                                              │
   └──destroy──────── [空房间] ◄───────────game end──────────────────┘
```

### 6.2 游戏主循环

```typescript
class GameEngine {
  private state: GameState;
  private pendingDraws: Map<string, Card[]> = new Map(); // playerId -> 抽牌选项

  startGame(): void {
    this.state.status = 'selecting';
    this.broadcast('game:selectAttributes', { timeout: 60000 });
  }

  onAttributesSelected(playerId: string, attrs: Attribute[]): void {
    // 验证属性组合合法
    this.validateAttributes(attrs);
    // 记录玩家属性（对其他玩家不可见）
    this.assignAttributes(playerId, attrs);
    // 检查是否所有玩家都已选择
    if (this.allPlayersSelected()) {
      this.startFirstTurn();
    }
  }

  startTurn(playerId: string): void {
    this.state.currentPlayerId = playerId;
    this.state.phase = { type: 'draw' };

    // 抽牌阶段 - 暂存抽牌选项，等待玩家选择
    const drawnCards = this.drawCards(playerId, 2);
    this.pendingDraws.set(playerId, drawnCards);
    this.emitTo(playerId, 'game:drawOptions', { cards: drawnCards });
  }

  async onDrawSelected(playerId: string, selectedIdx: number): Promise<void> {
    const player = this.getPlayer(playerId);
    const pendingDraw = this.state.pendingDraws.get(playerId);

    if (!pendingDraw || selectedIdx < 0 || selectedIdx >= pendingDraw.length) {
      this.emitTo(playerId, 'error', { code: 'INVALID_SELECTION' });
      return;
    }

    const selectedCard = pendingDraw[selectedIdx];
    const revealedCard = pendingDraw[1 - selectedIdx];

    // 选中的加入手牌
    player.hand.push(selectedCard);
    // 另一张放回牌库顶（正面朝上，所有玩家可见）
    player.deck.unshift(revealedCard);

    // 清除待抽牌状态
    this.state.pendingDraws.delete(playerId);

    this.broadcast('game:cardRevealed', {
      playerId,
      card: revealedCard
    });

    // 进入超载阶段
    this.state.phase = { type: 'overload', timeout: 15000 };
    this.broadcast('game:phaseChange', { phase: this.state.phase });
  }

  onAction(playerId: string, action: Action): void {
    // 验证操作合法性
    if (!this.validateAction(playerId, action)) {
      this.emitTo(playerId, 'error', { code: 'INVALID_ACTION' });
      return;
    }

    // 执行操作
    const result = this.executeAction(playerId, action);

    // 广播结果
    this.broadcast('game:actionResult', { action, result });

    // 检查胜利条件
    if (this.checkWinCondition()) {
      this.endGame();
      return;
    }

    // 进入下一回合
    this.nextTurn();
  }
}
```

### 6.3 共振指环判定

```typescript
async function onResonate(
  playerId: string,
  targetId: string,
  guess: [Attribute, Attribute]
): Promise<void> {
  const target = this.getPlayer(targetId);
  const actual = target.attributes;

  // 排序后比较（顺序不重要）
  const guessSorted = [...guess].sort();
  const actualSorted = [...actual].sort();
  const success = guessSorted[0] === actualSorted[0] &&
                  guessSorted[1] === actualSorted[1];

  if (success) {
    // 共振成功，目标死亡
    target.hp = 0;
    this.broadcast('game:resonateResult', {
      success: true,
      guess,
      actual
    });
    this.endGame(playerId, 'resonate_kill');
  } else {
    // 共振失败，执行惩罚（根据房间设置）
    const penalty = this.state.config.resonatePenalty || 'reveal';

    switch (penalty) {
      case 'reveal': {
        // 随机暴露猜测者的1个属性
        const revealedAttr = this.getRandomUnrevealedAttribute(playerId);
        this.revealAttribute(playerId, revealedAttr);
        break;
      }
      case 'skip': {
        // 失去下1个回合
        this.state.skippedTurns.add(playerId);
        break;
      }
      case 'energy': {
        // 能量归零
        const player = this.getPlayer(playerId);
        player.energy = 0;
        break;
      }
    }

    this.broadcast('game:resonateResult', {
      success: false,
      guess,
      penalty
      // actual 不广播，保持隐藏
    });
  }
}
```

---

## 7. 美术资源需求

### 7.1 像素美术规格

- **分辨率**：基础 32x32 像素，可缩放至 64x64
- **调色板**：限制调色板（每角色 4-8 色）
- **风格参考**：Stardew Valley、Undertale

### 7.2 资源清单

| 类别 | 数量 | 描述 |
|:---|:---:|:---|
| **角色** | 6个 | 6种灵影属性的代表角色，每个包含：站立、攻击、受伤、必杀动画 |
| **卡牌** | ~40张 | 攻击、防御、交涉牌的基础模板 + 各属性变体 |
| **必杀技** | 6个 | 各属性的专属必杀技立绘（更大尺寸，64x64） |
| **UI元素** | 1套 | 血条、手牌框、按钮、面板等 |
| **背景** | 3张 | 主界面、房间等待、对战场景 |
| **特效** | ~10个 | 攻击特效、共振指环发动、胜利/失败动画 |

### 7.3 属性色彩设计

| 属性 | 主色 | 辅色 | 描述 |
|:---|:---:|:---:|:---|
| 轰雷 | #FFD700 | #4A0080 | 金黄 + 深紫，闪电感 |
| 热源 | #FF4500 | #8B0000 | 橙红 + 暗红，火焰感 |
| 念动 | #9370DB | #191970 | 中紫 + 午夜蓝，神秘感 |
| 命运 | #00CED1 | #FFD700 | 深青 + 金黄，命运感 |
| 空间 | #4169E1 | #00FFFF | 皇家蓝 + 青色，空间感 |
| 精神 | #FF69B4 | #8A2BE2 | 热粉 + 蓝紫，精神感 |

---

## 8. 开发路线图

### 8.1 里程碑

| 周次 | 里程碑 | 可交付成果 |
|:---:|:---|:---|
| 1-2 | **核心逻辑** | 游戏状态机、回合流程、本地可玩 |
| 3 | **网络层** | WebSocket、房间系统、基础同步 |
| 4 | **完整功能** | 共振指环、聊天、断线重连 |
| 5 | **美术+UI** | 像素资源制作、UI完善、动画 |
| 6 | **Polish** | 音效、Bug修复、性能优化 |
| 7-8 | **测试+部署** | 内测、修复、上线准备 |

### 8.2 第一周详细计划

**目标**：游戏核心逻辑（本地可玩）

| 天数 | 任务 |
|:---:|:---|
| 1-2 | 搭建项目结构，配置 TypeScript、构建工具 |
| 3 | 实现数据模型：Card、Player、GameState |
| 4 | 实现游戏状态机：回合阶段、状态流转 |
| 5 | 实现卡牌系统：抽牌、出牌、效果执行 |
| 6 | 实现战斗逻辑：伤害计算、防御、必杀技 |
| 7 | 实现共振指环、胜利判定，本地测试可玩 |

### 8.3 技术风险与缓解

| 风险 | 影响 | 缓解措施 |
|:---|:---:|:---|
| 实时同步延迟 | 高 | 操作预测 + 服务器校验；卡牌游戏对延迟容忍度较高 |
| 并发房间过多 | 中 | 水平扩展 + Redis 共享状态 |
| 作弊 | 中 | 服务器 authoritative，所有判定在服务端 |
| 断线处理 | 中 | Redis 持久化 + 重连机制 + 超时托管 |

---

## 9. 测试策略

### 9.1 单元测试

- 游戏逻辑：Jest 测试所有规则判定
- 状态转换：验证每种状态流转的正确性
- 边界条件：空牌库、0生命、同时获胜等

### 9.2 集成测试

- 完整游戏流程：从创建房间到游戏结束
- 网络模拟：延迟、丢包、断线场景
- 并发测试：多房间同时运行

**测试数据策略**：

```typescript
// 使用工厂模式创建测试数据
const testFactories = {
  // 创建测试玩家
  player: (override?: Partial<Player>) => ({
    id: `test-player-${randomId()}`,
    name: `TestPlayer${randomId()}`,
    hp: 10,
    maxHp: 10,
    hand: [],
    deck: [],
    discard: [],
    attributes: ['THUNDER', 'HEAT'],
    energy: 3,
    isConnected: true,
    ...override
  }),

  // 创建测试房间
  room: (override?: Partial<Room>) => ({
    id: `test-room-${randomId()}`,
    name: 'Test Room',
    maxPlayers: 4,
    status: 'waiting',
    config: { resonatePenalty: 'reveal' },
    ...override
  }),

  // 创建测试卡牌
  card: (type: CardType, override?: Partial<Card>) => ({
    id: `test-card-${randomId()}`,
    type,
    name: 'Test Card',
    cost: 1,
    effects: [],
    ...override
  })
};

// 测试钩子：每个测试前清理数据
beforeEach(async () => {
  await db.query('TRUNCATE games, game_players, rooms CASCADE');
  await redis.flushdb();
});
```

### 9.3 手动测试清单

- [ ] 2人、3人、4人游戏各测试5局以上
- [ ] 共振指环正确/错误猜测各场景
- [ ] 断线重连测试
- [ ] 移动端浏览器适配测试

---

## 10. 数据库设计

### 10.1 PostgreSQL Schema

```sql
-- 用户表
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(32) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),  -- 可选，支持游客模式
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP
);

-- 房间表（活跃房间存储在Redis，结束后归档到PG）
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(64) NOT NULL,
  host_id UUID REFERENCES users(id),
  max_players INTEGER DEFAULT 4,
  status VARCHAR(20) DEFAULT 'waiting', -- waiting, playing, finished
  config JSONB DEFAULT '{}', -- 房间配置（惩罚类型、超时设置等）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP
);

-- 游戏记录表
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id),
  winner_id UUID REFERENCES users(id),
  game_data JSONB NOT NULL, -- 完整游戏状态快照（用于回放）
  duration_seconds INTEGER,
  turn_count INTEGER,
  ended_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 玩家游戏记录（关联表）
CREATE TABLE game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  initial_attributes VARCHAR(20)[], -- 该玩家选择的2个属性
  final_hp INTEGER,
  damage_dealt INTEGER DEFAULT 0,
  damage_taken INTEGER DEFAULT 0,
  resonate_attempts INTEGER DEFAULT 0,
  resonate_success BOOLEAN DEFAULT FALSE,
  is_winner BOOLEAN DEFAULT FALSE
);

-- 排行榜/统计数据
CREATE TABLE user_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  total_games INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  resonate_kills INTEGER DEFAULT 0,
  resonate_deaths INTEGER DEFAULT 0,
  normal_kills INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  max_streak INTEGER DEFAULT 0,
  rating INTEGER DEFAULT 1000, -- ELO评分
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_rooms_host ON rooms(host_id);
CREATE INDEX idx_games_room ON games(room_id);
CREATE INDEX idx_games_winner ON games(winner_id);
CREATE INDEX idx_game_players_user ON game_players(user_id);
CREATE INDEX idx_game_players_game ON game_players(game_id);
```

### 10.2 Redis 数据结构

```
-- 房间状态（Hash）
HSET room:{roomId}
  - state: JSON字符串化的GameState
  - version: 状态版本号（乐观锁）
  - updatedAt: 最后更新时间

-- 玩家连接映射（Hash）
HSET room:{roomId}:players
  - {userId}: {socketId}

-- 断线玩家（Sorted Set，按时间排序）
ZADD room:{roomId}:disconnected {timestamp} {userId}

-- 活跃房间列表（Set）
SADD active:rooms {roomId}

-- 用户当前房间（String，TTL 1小时）
SET user:{userId}:current_room {roomId} EX 3600

-- 游戏状态缓存（String，TTL 24小时，用于断线重连）
SET game:{roomId}:state {serializedState} EX 86400
```

---

## 11. 部署方案

### 11.1 开发环境

```yaml
# docker-compose.dev.yml
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

  server:
    build: ./server
    volumes:
      - ./server:/app
      - /app/node_modules
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://dev:dev@postgres:5432/psylent
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

  client:
    build: ./client
    volumes:
      - ./client:/app
      - /app/node_modules
    ports:
      - "3000:3000"

volumes:
  postgres_data:
```

### 11.2 生产环境

- **服务器**：2核4G × 2台（初期）
- **PostgreSQL**：云托管数据库（自动备份）
- **Redis**：云托管 Redis（主从模式）
- **CDN**：静态资源加速
- **监控**：日志 + 基础性能监控 + 告警

**备份策略**：
- 数据库：每日自动备份，保留7天
- Redis：AOF持久化 + 定期快照
- 游戏回放：归档存储90天

---

## 12. 附录

### 12.1 术语表

| 术语 | 说明 |
|:---|:---|
| 灵影 | 游戏中的超能力属性 |
| 共振指环 | 猜测目标属性的机制，猜中即获胜 |
| 超载 | 自损换取资源的机制 |
| Authoritative Server | 服务器作为唯一真相来源的架构 |
| 抽牌选项 | 抽牌阶段看到的2张牌 |
| 暴露属性 | 共振失败后惩罚，使某属性对所有玩家可见 |

### 12.2 动画规格

**角色动画**（每个属性角色）：

| 动画 | 帧数 | 时长 | 说明 |
|:---|:---:|:---:|:---|
| 站立（idle） | 4帧 | 循环 800ms | 待机呼吸动画 |
| 攻击 | 6帧 | 600ms | 单次播放 |
| 受伤 | 4帧 | 400ms | 单次播放，红色闪烁 |
| 必杀技 | 12帧 | 1200ms | 全屏特效配合 |

**特效动画**：

| 特效 | 帧数 | 尺寸 | 说明 |
|:---|:---:|:---:|:---|
| 攻击命中 | 8帧 | 64x64 | 可叠加在目标上 |
| 雷电特效 | 10帧 | 全屏 | 轰雷属性必杀 |
| 火焰特效 | 8帧 | 64x64 | 热源属性攻击 |
| 共振指环 | 20帧 | 全屏 | 金色光环扩散 |
| 胜利 | 16帧 | 全屏 | 彩带+角色动画 |
| 失败 | 12帧 | 全屏 | 暗色滤镜+倒地动画 |

**技术规格**：
- 格式：PNG 序列帧 或 Aseprite 源文件
- 调色板：每角色限制 8 色（含透明）
- 循环方式：idle 循环，其他单次

### 12.3 参考资料

- [BoardGameGeek - Psylent Phantom](https://boardgamegeek.com/boardgame/296040/psylent-phantom)
- Socket.io 官方文档
- React 官方文档

---

**文档历史**

| 日期 | 版本 | 变更 |
|:---|:---:|:---|
| 2026-03-16 | 1.0 | 初始版本 |
| 2026-03-16 | 1.1 | 修复spec review发现的问题：卡牌效果DSL、超时处理、玩家视图模型、错误代码、数据库schema、动画规格 |
