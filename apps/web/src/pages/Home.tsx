import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { connectSocket, getSocket } from '../services/socket';
import { useGameStore } from '../stores/game';

export function HomePage() {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [isConnecting, setIsConnecting] = useState(false);

  const { setConnected, setSocketId } = useGameStore();

  useEffect(() => {
    const socket = connectSocket();

    socket.on('connect', () => {
      setConnected(true);
      setSocketId(socket.id || null);

      const savedRoomId = sessionStorage.getItem('roomId');
      const savedPlayerName = sessionStorage.getItem('playerName');
      if (savedRoomId && savedPlayerName) {
        socket.emit('room:join', { roomId: savedRoomId, playerName: savedPlayerName }, (result: any) => {
          if (result.success) {
            const status = result.room?.status;
            if (status === 'playing' || status === 'selecting') {
              navigate(`/game/${savedRoomId}`);
            } else {
              navigate(`/room/${savedRoomId}`);
            }
          } else {
            // Session expired — clear storage
            sessionStorage.removeItem('roomId');
            sessionStorage.removeItem('playerName');
            sessionStorage.removeItem('reconnectToken');
          }
        });
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // Note: Don't disconnect socket on unmount - we need it for Room page
  }, []);

  const createRoom = () => {
    const socket = getSocket();
    if (!socket) return;

    setIsConnecting(true);
    socket.emit('room:create', { name: roomName, maxPlayers, playerName: playerName.trim() }, (result: any) => {
      setIsConnecting(false);
      if (result.success) {
        sessionStorage.setItem('roomId', result.room.id);
        sessionStorage.setItem('playerName', playerName.trim());
        if (result.reconnectToken) sessionStorage.setItem('reconnectToken', result.reconnectToken);
        navigate(`/room/${result.room.id}`);
      } else {
        alert(result.error);
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-5xl font-bold mb-2 pixel-font text-center">
        幻默灵影
      </h1>
      <p className="text-gray-400 mb-8">Psylent Phantom</p>

      <div className="w-full max-w-md space-y-4">
        <input
          type="text"
          placeholder="你的昵称"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          className="w-full px-4 py-3 rounded bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none"
        />

        <input
          type="text"
          placeholder="房间名称（可选）"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          className="w-full px-4 py-3 rounded bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none"
        />

        <div className="flex justify-center gap-2">
          <span className="text-gray-400">玩家人数:</span>
          {[2, 3, 4].map(num => (
            <button
              key={num}
              onClick={() => setMaxPlayers(num)}
              className={`px-3 py-1 rounded ${maxPlayers === num ? 'bg-blue-600' : 'bg-gray-700'}`}
            >
              {num}人
            </button>
          ))}
        </div>

        <button
          onClick={createRoom}
          disabled={isConnecting || !playerName}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded font-bold transition-colors"
        >
          {isConnecting ? '创建中...' : '创建房间'}
        </button>

        <div className="text-center text-gray-500">或</div>

        <button
          onClick={() => navigate('/join')}
          className="w-full py-3 bg-gray-800 hover:bg-gray-700 rounded font-bold transition-colors"
        >
          加入房间
        </button>
      </div>

      <div className="mt-8 text-sm text-gray-500">
        2-4人在线对战 · 隐藏身份 · 像素风格
      </div>
    </div>
  );
}
