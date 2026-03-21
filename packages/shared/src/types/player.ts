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
  // 游戏过程中动态添加的字段
  attributesRevealed?: number;  // 已暴露的属性数量（0-2）
  skipNextTurn?: boolean;       // 是否跳过下一回合（共振失败惩罚）
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
  consecutiveTimeouts: number; // 连续超时次数（用于UI警告）
  isReady?: boolean; // 是否已选择属性准备就绪
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
  isReady?: boolean; // 是否已选择属性准备就绪
}
