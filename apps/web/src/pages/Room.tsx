import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { connectSocket, getSocket } from '../services/socket';
import { useGameStore } from '../stores/game';

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const hasNavigated = useRef(false); // 防止重复导航

  const { players, setPlayers, setCurrentRoom } = useGameStore();
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    // Ensure socket is connected
    let socket = getSocket();
    if (!socket) {
      console.log('[Room] Socket not found, reconnecting...');
      socket = connectSocket();
    }
    console.log('[Room] socket:', socket?.id, 'roomId:', roomId);
    if (!roomId) return;

    // Wait for socket to be connected before joining
    const joinRoom = () => {
      if (!socket.connected) {
        console.log('[Room] Socket not connected yet, waiting...');
        return;
      }

      // 加入房间
      const savedPlayerName = sessionStorage.getItem('playerName') || 'Player';
      console.log('[Room] Emitting room:join for', roomId);
      socket.emit('room:join', { roomId, playerName: savedPlayerName }, (result: any) => {
        console.log('[Room] room:join callback:', result);
        if (!result.success) {
          alert(result.error);
          navigate('/');
          return;
        }
        console.log('[Room] Setting players:', result.room.players);
        setCurrentRoom(roomId, result.room.name);
        setPlayers(result.room.players);
        setMaxPlayers(result.room.maxPlayers);
        // Check if this player is the host (first player)
        if (result.room.players[0]?.id === socket.id) {
          setIsHost(true);
        }
      });
    };

    // Try to join immediately if connected, or wait for connect
    if (socket.connected) {
      joinRoom();
    } else {
      socket.once('connect', joinRoom);
    }

    return () => {
      socket.off('connect', joinRoom);
    };
  }, [roomId, navigate, setCurrentRoom, setPlayers]);

  // Separate effect for room updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // 监听房间更新
    const handleRoomUpdate = (data: any) => {
      console.log('[Room] room:update received:', data);
      if (data.players) {
        setPlayers(data.players);
      }
      if (data.maxPlayers) {
        setMaxPlayers(data.maxPlayers);
      }
    };
    socket.on('room:update', handleRoomUpdate);

    // 监听游戏开始 - 只在游戏真正开始时跳转
    const handleGameState = (data: any) => {
      console.log('[Room] game:state received, status:', data?.state?.status, 'attrOptions:', data?.state?.me?.attributeOptions);
      if ((data?.state?.status === 'playing' || data?.state?.status === 'selecting') && !hasNavigated.current) {
        console.log('[Room] Navigating to game page');
        hasNavigated.current = true;
        navigate(`/game/${roomId}`);
      } else {
        console.log('[Room] Not navigating, status:', data?.state?.status, 'alreadyNavigated:', hasNavigated.current);
      }
    };
    socket.on('game:state', handleGameState);

    return () => {
      socket.off('room:update', handleRoomUpdate);
      socket.off('game:state', handleGameState);
    };
  }, [roomId, navigate, setPlayers]);

  const startGame = () => {
    const socket = getSocket();
    console.log('[Room] startGame clicked, socket:', socket?.id, 'isHost:', isHost);
    if (!socket || !isHost) {
      console.log('[Room] Cannot start game - socket:', !!socket, 'isHost:', isHost);
      return;
    }
    console.log('[Room] Emitting room:startGame for room:', roomId);
    socket.emit('room:startGame', { roomId }, (result: any) => {
      console.log('[Room] room:startGame callback:', result);
    });
  };

  console.log('[Room] Render - players:', players, 'maxPlayers:', maxPlayers);

  const copyRoomCode = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      alert('房间号已复制: ' + roomId);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h2 className="text-3xl font-bold mb-4">等待其他玩家...</h2>

      {/* Room Code Display */}
      <div className="mb-8 text-center">
        <p className="text-gray-400 mb-2">房间号</p>
        <div
          onClick={copyRoomCode}
          className="text-5xl font-bold tracking-wider bg-gray-800 px-8 py-4 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors"
        >
          {roomId}
        </div>
        <p className="text-xs text-gray-500 mt-2">点击复制，分享给好友</p>
      </div>

      <div className="text-xs text-gray-500 mb-4">Debug: {players.length} players, max: {maxPlayers}</div>

      <div className="flex gap-4 mb-8">
        {players.map((player, index) => (
          <div
            key={player.id}
            className={`
              w-20 h-20 rounded-full flex items-center justify-center text-2xl
              ${player.isConnected ? 'bg-green-600' : 'bg-gray-600'}
            `}
          >
            {index + 1}
          </div>
        ))}
        {Array.from({ length: maxPlayers - players.length }).map((_, index) => (
          <div
            key={`empty-${index}`}
            className="w-20 h-20 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-600"
          >
            ?
          </div>
        ))}
      </div>

      <p className="text-gray-400">
        {players.length}/{maxPlayers} 玩家已加入
      </p>

      {isHost && players.length >= 1 && (
        <button
          onClick={startGame}
          className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-700 rounded font-bold"
        >
          开始游戏 ({players.length}人)
        </button>
      )}

      {!isHost && (
        <p className="mt-4 text-gray-400 text-sm">
          等待房主开始游戏...
        </p>
      )}

      <button
        onClick={() => navigate('/')}
        className="mt-8 text-gray-400 hover:text-white"
      >
        离开房间
      </button>
    </div>
  );
}
