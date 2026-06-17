/**
 * Per-room message API: send, edit, delete, subscribe, and history.
 *
 * One {@link MessageReconciler} is shared across every subscriber and the
 * history backfill, so live and replayed frames converge on identical state.
 * Subscribers see only live frames; history is returned as a separate page
 * (the app renders backfill itself, matching Ably's historyBeforeSubscribe).
 */
import { MESSAGE_EVENT, PAYLOAD_VERSION } from './protocol.js';
import { MessageReconciler } from './reconciler.js';
import { newMessageId } from './util.js';
/** The message feature of a {@link Room}. */
export class Messages {
    channel;
    roomName;
    getClientId;
    reconciler;
    listeners = new Set();
    channelUnsubscribe = null;
    constructor(channel, roomName, getClientId) {
        this.channel = channel;
        this.roomName = roomName;
        this.getClientId = getClientId;
        this.reconciler = new MessageReconciler(roomName);
    }
    /** Send a new message. Returns the message optimistically; its `id` is stable. */
    async send(params) {
        const id = newMessageId();
        const payload = {
            v: PAYLOAD_VERSION,
            action: 'create',
            id,
            text: params.text,
            ...(params.metadata === undefined ? {} : { metadata: params.metadata }),
            ...(params.headers === undefined ? {} : { headers: params.headers }),
        };
        await this.channel.publish(MESSAGE_EVENT, payload);
        const now = new Date();
        return {
            id,
            clientId: this.getClientId() ?? '',
            roomName: this.roomName,
            text: params.text,
            metadata: params.metadata ?? {},
            headers: params.headers ?? {},
            createdAt: now,
            updatedAt: now,
            action: 'create',
            deleted: false,
        };
    }
    /** Edit a message by id. Replaces text/metadata/headers (omitted fields clear). */
    async update(id, params) {
        const payload = {
            v: PAYLOAD_VERSION,
            action: 'update',
            id,
            text: params.text,
            ...(params.metadata === undefined ? {} : { metadata: params.metadata }),
            ...(params.headers === undefined ? {} : { headers: params.headers }),
        };
        await this.channel.publish(MESSAGE_EVENT, payload);
    }
    /** Delete a message by id. */
    async delete(id) {
        const payload = { v: PAYLOAD_VERSION, action: 'delete', id };
        await this.channel.publish(MESSAGE_EVENT, payload);
    }
    /**
     * Subscribe to live message changes. The first subscriber attaches the
     * underlying channel subscription; the last to unsubscribe removes it.
     */
    subscribe(listener) {
        this.listeners.add(listener);
        this.ensureChannelSubscription();
        return () => {
            this.listeners.delete(listener);
            if (this.listeners.size === 0 && this.channelUnsubscribe) {
                this.channelUnsubscribe();
                this.channelUnsubscribe = null;
            }
        };
    }
    /**
     * Fetch a page of past messages, oldest-first, materialized through the same
     * reconciler as the live stream. Pass `cursor` (a previous page's
     * `nextCursor`) to page further back.
     */
    async history(params) {
        const { messages: frames, more } = await this.channel.history({
            ...(params?.limit === undefined ? {} : { limit: params.limit }),
            ...(params?.cursor === undefined ? {} : { start: params.cursor }),
        });
        const touched = [];
        for (const frame of frames) {
            if (frame.name !== MESSAGE_EVENT) {
                continue;
            }
            this.reconciler.apply(frame);
            const id = messageIdOf(frame);
            if (id !== null && !touched.includes(id)) {
                touched.push(id);
            }
        }
        const messages = touched
            .map((id) => this.reconciler.get(id))
            .filter((message) => message !== undefined);
        return {
            messages,
            hasMore: more,
            ...(frames.length > 0 && frames[0] ? { nextCursor: frames[0].messageId } : {}),
        };
    }
    /** Lazily attach the single channel subscription that feeds the reconciler. */
    ensureChannelSubscription() {
        if (this.channelUnsubscribe) {
            return;
        }
        this.channelUnsubscribe = this.channel.subscribe(MESSAGE_EVENT, (frame) => {
            const event = this.reconciler.apply(frame);
            if (event === null) {
                return;
            }
            for (const listener of [...this.listeners]) {
                listener(event);
            }
        });
    }
}
/** The chat message id a frame refers to (payload `id`), or null if unparseable. */
function messageIdOf(frame) {
    const data = frame.data;
    if (typeof data !== 'object' || data === null) {
        return null;
    }
    const id = data['id'];
    return typeof id === 'string' && id !== '' ? id : null;
}
//# sourceMappingURL=messages.js.map