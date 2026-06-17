/** Small internal helpers shared across chat features. */
/**
 * A sender-assigned, roughly time-sortable message id: `<unixMillis>-<random>`.
 * Mirrors the realtime SDK's transport id format, but the chat id is decoupled
 * from transport — it lives in the payload so `send` can return it immediately
 * and `update`/`delete` can reference it.
 */
export declare function newMessageId(): string;
//# sourceMappingURL=util.d.ts.map