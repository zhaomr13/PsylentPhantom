import { generateDeck, COMMON_CARDS } from './definitions';
import { GAME_CONSTANTS } from '@psylent/shared';

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
