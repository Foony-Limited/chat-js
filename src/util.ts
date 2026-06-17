/** Small internal helpers shared across chat features. */

/**
 * A sender-assigned, roughly time-sortable message id: `<unixMillis>-<random>`.
 * Mirrors the realtime SDK's transport id format, but the chat id is decoupled
 * from transport — it lives in the payload so `send` can return it immediately
 * and `update`/`delete` can reference it.
 */
export function newMessageId(): string {
  const random = Math.floor(Math.random() * 0x1_0000_0000).toString(16).padStart(8, '0');
  return `${Date.now()}-${random}`;
}
