import { v5 as uuidv5 } from 'uuid';

/** Stable UUIDs use existing primary keys to arbitrate concurrent inserts. */
export function promotionRequestId(kind: string, offerId: string, email: string, window = '') {
  return uuidv5(JSON.stringify([kind, offerId, email.trim().toLowerCase(), window]), uuidv5.URL);
}
export const PAID_DEMAND_WINDOW_MS = 24 * 60 * 60 * 1000;
