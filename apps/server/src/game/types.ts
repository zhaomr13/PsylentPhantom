import { Phase, Card } from '@psylent/shared';

export interface ResponseContext {
  attackerId: string;
  defenderId: string;
  pendingDamage: number;
  card: Card;  // full card object, stored until response resolves
}

// ServerPhase extends Phase with server-internal state.
// Not used as the stored phase type (responseContext lives in GameEngine private field),
// but provided for future use and documentation of the intended architecture.
export interface ServerPhase extends Phase {
  responseContext?: ResponseContext;
}
