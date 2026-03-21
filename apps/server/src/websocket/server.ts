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
        const existingRoom = roomManager.getRoom(data.roomId);
        const isAlreadyInRoom = existingRoom?.players.some(p => p.id === socket.id);

        let room;
        if (isAlreadyInRoom) {
          room = existingRoom!;
          socket.join(room.id);
        } else {
          room = roomManager.joinRoom(data.roomId, socket.id);
          socket.join(room.id);
          io.to(room.id).emit('room:update', { players: room.players, maxPlayers: room.maxPlayers });
        }
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
        const room = roomManager.getRoom(roomId);
        if (room) {
          io.to(roomId).emit('room:update', { players: room.players, maxPlayers: room.maxPlayers });
        }
      }
    });

    socket.on('room:startGame', () => {
      try {
        const roomId = roomManager.getRoomIdForPlayer(socket.id);
        if (!roomId) throw new Error('Not in a room');

        const room = roomManager.getRoom(roomId);
        if (!room) throw new Error('Room not found');
        if (room.players[0]?.id !== socket.id) throw new Error('Only host can start game');
        if (room.players.length < 2) throw new Error('Need at least 2 players');

        roomManager.startGame(roomId);

        // Broadcast game start to all players
        const game = roomManager.getGame(roomId);
        if (game) {
          broadcastGameState(io, roomId, game);
        }
      } catch (error) {
        console.error('[Server] Start game error:', error);
        socket.emit('error', { message: (error as Error).message });
      }
    });

    socket.on('room:startGamePlay', (data, callback) => {
      try {
        const roomId = roomManager.getRoomIdForPlayer(socket.id);
        if (!roomId) throw new Error('Not in a room');

        const room = roomManager.getRoom(roomId);
        if (!room) throw new Error('Room not found');
        if (room.players[0]?.id !== socket.id) throw new Error('Only host can start game');

        const game = roomManager.getGame(roomId);
        if (!game) throw new Error('Game not started');

        if (!game.canStartGame()) {
          throw new Error('Not all players are ready');
        }

        game.startGamePlay();

        // Broadcast updated state
        broadcastGameState(io, roomId, game);

        callback?.({ success: true });
      } catch (error) {
        console.error('[Server] Start game play error:', error);
        callback?.({ success: false, error: (error as Error).message });
      }
    });

    socket.on('game:selectAttributes', (data, callback) => {
      try {
        const roomId = roomManager.getRoomIdForPlayer(socket.id);
        if (!roomId) throw new Error('Not in a room');

        const game = roomManager.getGame(roomId);
        if (!game) throw new Error('Game not started');

        console.log('[Server] selectAttributes - before:', game.getReadyPlayers());
        game.selectAttributes(socket.id, data.attributes);
        console.log('[Server] selectAttributes - after:', game.getReadyPlayers());

        // 广播状态更新
        broadcastGameState(io, roomId, game);

        callback({ success: true });
      } catch (error) {
        console.error('[Server] selectAttributes error:', error);
        callback({ success: false, error: (error as Error).message });
      }
    });

    socket.on('game:getState', (data, callback) => {
      try {
        const roomId = roomManager.getRoomIdForPlayer(socket.id);
        if (!roomId) throw new Error('Not in a room');

        const game = roomManager.getGame(roomId);
        if (!game) throw new Error('Game not started');

        const readyPlayers = new Set(game.getReadyPlayers());
        console.log('[Server] getState - readyPlayers:', Array.from(readyPlayers), 'socket:', socket.id);
        const playerView = game.getPlayerView(socket.id, readyPlayers);
        console.log('[Server] getState - me.isReady:', playerView.me?.isReady);
        callback({ success: true, state: playerView });
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

        const result = handleGameAction(game, socket.id, data);

        // 广播状态更新
        broadcastGameState(io, roomId, game);

        callback?.({ success: true, result });
      } catch (error) {
        callback?.({ success: false, error: (error as Error).message });
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

function handleGameAction(game: GameEngine, playerId: string, action: any): any {
  switch (action.type) {
    case 'startDraw':
      return game.startDrawPhase(playerId);
    case 'drawSelect':
      game.selectDrawCard(playerId, action.selectedIndex);
      break;
    case 'overload':
      console.log('[Server] overload action:', playerId, action.enabled);
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
  const readyPlayers = new Set(game.getReadyPlayers());

  // 向每个玩家发送其专属视图
  state.players.forEach(player => {
    const playerView = game.getPlayerView(player.id, readyPlayers);
    io.to(player.id).emit('game:state', { state: playerView });
  });

  // Also broadcast to room for anyone else listening
  io.to(roomId).emit('game:state', { state: { status: state.status } });
}
