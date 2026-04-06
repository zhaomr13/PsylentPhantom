import { Card, Attribute } from '@psylent/shared';

// 38张真实行动卡定义 - 基于素材图片内容
// CardID映射: 1200 + (index-1) -> action_XX.png

export const ACTION_CARDS: Card[] = [
  // ===== 第1行 (action_01 - action_10) =====
  // action_01: 不当交易 - 交涉/4费
  {
    id: '1200',
    type: 'negotiation',
    name: '不当交易',
    cost: 4,
    attribute: 'PSYCHIC',
    effects: [{ type: 'forceDiscard', value: 0, target: 'left' }, { type: 'draw', value: 1, target: 'self' }],
    description: '对角玩家将手牌全部交给你，你返还同样数量的手牌',
  },
  // action_02: 合作关系 - 交涉/1费
  {
    id: '1201',
    type: 'negotiation',
    name: '合作关系',
    cost: 1,
    attribute: 'FATE',
    effects: [
      { type: 'peek', value: 1, target: 'left' },
      { type: 'heal', value: 1, target: 'self' },
      { type: 'draw', value: 1, target: 'self' }
    ],
    description: '和对角玩家互相查看1张能力，你回复1点生命值，然后你可以使用1张牌',
  },
  // action_03: 灵光一闪 - 交涉/1费
  {
    id: '1202',
    type: 'negotiation',
    name: '灵光一闪',
    cost: 1,
    attribute: 'PSYCHIC',
    effects: [{ type: 'peek', value: 1, target: 'select' }],
    description: '查看目标以外的一名玩家的手牌，你可以从其中使用一张你可以使用的攻击牌',
  },
  // action_04: 灵光一闪(重复) - 交涉/1费
  {
    id: '1203',
    type: 'negotiation',
    name: '灵光一闪',
    cost: 1,
    attribute: 'PSYCHIC',
    effects: [{ type: 'peek', value: 1, target: 'select' }],
    description: '查看目标以外的一名玩家的手牌，你可以从其中使用一张你可以使用的攻击牌',
  },
  // action_05: 空间认知失调 - 防御/0费
  {
    id: '1204',
    type: 'defense',
    name: '空间认知失调',
    cost: 0,
    attribute: 'SPACE',
    effects: [
      { type: 'shield', value: 1, target: 'self' },
      { type: 'resonateAttempt', value: 1, target: 'self' }
    ],
    description: '所防御的攻击降低1伤害，然后你可以用1张手牌来尝试精神感应',
  },
  // action_06: 静电 - 防御/0费
  {
    id: '1205',
    type: 'defense',
    name: '静电',
    cost: 0,
    attribute: 'THUNDER',
    effects: [{ type: 'shield', value: 2, target: 'self' }],
    description: '所防御的攻击降低2伤害',
  },
  // action_07: 高速移动 - 防御/0费
  {
    id: '1206',
    type: 'defense',
    name: '高速移动',
    cost: 0,
    attribute: 'HEAT',
    effects: [
      { type: 'shield', value: 1, target: 'self' },
      { type: 'counterAttack', value: 1, target: 'left' }
    ],
    description: '所防御的攻击降低1伤害，对目标造成1伤害',
  },
  // action_08: 闪光 - 防御/0费
  {
    id: '1207',
    type: 'defense',
    name: '闪光',
    cost: 0,
    attribute: 'THUNDER',
    effects: [
      { type: 'shield', value: 1, target: 'self' },
      { type: 'counterAttack', value: 1, target: 'left' }
    ],
    description: '所防御的攻击降低1伤害，对目标造成1伤害',
  },
  // action_09: 神经元暴走 - 防御/0费
  {
    id: '1208',
    type: 'defense',
    name: '神经元暴走',
    cost: 0,
    attribute: 'THUNDER',
    effects: [{ type: 'counterAttack', value: 2, target: 'left' }],
    description: '对目标造成2伤害',
  },
  // action_10: 海市蜃楼 - 防御/0费
  {
    id: '1209',
    type: 'defense',
    name: '海市蜃楼',
    cost: 0,
    attribute: 'PSYCHIC',
    effects: [{ type: 'shield', value: 2, target: 'self' }],
    description: '所防御的攻击降低2伤害',
  },

  // ===== 第2行 (action_11 - action_20) =====
  // action_11: 突风 - 攻击/1费
  {
    id: '1210',
    type: 'attack',
    name: '突风',
    cost: 1,
    attribute: 'THUNDER',
    effects: [
      { type: 'shield', value: 1, target: 'self' },
      { type: 'resonateAttempt', value: 1, target: 'self' }
    ],
    description: '所防御的攻击降低1伤害，然后你可以用1张手牌来尝试精神感应',
  },
  // action_12: 空间连结 - 防御/0费
  {
    id: '1211',
    type: 'defense',
    name: '空间连结',
    cost: 0,
    attribute: 'SPACE',
    effects: [{ type: 'shield', value: 100, target: 'self' }],
    description: '所防御的攻击无效化，你无视你自身的能力限制立即使用那张牌',
  },
  // action_13: 静电攻击 - 攻击/1费
  {
    id: '1212',
    type: 'attack',
    name: '静电攻击',
    cost: 1,
    attribute: 'THUNDER',
    effects: [{ type: 'damage', value: 2, target: 'left' }],
    description: '造成2点雷电伤害',
  },
  // action_14: 闪光防御 - 防御/0费
  {
    id: '1213',
    type: 'defense',
    name: '闪光防御',
    cost: 0,
    attribute: 'THUNDER',
    effects: [{ type: 'shield', value: 1, target: 'self' }],
    description: '所防御的攻击降低1伤害',
  },
  // action_15: 梦幻暴走 - 必杀技/4费
  {
    id: '1214',
    type: 'ultimate',
    name: '梦幻暴走',
    cost: 4,
    attribute: 'PSYCHIC',
    effects: [
      { type: 'immune', value: 1, target: 'self', timing: 'delayed' },
      { type: 'disableAbility', value: 1, target: 'all' }
    ],
    description: '直到你的下一个回合开始为止，你不会受到伤害，其他人也不能对你使用共振指环',
  },
  // action_16: 完全烧尽 - 攻击/5费
  {
    id: '1215',
    type: 'attack',
    name: '完全烧尽',
    cost: 5,
    attribute: 'HEAT',
    effects: [{ type: 'damage', value: 5, target: 'left' }],
    description: '造成5点火焰伤害',
  },
  // action_17: 冲天袭击 - 攻击/6费
  {
    id: '1216',
    type: 'attack',
    name: '冲天袭击',
    cost: 6,
    attribute: 'THUNDER',
    effects: [{ type: 'selfDamage', value: 3, target: 'self' }],
    description: '对自己造成3点伤害的高风险攻击',
  },
  // action_18: 爆炸 - 攻击/3费
  {
    id: '1217',
    type: 'attack',
    name: '爆炸',
    cost: 3,
    attribute: 'HEAT',
    effects: [{ type: 'damage', value: 3, target: 'left' }],
    description: '造成3点火焰伤害',
  },
  // action_19: 精神破坏 - 必杀技/4费
  {
    id: '1218',
    type: 'ultimate',
    name: '精神破坏',
    cost: 4,
    attribute: 'PSYCHIC',
    effects: [
      { type: 'selfDamage', value: 4, target: 'self' },
      { type: 'shield', value: 100, target: 'self' },
      { type: 'disableAbility', value: 1, target: 'all' }
    ],
    description: '对自己造成4伤害，所防御的攻击无效化，你以外的所有玩家的一项能力无法使用',
  },
  // action_20: 热感应 - 攻击/2费
  {
    id: '1219',
    type: 'attack',
    name: '热感应',
    cost: 2,
    attribute: 'HEAT',
    effects: [
      { type: 'damage', value: 2, target: 'left' },
      { type: 'resonateAttempt', value: 1, target: 'self', condition: { type: 'hpAbove', params: [0] } }
    ],
    description: '若对目标造成了伤害，你从手牌中选择一张牌来尝试精神感应',
  },

  // ===== 第3行 (action_21 - action_30) =====
  // action_21: 电热刃 - 攻击/4费
  {
    id: '1220',
    type: 'attack',
    name: '电热刃',
    cost: 4,
    attribute: 'HEAT',
    effects: [{ type: 'selfDamage', value: 2, target: 'self' }],
    description: '对自己造成2伤害',
  },
  // action_22: 冰雹 - 攻击/3费
  {
    id: '1221',
    type: 'attack',
    name: '冰雹',
    cost: 3,
    attribute: 'SPACE',
    effects: [{ type: 'damage', value: 3, target: 'left' }],
    description: '造成3点冰霜伤害',
  },
  // action_23: 落雷 - 攻击/3费
  {
    id: '1222',
    type: 'attack',
    name: '落雷',
    cost: 3,
    attribute: 'THUNDER',
    effects: [
      { type: 'selfDamage', value: 1, target: 'self' },
      { type: 'fateInterfere', value: 1, target: 'select' }
    ],
    description: '对自己造成1伤害，对任意玩家进行命运干涉',
  },
  // action_24: 电磁炮 - 攻击/3费
  {
    id: '1223',
    type: 'attack',
    name: '电磁炮',
    cost: 3,
    attribute: 'THUNDER',
    effects: [
      { type: 'selfDamage', value: 1, target: 'self' },
      { type: 'immune', value: 1, target: 'self', timing: 'delayed' }
    ],
    description: '对自己造成1伤害，若没有被防御，到你的下一回合开始为止，你不会受到伤害',
  },
  // action_25: 命运转变 - 攻击/2费
  {
    id: '1224',
    type: 'attack',
    name: '命运转变',
    cost: 2,
    attribute: 'FATE',
    effects: [{ type: 'copyFromDiscard', value: 1, target: 'self' }],
    description: '从自己的竖向弃牌堆中选择1张牌，那张牌的伤害和效果加到这张牌之中',
  },
  // action_26: 缩地 - 攻击/2费
  {
    id: '1225',
    type: 'attack',
    name: '缩地',
    cost: 2,
    attribute: 'SPACE',
    effects: [{ type: 'unblockable', value: 1, target: 'left' }],
    description: '无法防御的攻击',
  },
  // action_27: 落石 - 攻击/2费
  {
    id: '1226',
    type: 'attack',
    name: '落石',
    cost: 2,
    attribute: 'FATE',
    effects: [
      { type: 'unblockable', value: 1, target: 'left' },
      { type: 'fateInterfere', value: 1, target: 'select' }
    ],
    description: '无法防御，对任意玩家进行命运干涉',
  },
  // action_28: 漏电 - 攻击/2费
  {
    id: '1227',
    type: 'attack',
    name: '漏电',
    cost: 2,
    attribute: 'THUNDER',
    effects: [{ type: 'damage', value: 2, target: 'right' }],
    description: '对目标以外的1名玩家造成2伤害',
  },
  // action_29: 拷问 - 攻击/2费
  {
    id: '1228',
    type: 'attack',
    name: '拷问',
    cost: 2,
    attribute: 'PSYCHIC',
    effects: [
      { type: 'damage', value: 2, target: 'left' },
      { type: 'resonateAttempt', value: 1, target: 'self' }
    ],
    description: '若对目标造成了伤害，你从手牌中选择一张牌来尝试精神感应',
  },
  // action_30: 高速弹 - 攻击/2费
  {
    id: '1229',
    type: 'attack',
    name: '高速弹',
    cost: 2,
    attribute: 'SPACE',
    effects: [{ type: 'damage', value: 2, target: 'left' }],
    description: '造成2点空间伤害',
  },

  // ===== 第4行 (action_31 - action_38) =====
  // action_31: 光滑地面 - 攻击/1费
  {
    id: '1230',
    type: 'attack',
    name: '光滑地面',
    cost: 1,
    attribute: 'SPACE',
    effects: [
      { type: 'damage', value: 1, target: 'left' },
      { type: 'immune', value: 1, target: 'self', timing: 'delayed', condition: { type: 'hasAttribute', params: ['notDefended'] } }
    ],
    description: '若没有被防御，到你的下一回合开始为止，你不会受到伤害',
  },
  // action_32: 失物 - 攻击/1费
  {
    id: '1231',
    type: 'attack',
    name: '失物',
    cost: 1,
    attribute: 'FATE',
    effects: [
      { type: 'damage', value: 1, target: 'left' },
      { type: 'fateInterfere', value: 1, target: 'select' }
    ],
    description: '对任意玩家进行命运干涉',
  },
  // action_33: 动摇 - 攻击/1费
  {
    id: '1232',
    type: 'attack',
    name: '动摇',
    cost: 1,
    attribute: 'PSYCHIC',
    effects: [
      { type: 'damage', value: 1, target: 'left' },
      { type: 'resonateAttempt', value: 1, target: 'self' }
    ],
    description: '若对目标造成了伤害，你从手牌中选择一张牌来尝试精神感应',
  },
  // action_34: 占卜 - 攻击/1费
  {
    id: '1233',
    type: 'attack',
    name: '占卜',
    cost: 1,
    attribute: 'FATE',
    effects: [
      { type: 'damage', value: 1, target: 'left' },
      { type: 'resonateAttempt', value: 1, target: 'self' }
    ],
    description: '若对目标造成了伤害，你从手牌中选择一张牌来尝试精神感应',
  },
  // action_35: 野狗 - 攻击/1费
  {
    id: '1234',
    type: 'attack',
    name: '野狗',
    cost: 1,
    attribute: 'SPIRIT',
    effects: [{ type: 'fateInterfere', value: 1, target: 'select' }],
    description: '对任意玩家进行命运干涉',
  },
  // action_36: 磁场 - 攻击/1费
  {
    id: '1235',
    type: 'attack',
    name: '磁场',
    cost: 1,
    attribute: 'THUNDER',
    effects: [
      { type: 'damage', value: 1, target: 'left' },
      { type: 'immune', value: 1, target: 'self', timing: 'delayed', condition: { type: 'hasAttribute', params: ['notDefended'] } }
    ],
    description: '若没有被防御，到你的下一回合开始为止，你不会受到伤害',
  },
  // action_37: 精神支配 - 攻击/1费
  {
    id: '1236',
    type: 'attack',
    name: '精神支配',
    cost: 1,
    attribute: 'PSYCHIC',
    effects: [
      { type: 'damage', value: 1, target: 'left' },
      { type: 'resonateAttempt', value: 1, target: 'self' }
    ],
    description: '用牌库顶的牌尝试精神感应',
  },
  // action_38: 不幸的事故 - 攻击/2费
  {
    id: '1237',
    type: 'attack',
    name: '不幸的事故',
    cost: 2,
    attribute: 'FATE',
    effects: [{ type: 'damage', value: 2, target: 'left' }],
    description: '造成2点命运伤害',
  },
];

// 根据卡牌ID获取图片文件名
export function getCardImageFile(cardId: string): string {
  const id = parseInt(cardId, 10);
  const index = id - 1200 + 1;
  return 'action_' + index.toString().padStart(2, '0') + '.png';
}

// 获取主卡组（33张）- 1204-1236，排除起始牌1200-1202和参考牌
export function generateRealDeck(): Card[] {
  return ACTION_CARDS.filter(card => {
    const id = parseInt(card.id, 10);
    return id >= 1204 && id <= 1236;
  });
}

// 获取完整的38张可用卡牌
export function getAllPlayableCards(): Card[] {
  return ACTION_CARDS;
}
