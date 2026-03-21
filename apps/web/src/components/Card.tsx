import { Card as CardType, Attribute } from '@psylent/shared';
import { ATTRIBUTE_COLORS } from '@psylent/shared';

interface CardProps {
  card: CardType;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  compact?: boolean;
}

export function Card({ card, onClick, disabled, selected, compact }: CardProps) {
  const getAttributeColor = (attr?: Attribute): string => {
    if (!attr) return 'gray';
    return ATTRIBUTE_COLORS[attr].primary;
  };

  const getCardTypeIcon = (type: string): string => {
    switch (type) {
      case 'attack': return '⚔️';
      case 'defense': return '🛡️';
      case 'negotiation': return '💬';
      case 'ultimate': return '🔥';
      default: return '✨';
    }
  };

  const getCardTypeColor = (type: string): string => {
    switch (type) {
      case 'attack': return 'border-red-500 bg-red-900/30';
      case 'defense': return 'border-blue-500 bg-blue-900/30';
      case 'negotiation': return 'border-green-500 bg-green-900/30';
      case 'ultimate': return 'border-purple-500 bg-purple-900/30';
      default: return 'border-gray-500 bg-gray-800';
    }
  };

  const attributeColor = getAttributeColor(card.attribute);

  if (compact) {
    return (
      <div
        className={`
          relative w-16 h-24 rounded border-2
          ${getCardTypeColor(card.type)}
          ${selected ? 'ring-2 ring-yellow-400 scale-105' : ''}
          ${disabled ? 'opacity-50' : 'cursor-pointer hover:scale-105'}
          transition-all duration-150
          flex flex-col items-center justify-center
        `}
        onClick={!disabled ? onClick : undefined}
      >
        <div className="text-2xl">{getCardTypeIcon(card.type)}</div>
        <div className="text-xs font-bold mt-1">{card.cost}⚡</div>
      </div>
    );
  }

  return (
    <div
      className={`
        relative w-32 h-44 rounded-lg border-2 p-2
        ${getCardTypeColor(card.type)}
        ${selected ? 'ring-4 ring-yellow-400 scale-110 shadow-lg shadow-yellow-400/50' : ''}
        ${disabled ? 'opacity-50' : 'cursor-pointer hover:scale-105 hover:shadow-xl'}
        transition-all duration-150
        flex flex-col
      `}
      onClick={!disabled ? onClick : undefined}
    >
      {/* Card Header */}
      <div className="flex justify-between items-start mb-2">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border border-white/30"
          style={{ backgroundColor: attributeColor }}
        >
          {card.attribute?.[0] || '?'}
        </div>
        <div className="flex items-center gap-1 text-yellow-400 text-sm font-bold">
          <span>⚡</span>
          <span>{card.cost}</span>
        </div>
      </div>

      {/* Card Type Icon */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-4xl">{getCardTypeIcon(card.type)}</div>
      </div>

      {/* Card Name */}
      <div className="text-center text-xs font-bold mb-2 pixel-font leading-tight">
        {card.name}
      </div>

      {/* Card Description */}
      <div className="text-[10px] text-gray-400 text-center leading-tight line-clamp-3">
        {card.description}
      </div>
    </div>
  );
}
