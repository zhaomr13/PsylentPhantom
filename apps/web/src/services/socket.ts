import { io, Socket } from 'socket.io-client';
import { PlayerViewState } from '@psylent/shared';

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3001');
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

export interface ServerEvents {
  'game:state': (data: { state: PlayerViewState }) => void;
  'room:update': (data: { players: any[] }) => void;
  'player:disconnected': (data: { playerId: string }) => void;
  'player:reconnected': (data: { playerId: string; playerName: string }) => void;
  'game:responseWindow': (data: { pendingDamage: number; timeoutMs: number }) => void;
  'game:peek': (data: { targetId: string; attribute: string }) => void;
}

export interface ClientEvents {
  'room:create': (data: { name: string; maxPlayers: number; playerName: string }, callback: (result: any) => void) => void;
  'room:join': (data: { roomId: string; playerName: string }, callback: (result: any) => void) => void;
  'game:selectAttributes': (data: { attributes: [string, string] }, callback: (result: any) => void) => void;
  'game:action': (data: any, callback: (result: any) => void) => void;
}
