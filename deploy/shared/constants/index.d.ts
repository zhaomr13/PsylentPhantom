export declare const GAME_CONSTANTS: {
    readonly MAX_HP: 10;
    readonly STARTING_HP: 10;
    readonly STARTING_HAND_SIZE: 4;
    readonly DECK_SIZE: 32;
    readonly MAX_HAND_SIZE: 8;
    readonly RESONATE_COST: 3;
    readonly OVERLOAD_DAMAGE: 1;
    readonly OVERLOAD_DRAW: 1;
    readonly PHASE_TIMEOUT_DRAW: 30000;
    readonly PHASE_TIMEOUT_OVERLOAD: 15000;
    readonly PHASE_TIMEOUT_ACTION: 60000;
    readonly DISCONNECT_TIMEOUT: 60000;
    readonly RECONNECT_GRACE_PERIOD: 300000;
};
export declare const ATTRIBUTES: readonly ["THUNDER", "HEAT", "PSYCHIC", "FATE", "SPACE", "SPIRIT"];
export type Attribute = typeof ATTRIBUTES[number];
export declare const ATTRIBUTE_COLORS: Record<Attribute, {
    primary: string;
    secondary: string;
}>;
