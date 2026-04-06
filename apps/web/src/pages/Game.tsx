import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { connectSocket, getSocket } from '../services/socket';
import { useGameStore } from '../stores/game';
import { AttributeCardSelector } from '../components/AttributeCardSelector';
import { PlayerBoard } from '../components/PlayerBoard';
import { Hand } from '../components/Hand';
import { ResonateModal } from '../components';
import { Card as CardType, Attribute, OpponentView } from '@psylent/shared';

export function GamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { gameState, setGameState, setSelectedAttributes } = useGameStore();
  const opponentsRef = useRef<OpponentView[]>([]);
  const peekTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [drawOptions, setDrawOptions] = useState<CardType[] | null>(null);
  const [resonateTarget, setResonateTarget] = useState<OpponentView | null>(null);
  const [responseWindow, setResponseWindow] = useState<{ pendingDamage: number; deadline: number } | null>(null);
  const [peekedAttributes, setPeekedAttributes] = useState<Array<{ targetName: string; attribute: string }>>([]);

  useEffect(() => {
    let socket = getSocket();
    if (!socket) {
      socket = connectSocket();
    }

    const handleGameState = (data: any) => {
      console.log('[Game] state received:', data?.state?.status, 'me:', data?.state?.me?.name, 'attrOptions:', data?.state?.me?.attributeOptions);
      if (data?.state) {
        setGameState(data.state);
        opponentsRef.current = data.state.opponents ?? [];
        setIsLoading(false);
      }
    };

    const handleResponseWindow = (data: { pendingDamage: number; timeoutMs: number }) => {
      setResponseWindow({ pendingDamage: data.pendingDamage, deadline: Date.now() + data.timeoutMs });
    };

    const handlePeek = (data: { targetId: string; attribute: string }) => {
      const targetName = opponentsRef.current.find(o => o.id === data.targetId)?.name ?? data.targetId;
      setPeekedAttributes(prev => [...prev, { targetName, attribute: data.attribute }]);
      // Auto-dismiss after 5 seconds
      const timerId = setTimeout(() => setPeekedAttributes(prev => prev.slice(1)), 5000);
      peekTimersRef.current.push(timerId);
    };

    socket.on('game:state', handleGameState);
    socket.on('game:responseWindow', handleResponseWindow);
    socket.on('game:peek', handlePeek);

    socket.emit('game:getState', { roomId }, (result: any) => {
      console.log('[Game] getState:', result?.state?.status, 'ready:', result?.state?.me?.isReady);
      if (result?.state) {
        setGameState(result.state);
        setIsLoading(false);
      }
    });

    return () => {
      socket.off('game:state', handleGameState);
      socket.off('game:responseWindow', handleResponseWindow);
      socket.off('game:peek', handlePeek);
      peekTimersRef.current.forEach(clearTimeout);
      peekTimersRef.current = [];
    };
  }, [roomId, navigate, setGameState]);

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

  useEffect(() => {
    if (phase !== 'response') {
      setResponseWindow(null);
    }
  }, [phase]);

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

  const canResonate = isMyTurn && phase === 'action' && (gameState?.me?.energy ?? 0) >= 3;

  const handleResonateClick = (opponent: OpponentView) => {
    if (!canResonate) return;
    setResonateTarget(opponent);
  };

  const handleResonateConfirm = (guess: [Attribute, Attribute]) => {
    const socket = getSocket();
    if (!socket || !resonateTarget) return;
    socket.emit('game:action', { type: 'resonate', targetId: resonateTarget.id, guess });
    setResonateTarget(null);
  };

  const handleRespond = (cardId: string) => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('game:action', { type: 'respond', cardId }, (result: any) => {
      if (!result?.success) {
        // Timer may have already resolved the response; request fresh state
        socket.emit('game:getState', { roomId }, (r: any) => {
          if (r?.state) { setGameState(r.state); setIsLoading(false); }
        });
      }
    });
    setResponseWindow(null);
  };

  const handleRespondSkip = () => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('game:action', { type: 'respondSkip' }, (result: any) => {
      if (!result?.success) {
        socket.emit('game:getState', { roomId }, (r: any) => {
          if (r?.state) { setGameState(r.state); setIsLoading(false); }
        });
      }
    });
    setResponseWindow(null);
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
    // 获取玩家被分配的3张属性牌选项
    const attributeOptions = gameState.me?.attributeOptions as Attribute[] | undefined;
    console.log('[Game] Selecting phase - me:', gameState.me?.id, 'attributeOptions:', attributeOptions, 'me:', gameState.me);
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AttributeCardSelector onSelect={handleAttributeSelect} options={attributeOptions} />
      </div>
    );
  }

  // Game finished screen
  if (gameState.status === 'finished') {
    const iWon = gameState.winner === gameState.me?.id;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className={`text-5xl font-bold mb-6 ${iWon ? 'text-yellow-400' : 'text-gray-400'}`}>
          {iWon ? '胜利！' : '游戏结束'}
        </div>
        {gameState.winner && (
          <div className="text-xl text-gray-300 mb-8">
            {iWon ? '你获得了胜利！' : `${gameState.opponents?.find(o => o.id === gameState.winner)?.name ?? '对手'} 获胜`}
          </div>
        )}
        <button
          onClick={() => navigate('/')}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-lg"
        >
          返回主页
        </button>
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
    <div
      className="min-h-screen p-4 bg-cover bg-center bg-fixed"
      style={{ backgroundImage: 'url(/assets/board/game_board.png)' }}
    >
      {/* Dark overlay for better readability */}
      <div className="fixed inset-0 bg-black/40 pointer-events-none" />
      {/* Content wrapper with relative positioning */}
      <div className="relative z-10">
        {/* 顶部 - 其他玩家 */}
        <div className="flex justify-center gap-4 mb-8">
        {gameState.opponents.map((opponent) => (
          <PlayerBoard
            key={opponent.id}
            player={opponent}
            isCurrentTurn={gameState.currentPlayerId === opponent.id}
            onResonateClick={canResonate ? handleResonateClick : undefined}
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

        {/* Response Phase UI — shown to defender when they receive a game:responseWindow */}
        {phase === 'response' && responseWindow && (
          <div className="text-center bg-gray-800 border-2 border-red-500 rounded-xl p-6">
            <div className="text-xl font-bold mb-2 text-red-400">防御机会！</div>
            <div className="text-gray-300 mb-4">
              即将受到 <span className="text-red-400 font-bold text-2xl">{responseWindow.pendingDamage}</span> 点伤害
            </div>
            <div className="text-sm text-gray-400 mb-4">
              打出防御牌可以减少伤害，或者选择承受
            </div>
            <div className="flex justify-center gap-4 mb-4">
              {gameState.me.hand
                .filter(c => c.effects.some(e => e.type === 'shield'))
                .map(card => (
                  <button
                    key={card.id}
                    onClick={() => handleRespond(card.id)}
                    className="bg-blue-700 hover:bg-blue-600 border-2 border-blue-400 rounded-lg p-3 w-28"
                  >
                    <div className="font-bold text-sm">{card.name}</div>
                    <div className="text-xs text-gray-300 mt-1">{card.description}</div>
                  </button>
                ))}
            </div>
            <button
              onClick={handleRespondSkip}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded font-bold"
            >
              承受全部伤害
            </button>
          </div>
        )}

        {/* Normal game info (when not in special phase) */}
        {(!isMyTurn || (phase !== 'draw' && phase !== 'overload')) && !(phase === 'response' && responseWindow) && (
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

      {/* Peek notifications */}
      {peekedAttributes.length > 0 && (
        <div className="fixed top-4 right-4 space-y-2 z-40">
          {peekedAttributes.map((p, i) => (
            <div key={i} className="bg-purple-900 border border-purple-400 rounded-lg px-4 py-2 text-sm">
              偷看到 <span className="font-bold">{p.targetName}</span> 的属性：
              <span className="text-purple-300 font-bold ml-1">{p.attribute}</span>
            </div>
          ))}
        </div>
      )}

      {/* Resonate Modal */}
      {resonateTarget && (
        <ResonateModal
          target={resonateTarget}
          myEnergy={gameState?.me?.energy ?? 0}
          onConfirm={handleResonateConfirm}
          onCancel={() => setResonateTarget(null)}
        />
      )}
      </div>{/* End of relative z-10 wrapper */}
    </div>
  );
}
