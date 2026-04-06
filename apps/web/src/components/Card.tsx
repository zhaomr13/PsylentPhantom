import { Card as CardType, Attribute } from '@psylent/shared';
import { ATTRIBUTE_COLORS } from '@psylent/shared';

interface CardProps {
  card: CardType;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  compact?: boolean;
  faceDown?: boolean;
  variant?: 'action' | 'phantom';
}

// Card ID to image file mapping
const ACTION_CARD_MAP: Record<number, string> = {};
for (let i = 0; i < 40; i++) {
  ACTION_CARD_MAP[1200 + i] = `action_${(i + 1).toString().padStart(2, '0')}.png`;
}

const PHANTOM_CARD_MAP: Record<number, string> = {
  100: 'phantom_1.png',
  101: 'phantom_2.png',
  102: 'phantom_3.png',
  103: 'phantom_4.png',
  104: 'phantom_5.png',
  105: 'phantom_6.png',
};

function getCardImageUrl(cardId: number | string, variant: 'action' | 'phantom' = 'action'): string {
  const id = typeof cardId === 'string' ? parseInt(cardId, 10) : cardId;

  if (variant === 'phantom' || (id >= 100 && id < 200)) {
    const file = PHANTOM_CARD_MAP[id];
    return file ? `/assets/cards/phantom/${file}` : '/assets/cards/phantom_back.png';
  }

  const file = ACTION_CARD_MAP[id];
  return file ? `/assets/cards/action/${file}` : '/assets/cards/card_back.png';
}

function getCardBackUrl(variant: 'action' | 'phantom' = 'action'): string {
  return variant === 'phantom'
    ? '/assets/cards/phantom_back.png'
    : '/assets/cards/card_back.png';
}

export function Card({
  card,
  onClick,
  disabled,
  selected,
  compact,
  faceDown = false,
  variant = 'action'
}: CardProps) {
  const getAttributeColor = (attr?: Attribute): string => {
    if (!attr) return 'gray';
    return ATTRIBUTE_COLORS[attr].primary;
  };

  const attributeColor = getAttributeColor(card.attribute);

  const cardIdNum = typeof card.id === 'string' ? parseInt(card.id, 10) : card.id;
  const cardVariant = cardIdNum >= 100 && cardIdNum < 200 ? 'phantom' : variant;
  const imageUrl = faceDown ? getCardBackUrl(cardVariant) : getCardImageUrl(card.id, cardVariant);

  if (compact) {
    return (
      <div
        className={`
          relative w-16 h-24 rounded border-2 border-gray-600 bg-gray-800
          ${selected ? 'ring-2 ring-yellow-400 scale-105' : ''}
          ${disabled ? 'opacity-50' : 'cursor-pointer hover:scale-105'}
          transition-all duration-150
          overflow-hidden
        `}
        onClick={!disabled ? onClick : undefined}
      >
        <img
          src={imageUrl}
          alt={faceDown ? 'Card back' : card.name}
          className="w-full h-full object-cover"
          draggable={false}
        />
        {/* Compact overlay for attribute */}
        {!faceDown && card.attribute && (
          <div
            className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border border-white/30"
            style={{ backgroundColor: attributeColor }}
          >
            {card.attribute?.[0] || '?'}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`
        relative w-32 h-44 rounded-lg border-2 border-gray-600 bg-gray-800
        ${selected ? 'ring-4 ring-yellow-400 scale-110 shadow-lg shadow-yellow-400/50' : ''}
        ${disabled ? 'opacity-50' : 'cursor-pointer hover:scale-105 hover:shadow-xl'}
        transition-all duration-150
        overflow-hidden
      `}
      onClick={!disabled ? onClick : undefined}
    >
      <img
        src={imageUrl}
        alt={faceDown ? 'Card back' : card.name}
        className="w-full h-full object-cover"
        draggable={false}
      />

      {/* Overlay for game info (only show when face up) */}
      {!faceDown && (
        <>
          {/* Attribute badge */}
          {card.attribute && (
            <div
              className="absolute top-1 left-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border border-white/30 shadow-md"
              style={{ backgroundColor: attributeColor }}
            >
              {card.attribute?.[0] || '?'}
            </div>
          )}

          {/* Cost badge */}
          {card.cost > 0 && (
            <div className="absolute top-1 right-1 flex items-center gap-0.5 text-yellow-400 text-sm font-bold bg-black/50 px-1.5 py-0.5 rounded">
              <span>⚡</span>
              <span>{card.cost}</span>
            </div>
          )}

          {/* Card name overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
            <div className="text-center text-xs font-bold pixel-font leading-tight text-white drop-shadow">
              {card.name}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
