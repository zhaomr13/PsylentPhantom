import { Server, Socket } from 'socket.io';
import { RoomManager } from '../rooms/manager';
import { GameEngine } from '../game/engine';

const roomManager = new RoomManager();

export function createSocketServer(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    // 房间相关事件
    socket.on('room:create', (data, callback) => {
      try {
        const room = roomManager.createRoom(data.name, data.maxPlayers, socket.id);
        socket.join(room.id);
        callback({ success: true, room });
      } catch (error) {
        callback({ success: false, error: (error as Error).message });
      }
    });

    socket.on('room:join', (data, callback) => {
      try {
        const room = roomManager.joinRoom(data.roomId, socket.id);
        socket.join(room.id);
        socket.to(room.id).emit('room:update', { players: room.players });
        callback({ success: true, room });
      } catch (error) {
        callback({ success: false, error: (error as Error).message });
      }
    });

    socket.on('room:leave', () => {
      const roomId = roomManager.getRoomIdForPlayer(socket.id);
      if (roomId) {
        roomManager.leaveRoom(roomId, socket.id);
        socket.leave(roomId);
        socket.to(roomId).emit('room:update', { players: roomManager.getRoom(roomId)?.players });
      }
    });

    socket.on('game:selectAttributes', (data, callback) => {
      try {
        const roomId = roomManager.getRoomIdForPlayer(socket.id);
        if (!roomId) throw new Error('Not in a room');

        const game = roomManager.getGame(roomId);
        if (!game) throw new Error('Game not started');

        game.selectAttributes(socket.id, data.attributes);

        // 广播状态更新
        broadcastGameState(io, roomId, game);

        callback({ success: true });
      } catch (error) {
        callback({ success: false, error: (error as Error).message });
      }
    });

    socket.on('game:action', (data, callback) => {
      try {
        const roomId = roomManager.getRoomIdForPlayer(socket.id);
        if (!roomId) throw new Error('Not in a room');

        const game = roomManager.getGame(roomId);
        if (!game) throw new Error('Game not started');

        handleGameAction(game, socket.id, data);

        // 广播状态更新
        broadcastGameState(io, roomId, game);

        callback({ success: true });
      } catch (error) {
        callback({ success: false, error: (error as Error).message });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      const roomId = roomManager.getRoomIdForPlayer(socket.id);
      if (roomId) {
        roomManager.handleDisconnect(roomId, socket.id);
        socket.to(roomId).emit('player:disconnected', { playerId: socket.id });
      }
    });
  });
}

function handleGameAction(game: GameEngine, playerId: string, action: any): void {
  switch (action.type) {
    case 'drawSelect':
      game.selectDrawCard(playerId, action.selectedIndex);
      break;
    case 'overload':
      game.overload(playerId, action.enabled);
      break;
    case 'playCard':
      game.playCard(playerId, action.cardId, action.targetId);
      break;
    case 'resonate':
      game.resonate(playerId, action.targetId, action.guess);
      break;
    case 'skip':
      game.skipTurn(playerId);
      break;
    default:
      throw new Error('Unknown action type');
  }
}

function broadcastGameState(io: Server, roomId: string, game: GameEngine): void {
  const state = game.getState();

  // 向每个玩家发送其专属视图
  state.players.forEach(player => {
    const playerView = game.getPlayerView(player.id);
    io.to(player.id).emit('game:state', { state: playerView });
  });
}
