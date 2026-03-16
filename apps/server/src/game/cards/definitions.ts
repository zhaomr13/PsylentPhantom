import { Card, Attribute, GAME_CONSTANTS } from '@psylent/shared';

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

export const WILD_CARD = (id: string): Card => ({
  id: `wild-${id}`,
  type: 'attack',
  name: '万能牌',
  cost: 1,
  effects: [{ type: 'damage', value: 1, target: 'left' }],
  description: '可当攻击或防御使用',
});

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

  // 属性专属牌：每个属性6张（攻击×2 + 必杀技×1 + 交涉×2，根据实际定义调整）
  attributes.forEach((attr) => {
    const cards = ATTRIBUTE_CARDS[attr];
    const factories = Object.values(cards).filter((f): f is (id: string) => Card => f !== undefined);

    factories.forEach((factory) => {
      const cardType = factory('test').type;
      // 攻击牌2张，其他各1张
      const count = cardType === 'attack' ? 2 : 1;
      for (let i = 0; i < count; i++) {
        deck.push(factory(`a-${cardId++}`));
      }
    });
  });

  // 万能牌：剩余数量（约6-10张）
  const wildCount = GAME_CONSTANTS.DECK_SIZE - deck.length;
  for (let i = 0; i < wildCount; i++) deck.push(WILD_CARD(`w-${cardId++}`));

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
