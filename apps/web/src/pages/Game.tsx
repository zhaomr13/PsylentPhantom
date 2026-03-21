import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { connectSocket, getSocket } from '../services/socket';
import { useGameStore } from '../stores/game';
import { AttributeSelector } from '../components/AttributeSelector';
import { PlayerBoard } from '../components/PlayerBoard';
import { Hand } from '../components/Hand';
import { Card as CardType, Attribute } from '@psylent/shared';

export function GamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { gameState, setGameState, setSelectedAttributes } = useGameStore();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [drawOptions, setDrawOptions] = useState<CardType[] | null>(null);

  useEffect(() => {
    let socket = getSocket();
    if (!socket) {
      socket = connectSocket();
    }

    const handleGameState = (data: any) => {
      console.log('[Game] state:', data?.state?.status, 'me:', data?.state?.me?.name, 'ready:', data?.state?.me?.isReady);
      if (data?.state) {
        setGameState(data.state);
        setIsLoading(false);
      }
    };

    socket.on('game:state', handleGameState);

    socket.emit('game:getState', { roomId }, (result: any) => {
      console.log('[Game] getState:', result?.state?.status, 'ready:', result?.state?.me?.isReady);
      if (result?.state) {
        setGameState(result.state);
        setIsLoading(false);
      }
    });

    const timeout = setTimeout(() => {
      if (!gameState) navigate(`/room/${roomId}`);
    }, 5000);

    return () => {
      socket.off('game:state', handleGameState);
      clearTimeout(timeout);
    };
  }, [roomId, navigate, setGameState, gameState]);

  // Handle draw phase - need to request draw options from server
  const isMyTurn = gameState?.currentPlayerId === gameState?.me?.id;
  const phase = gameState?.phase?.type;

  useEffect(() => {
    if (isMyTurn && phase === 'draw' && !drawOptions) {
      const socket = getSocket();
      if (!socket) return;

      // Request draw options
      socket.emit('game:action', { type: 'startDraw' }, (result: any) => {
        if (result?.result) {
          setDrawOptions(result.result);
        }
      });
    }
  }, [isMyTurn, phase, drawOptions]);

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

  const handleDrawSelect = (index: number) => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit('game:action', { type: 'drawSelect', selectedIndex: index });
    setDrawOptions(null);
  };

  const handleOverload = (enabled: boolean) => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit('game:action', { type: 'overload', enabled });
  };

  if (isLoading || !gameState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="text-xl mb-4">加载中...</div>
        <button
          onClick={() => navigate(`/room/${roomId}`)}
          className="text-blue-400 hover:text-blue-300"
        >
          返回房间
        </button>
      </div>
    );
  }

  // Show waiting/ready UI when in selecting state
  if (gameState.status === 'selecting') {
    const meReady = !!gameState.me?.isReady;
    console.log('[Game] selecting, meReady:', meReady, 'opponents:', gameState.opponents?.map((o: any) => `${o.name}:${o.isReady}`));

    // Check if current player has already selected attributes (isReady)
    if (meReady) {
      const allReady = gameState.opponents?.every((o: any) => o.isReady) ?? true;
      const isHost = gameState.me?.id === gameState.hostId;

      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
          <div className="text-2xl font-bold mb-6">等待其他玩家...</div>

          {/* Player list with ready status */}
          <div className="bg-gray-800 rounded-lg p-6 mb-6 w-full max-w-md">
            <div className="text-lg font-semibold mb-4">玩家状态</div>
            <div className="space-y-3">
              {/* Self */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{gameState.me?.name}</span>
                  <span className="text-xs text-gray-400">(你)</span>
                </div>
                <span className="px-2 py-1 rounded bg-green-600 text-sm flex items-center gap-1">
                  <span>✓</span> 已准备
                </span>
              </div>
              {/* Opponents */}
              {gameState.opponents?.map(opponent => (
                <div key={opponent.id} className="flex items-center justify-between">
                  <span>{opponent.name}</span>
                  <span className={`px-2 py-1 rounded text-sm flex items-center gap-1 ${opponent.isReady ? 'bg-green-600' : 'bg-yellow-600'}`}>
                    {opponent.isReady ? <span>✓</span> : <span>⏳</span>}
                    {opponent.isReady ? '已准备' : '选择中...'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Start game button - only for host when all ready */}
          {isHost && allReady && (
            <button
              onClick={() => {
                const socket = getSocket();
                if (!socket) return;
                socket.emit('room:startGamePlay', {}, (result: any) => {
                  if (!result?.success) {
                    alert(result?.error || '开始游戏失败');
                  }
                });
              }}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-lg"
            >
              开始游戏
            </button>
          )}

          {isHost && !allReady && (
            <div className="text-gray-400">等待所有玩家准备...</div>
          )}

          {!isHost && allReady && (
            <div className="text-gray-400">等待房主开始游戏...</div>
          )}
        </div>
      );
    }

    // Show attribute selector for players who haven't selected
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AttributeSelector onSelect={handleAttributeSelect} />
      </div>
    );
  }

  // Safety check
  if (!gameState.me || !gameState.opponents) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="text-xl mb-4">游戏数据加载中...</div>
        <button
          onClick={() => navigate(`/room/${roomId}`)}
          className="text-blue-400 hover:text-blue-300"
        >
          返回房间
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      {/* 顶部 - 其他玩家 */}
      <div className="flex justify-center gap-4 mb-8">
        {gameState.opponents.map((opponent) => (
          <PlayerBoard
            key={opponent.id}
            player={opponent}
            isCurrentTurn={gameState.currentPlayerId === opponent.id}
          />
        ))}
      </div>

      {/* 中间 - 游戏区域 */}
      <div className="flex-1 flex items-center justify-center min-h-[200px]">
        {/* Draw Phase UI */}
        {isMyTurn && phase === 'draw' && drawOptions && (
          <div className="text-center">
            <div className="text-xl font-bold mb-4">抽牌阶段 - 选择一张加入手牌</div>
            <div className="flex justify-center gap-4 mb-4">
              {drawOptions.map((card, index) => (
                <button
                  key={index}
                  onClick={() => handleDrawSelect(index)}
                  className="bg-gray-700 hover:bg-gray-600 border-2 border-yellow-500 rounded-lg p-4 w-32 h-48 flex flex-col items-center justify-center"
                >
                  <div className="font-bold text-lg">{card.name}</div>
                  <div className="text-xs text-gray-400 mt-2">{card.type}</div>
                </button>
              ))}
            </div>
            <div className="text-sm text-gray-400">另一张将放回牌库顶（公开）</div>
          </div>
        )}

        {/* Overload Phase UI */}
        {isMyTurn && phase === 'overload' && (
          <div className="text-center">
            <div className="text-xl font-bold mb-4">超载阶段</div>
            <div className="text-gray-400 mb-6">
              承受 1 点伤害，额外抽 2 张牌？
            </div>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => handleOverload(true)}
                className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-lg font-bold"
              >
                超载 (+2牌 -1HP)
              </button>
              <button
                onClick={() => handleOverload(false)}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-500 rounded-lg font-bold"
              >
                跳过
              </button>
            </div>
          </div>
        )}

        {/* Normal game info (when not in special phase) */}
        {(!isMyTurn || (phase !== 'draw' && phase !== 'overload')) && (
          <div className="text-center">
            <div className="text-2xl font-bold mb-2">
              回合 {gameState.turn}
            </div>
            <div className="text-gray-400">
              {isMyTurn ? '你的回合' : '等待其他玩家...'}
            </div>
            <div className="mt-4 text-sm text-gray-500">
              阶段: {phase === 'draw' ? '抽牌' : phase === 'overload' ? '超载' : phase === 'action' ? '行动' : phase}
            </div>
          </div>
        )}
      </div>

      {/* 底部 - 自己的信息 */}
      <div className="fixed bottom-0 left-0 right-0 p-4">
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
