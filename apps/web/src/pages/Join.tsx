import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { connectSocket, getSocket } from '../services/socket';
import { useGameStore } from '../stores/game';

export function JoinPage() {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  const { setConnected, setSocketId } = useGameStore();

  useEffect(() => {
    const socket = connectSocket();

    socket.on('connect', () => {
      setConnected(true);
      setSocketId(socket.id || null);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    return () => {
      // Don't disconnect - we need socket for room page
    };
  }, []);

  const joinRoom = () => {
    const socket = getSocket();
    if (!socket) {
      setError('未连接到服务器');
      return;
    }

    if (!playerName.trim()) {
      setError('请输入昵称');
      return;
    }

    if (!roomCode.trim() || roomCode.length !== 4) {
      setError('请输入4位房间号');
      return;
    }

    setIsConnecting(true);
    setError('');

    socket.emit('room:join', { roomId: roomCode.trim(), playerName: playerName.trim() }, (result: any) => {
      setIsConnecting(false);
      if (result.success) {
        sessionStorage.setItem('roomId', roomCode.trim());
        sessionStorage.setItem('playerName', playerName.trim());
        if (result.reconnectToken) sessionStorage.setItem('reconnectToken', result.reconnectToken);
        navigate(`/room/${roomCode.trim()}`);
      } else {
        setError(result.error || '加入房间失败');
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-2 pixel-font text-center">
        加入房间
      </h1>
      <p className="text-gray-400 mb-8">输入房间号和昵称加入游戏</p>

      <div className="w-full max-w-md space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">房间号 (4位数字)</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            placeholder="例如: 1234"
            value={roomCode}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9]/g, '');
              setRoomCode(value);
            }}
            className="w-full px-4 py-3 rounded bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none text-center text-2xl tracking-widest"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">你的昵称</label>
          <input
            type="text"
            placeholder="输入昵称"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full px-4 py-3 rounded bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {error && (
          <div className="text-red-400 text-sm text-center">{error}</div>
        )}

        <button
          onClick={joinRoom}
          disabled={isConnecting}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded font-bold transition-colors"
        >
          {isConnecting ? '加入中...' : '加入房间'}
        </button>

        <button
          onClick={() => navigate('/')}
          className="w-full py-3 bg-gray-800 hover:bg-gray-700 rounded font-bold transition-colors"
        >
          返回首页
        </button>
      </div>
    </div>
  );
}
