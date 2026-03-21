import { Room } from './types';
import { Player, GAME_CONSTANTS } from '@psylent/shared';
import { GameEngine } from '../game/engine';
import { v4 as uuidv4 } from 'uuid';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private playerRoomMap: Map<string, string> = new Map();

  private generateRoomCode(): string {
    // Generate 4-digit code
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  createRoom(name: string, maxPlayers: number, hostId: string): Room {
    const roomCode = this.generateRoomCode();
    const room: Room = {
      id: roomCode,
      name: name || `Room ${roomCode}`,
      maxPlayers: Math.min(maxPlayers || 4, 4),
      players: [],
      status: 'waiting',
      hostId,
      createdAt: new Date(),
    };

    this.rooms.set(room.id, room);
    return room;
  }

  joinRoom(roomId: string, playerId: string): Room {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.status !== 'waiting') {
      throw new Error('Game already in progress');
    }

    if (room.players.length >= room.maxPlayers) {
      throw new Error('Room is full');
    }

    if (room.players.some(p => p.id === playerId)) {
      throw new Error('Already in room');
    }

    const player: Player = {
      id: playerId,
      name: `Player ${room.players.length + 1}`,
      hp: GAME_CONSTANTS.STARTING_HP,
      maxHp: GAME_CONSTANTS.MAX_HP,
      hand: [],
      deck: [],
      discard: [],
      attributes: [],
      energy: GAME_CONSTANTS.RESONATE_COST,
      isConnected: true,
      consecutiveTimeouts: 0,
    };

    room.players.push(player);
    this.playerRoomMap.set(playerId, roomId);

    return room;
  }

  leaveRoom(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== playerId);
    this.playerRoomMap.delete(playerId);

    if (room.players.length === 0) {
      this.rooms.delete(roomId);
    }
  }

  startGame(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    room.status = 'playing';
    room.game = new GameEngine(roomId, room.players);
    room.game.startGame();
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getRoomIdForPlayer(playerId: string): string | undefined {
    return this.playerRoomMap.get(playerId);
  }

  getGame(roomId: string): GameEngine | undefined {
    return this.rooms.get(roomId)?.game;
  }

  handleDisconnect(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.isConnected = false;
    }

    // TODO: 启动断线超时计时器
  }

  getPublicRooms(): Array<{ id: string; name: string; playerCount: number; maxPlayers: number }> {
    return Array.from(this.rooms.values())
      .filter(room => room.status === 'waiting')
      .map(room => ({
        id: room.id,
        name: room.name,
        playerCount: room.players.length,
        maxPlayers: room.maxPlayers,
      }));
  }
}
