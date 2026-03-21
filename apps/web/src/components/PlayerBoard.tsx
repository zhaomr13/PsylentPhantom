import { OpponentView } from '@psylent/shared';
import { ATTRIBUTE_COLORS, Attribute } from '@psylent/shared';

interface PlayerBoardProps {
  player: OpponentView;
  isCurrentTurn?: boolean;
  isSelf?: boolean;
}

export function PlayerBoard({ player, isCurrentTurn, isSelf }: PlayerBoardProps) {
  const getAttributeStyle = (attr: Attribute) => ({
    backgroundColor: ATTRIBUTE_COLORS[attr].primary,
    color: '#000',
  });

  const hpPercent = (player.hp / player.maxHp) * 100;

  return (
    <div
      className={`
        relative p-4 rounded-lg border-2 min-w-[180px]
        ${isCurrentTurn ? 'border-yellow-400 shadow-lg shadow-yellow-400/30 animate-pulse' : 'border-gray-600'}
        ${isSelf ? 'bg-blue-900/30 border-blue-500' : 'bg-gray-800'}
        transition-all duration-200
      `}
    >
      {/* Turn Indicator */}
      {isCurrentTurn && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-yellow-500 text-black text-xs font-bold rounded">
          当前回合
        </div>
      )}

      {/* Player Name */}
      <div className="text-center mb-2">
        <span className="font-bold text-lg">{player.name}</span>
        {isSelf && <span className="ml-2 text-blue-400 text-sm">(你)</span>}
        {!player.isConnected && (
          <span className="ml-2 text-red-400 text-sm">(离线)</span>
        )}
      </div>

      {/* HP Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span>HP</span>
          <span>{player.hp}/{player.maxHp}</span>
        </div>
        <div className="h-3 bg-gray-700 rounded-full overflow-hidden border border-gray-600">
          <div
            className={`h-full transition-all duration-300 ${
              hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${hpPercent}%` }}
          />
        </div>
      </div>

      {/* Energy */}
      <div className="flex items-center justify-center gap-1 mb-3 text-yellow-400">
        <span>⚡</span>
        <span className="font-bold">{player.energy}</span>
      </div>

      {/* Attributes (Hidden or Revealed) */}
      <div className="flex justify-center gap-2">
        {player.attributes && player.attributes.length > 0 ? (
          // Revealed attributes
          player.attributes.map((attr) => (
            <span
              key={attr}
              className="px-2 py-1 rounded text-xs font-bold"
              style={getAttributeStyle(attr)}
            >
              {attr}
            </span>
          ))
        ) : (
          // Hidden attributes (question marks)
          <>
            {Array.from({ length: 2 - player.attributesRevealed }).map((_, i) => (
              <span
                key={`hidden-${i}`}
                className="px-2 py-1 rounded text-xs font-bold bg-gray-700 text-gray-500"
              >
                ???
              </span>
            ))}
            {player.attributesRevealed > 0 && (
              <span className="px-2 py-1 rounded text-xs font-bold bg-red-600 text-white">
                +{player.attributesRevealed}
              </span>
            )}
          </>
        )}
      </div>

      {/* Deck/Hand Count */}
      <div className="mt-3 flex justify-center gap-4 text-xs text-gray-400">
        <span>牌库: {player.deckCount}</span>
        <span>手牌: {player.handCount}</span>
      </div>

      {/* Discard pile indicator */}
      {player.discard.length > 0 && (
        <div className="mt-2 text-center text-xs text-gray-500">
          弃牌: {player.discard.length}
        </div>
      )}
    </div>
  );
}
