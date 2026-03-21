import { create } from 'zustand';
import { PlayerViewState, Attribute } from '@psylent/shared';

interface GameState {
  isConnected: boolean;
  socketId: string | null;
  currentRoomId: string | null;
  roomName: string;
  players: Array<{ id: string; name: string; isConnected: boolean }>;
  gameState: PlayerViewState | null;
  selectedAttributes: Attribute[];
  setConnected: (connected: boolean) => void;
  setSocketId: (id: string | null) => void;
  setCurrentRoom: (roomId: string | null, name?: string) => void;
  setPlayers: (players: any[]) => void;
  setGameState: (state: PlayerViewState | null) => void;
  setSelectedAttributes: (attrs: Attribute[]) => void;
  reset: () => void;
}

const initialState = {
  isConnected: false,
  socketId: null,
  currentRoomId: null,
  roomName: '',
  players: [],
  gameState: null,
  selectedAttributes: [],
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,
  setConnected: (connected) => set({ isConnected: connected }),
  setSocketId: (id) => set({ socketId: id }),
  setCurrentRoom: (roomId, name) => set({ currentRoomId: roomId, roomName: name || '' }),
  setPlayers: (players) => set({ players }),
  setGameState: (state) => set({ gameState: state }),
  setSelectedAttributes: (attrs) => set({ selectedAttributes: attrs }),
  reset: () => set(initialState),
}));
