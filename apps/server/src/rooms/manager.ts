import { Room } from './types';
import { Player, GAME_CONSTANTS } from '@psylent/shared';
import { GameEngine } from '../game/engine';
import { v4 as uuidv4 } from 'uuid';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private playerRoomMap: Map<string, string> = new Map();
  private reconnectTokens: Map<string, string> = new Map();   // playerId → token
  private reconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map(); // playerId → timer

  private generateRoomCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  private truncateName(name: string): string {
    return (name || 'Player').slice(0, 20);
  }

  createRoom(name: string, maxPlayers: number, hostId: string, playerName: string): { room: Room; reconnectToken: string } {
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

    // Add host as first player
    const truncated = this.truncateName(playerName);
    const player: Player = {
      id: hostId,
      name: truncated,
      hp: GAME_CONSTANTS.STARTING_HP,
      maxHp: GAME_CONSTANTS.MAX_HP,
      hand: [], deck: [], discard: [], attributes: [],
      energy: GAME_CONSTANTS.RESONATE_COST,
      isConnected: true,
      consecutiveTimeouts: 0,
    };
    room.players.push(player);
    this.playerRoomMap.set(hostId, roomCode);

    const reconnectToken = uuidv4();
    this.reconnectTokens.set(hostId, reconnectToken);

    return { room, reconnectToken };
  }

  joinRoom(roomId: string, playerId: string, playerName: string): { room: Room; reconnectToken: string; wasReconnect: boolean } {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    const truncated = this.truncateName(playerName);

    // Reconnect check FIRST — must work even if game is already in progress
    const disconnected = room.players.find(
      p => !p.isConnected && p.name === truncated
    );
    if (disconnected) {
      return this.reconnectPlayer(room, disconnected, playerId);
    }

    // Only allow fresh joins while room is in 'waiting' state
    if (room.status !== 'waiting') throw new Error('Game already in progress');
    if (room.players.length >= room.maxPlayers) throw new Error('Room is full');

    // Name uniqueness check
    if (room.players.some(p => p.name === truncated)) {
      throw new Error('Name already taken in this room');
    }

    const player: Player = {
      id: playerId,
      name: truncated,
      hp: GAME_CONSTANTS.STARTING_HP,
      maxHp: GAME_CONSTANTS.MAX_HP,
      hand: [], deck: [], discard: [], attributes: [],
      energy: GAME_CONSTANTS.RESONATE_COST,
      isConnected: true,
      consecutiveTimeouts: 0,
    };
    room.players.push(player);
    this.playerRoomMap.set(playerId, roomId);

    const reconnectToken = uuidv4();
    this.reconnectTokens.set(playerId, reconnectToken);

    return { room, reconnectToken, wasReconnect: false };
  }

  private reconnectPlayer(room: Room, player: Player, newSocketId: string): { room: Room; reconnectToken: string; wasReconnect: boolean } {
    const oldId = player.id;

    // Clear reconnect timer
    const timer = this.reconnectTimers.get(oldId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(oldId);
    }

    // Update maps
    this.playerRoomMap.delete(oldId);
    this.playerRoomMap.set(newSocketId, room.id);
    this.reconnectTokens.delete(oldId);

    // Update player state
    player.id = newSocketId;
    player.isConnected = true;
    player.consecutiveTimeouts = 0;

    // Patch responseContext if needed
    room.game?.updatePlayerId(oldId, newSocketId);

    const reconnectToken = uuidv4();
    this.reconnectTokens.set(newSocketId, reconnectToken);

    return { room, reconnectToken, wasReconnect: true };
  }

  handleDisconnect(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === playerId);
    if (!player) return;
    player.isConnected = false;

    // Clear any existing reconnect timer before starting a new one
    const existing = this.reconnectTimers.get(playerId);
    if (existing) {
      clearTimeout(existing);
      this.reconnectTimers.delete(playerId);
    }

    // Start reconnect grace period timer
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(playerId);
      this.leaveRoom(roomId, playerId);
    }, GAME_CONSTANTS.RECONNECT_GRACE_PERIOD);

    this.reconnectTimers.set(playerId, timer);
  }

  leaveRoom(roomId: string, playerId: string): void {
    // Cancel any pending reconnect timer
    const timer = this.reconnectTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(playerId);
    }

    const room = this.rooms.get(roomId);
    if (!room) return;
    room.players = room.players.filter(p => p.id !== playerId);
    this.playerRoomMap.delete(playerId);
    this.reconnectTokens.delete(playerId);
    if (room.players.length === 0) this.rooms.delete(roomId);
  }

  startGame(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');
    room.status = 'playing';
    room.game = new GameEngine(roomId, room.players);
    room.game.startGame();
  }

  getRoom(roomId: string): Room | undefined { return this.rooms.get(roomId); }
  getRoomIdForPlayer(playerId: string): string | undefined { return this.playerRoomMap.get(playerId); }
  getGame(roomId: string): GameEngine | undefined { return this.rooms.get(roomId)?.game; }

  getPublicRooms() {
    return Array.from(this.rooms.values())
      .filter(r => r.status === 'waiting')
      .map(r => ({ id: r.id, name: r.name, playerCount: r.players.length, maxPlayers: r.maxPlayers }));
  }
}
