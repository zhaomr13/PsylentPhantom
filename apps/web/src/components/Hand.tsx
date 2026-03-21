import { Card as CardType } from '@psylent/shared';
import { Card } from './Card';

interface HandProps {
  cards: CardType[];
  onCardClick: (card: CardType) => void;
  disabled?: boolean;
  selectedCardId?: string;
}

export function Hand({ cards, onCardClick, disabled, selectedCardId }: HandProps) {
  if (cards.length === 0) {
    return (
      <div className="flex justify-center items-center h-48 text-gray-500">
        手牌为空
      </div>
    );
  }

  return (
    <div className="flex justify-center items-end gap-[-1rem] pb-4">
      {cards.map((card, index) => {
        const isSelected = selectedCardId === card.id;
        const offset = index - (cards.length - 1) / 2;
        const rotation = offset * 5;
        const translateY = Math.abs(offset) * 8;

        return (
          <div
            key={card.id}
            className="transition-all duration-200"
            style={{
              transform: `rotate(${rotation}deg) translateY(${translateY}px)`,
              marginLeft: index > 0 ? '-2rem' : '0',
              zIndex: isSelected ? 20 : cards.length - index,
            }}
          >
            <Card
              card={card}
              onClick={() => onCardClick(card)}
              disabled={disabled}
              selected={isSelected}
            />
          </div>
        );
      })}
    </div>
  );
}
