import { Attribute } from '../constants';
import { Card } from './card';
export interface Player {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    hand: Card[];
    deck: Card[];
    discard: Card[];
    attributes: Attribute[];
    energy: number;
    isConnected: boolean;
    consecutiveTimeouts: number;
    attributesRevealed?: number;
    skipNextTurn?: boolean;
}
export interface MyPlayerView {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    hand: Card[];
    handCount: number;
    deckCount: number;
    discard: Card[];
    attributes: Attribute[];
    energy: number;
    isConnected: boolean;
    consecutiveTimeouts: number;
}
export interface OpponentView {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    handCount: number;
    deckCount: number;
    discard: Card[];
    attributes?: Attribute[];
    attributesRevealed: number;
    energy: number;
    isConnected: boolean;
}
