/**
 * Per-room message API: send, edit, delete, subscribe, and history.
 *
 * One {@link MessageReconciler} is shared across every subscriber and the
 * history backfill, so live and replayed frames converge on identical state.
 * Subscribers see only live frames; history is returned as a separate page
 * (the app renders backfill itself, matching Ably's historyBeforeSubscribe).
 */
import type { Channel, UnsubscribeFn } from '@foony/realtime';
import type { ChatMessageEvent, Message, MessagePage, SendMessageParams, UpdateMessageParams } from './types.js';
/** Listener invoked for every materialized message change on the room. */
export type MessageListener = (event: ChatMessageEvent) => void;
/** The message feature of a {@link Room}. */
export declare class Messages {
    private readonly channel;
    private readonly roomName;
    private readonly getClientId;
    private readonly reconciler;
    private readonly listeners;
    private channelUnsubscribe;
    constructor(channel: Channel, roomName: string, getClientId: () => string | null);
    /** Send a new message. Returns the message optimistically; its `id` is stable. */
    send(params: SendMessageParams): Promise<Message>;
    /** Edit a message by id. Replaces text/metadata/headers (omitted fields clear). */
    update(id: string, params: UpdateMessageParams): Promise<void>;
    /** Delete a message by id. */
    delete(id: string): Promise<void>;
    /**
     * Subscribe to live message changes. The first subscriber attaches the
     * underlying channel subscription; the last to unsubscribe removes it.
     */
    subscribe(listener: MessageListener): UnsubscribeFn;
    /**
     * Fetch a page of past messages, oldest-first, materialized through the same
     * reconciler as the live stream. Pass `cursor` (a previous page's
     * `nextCursor`) to page further back.
     */
    history(params?: {
        limit?: number;
        cursor?: string;
    }): Promise<MessagePage>;
    /** Lazily attach the single channel subscription that feeds the reconciler. */
    private ensureChannelSubscription;
}
//# sourceMappingURL=messages.d.ts.map