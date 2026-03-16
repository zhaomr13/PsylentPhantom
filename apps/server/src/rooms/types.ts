import { Player } from '@psylent/shared';
import { GameEngine } from '../game/engine';

export interface Room {
  id: string;
  name: string;
  maxPlayers: number;
  players: Player[];
  status: 'waiting' | 'playing' | 'finished';
  hostId: string;
  game?: GameEngine;
  createdAt: Date;
}
