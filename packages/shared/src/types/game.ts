import { MyPlayerView, OpponentView, Player } from './player';

export interface GameLogEntry {
  id: string;
  timestamp: number;
  type: string;
  playerId?: string;
  targetId?: string;
  data: unknown;
}

export interface PublicLogEntry {
  timestamp: number;
  message: string;
}

export type GameStatus = 'waiting' | 'selecting' | 'playing' | 'finished';

export type PhaseType = 'draw' | 'overload' | 'action' | 'resolution' | 'response';

export interface Phase {
  type: PhaseType;
  timeout?: number;
  validActions?: string[];
  deadline: Date;  // required; wall-clock expiry for client countdown timers
}

export interface GameState {
  roomId: string;
  status: GameStatus;
  turn: number;
  currentPlayerId: string;
  players: Player[];
  phase: Phase;
  log: GameLogEntry[];
  winner?: string;
}

export interface PlayerViewState {
  roomId: string;
  status: GameStatus;
  turn: number;
  currentPlayerId: string;
  hostId: string;
  me: MyPlayerView;
  opponents: OpponentView[];
  phase: Phase;
  log: PublicLogEntry[];
  winner?: string;
}
