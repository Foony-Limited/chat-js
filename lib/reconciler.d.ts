/**
 * Message reconciler: folds a stream of create/update/delete frames into
 * materialized {@link Message} state, keyed by message id. The same reconciler
 * runs over the live subscription and over replayed history, so both paths
 * converge on identical state regardless of delivery order or duplicates.
 *
 * Version ordering uses the transport `(timestamp, messageId)` pair: a later
 * mutation wins, and a re-delivered frame (same messageId) is ignored.
 */
import type { MessageFrame } from '@foony/realtime';
import type { ChatMessageEvent, Message } from './types.js';
/** Stateful reconciler for a single room's messages. */
export declare class MessageReconciler {
    private readonly roomName;
    private readonly byId;
    constructor(roomName: string);
    /**
     * Fold one channel frame into state. Returns the event a subscriber should
     * see, or null when the frame is malformed, a duplicate, or stale.
     */
    apply(frame: MessageFrame): ChatMessageEvent | null;
    /** The current materialized state of one message, if known. */
    get(id: string): Message | undefined;
    /** Current materialized messages, oldest-first by creation then id. */
    snapshot(): Message[];
    private applyCreate;
    private applyMutation;
}
//# sourceMappingURL=reconciler.d.ts.map