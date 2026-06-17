/**
 * Per-room reactions — ephemeral, fire-and-forget broadcasts (e.g. a floating
 * emoji). Not stored or aggregated; distinct from per-message reactions (which
 * are out of scope for v1). Pure pub/sub over the channel.
 */
import type { Channel, UnsubscribeFn } from '@foony/realtime';
import type { RoomReaction } from './types.js';
/** Listener invoked for every room reaction. */
export type ReactionListener = (reaction: RoomReaction) => void;
/** The room-reaction feature of a {@link Room}. */
export declare class Reactions {
    private readonly channel;
    private readonly getClientId;
    private readonly listeners;
    private channelUnsubscribe;
    constructor(channel: Channel, getClientId: () => string | null);
    /** Broadcast a room reaction. */
    send(params: {
        name: string;
        metadata?: unknown;
    }): Promise<void>;
    /** Subscribe to room reactions. Attaches the channel on first listener. */
    subscribe(listener: ReactionListener): UnsubscribeFn;
    private ensureChannelSubscription;
}
//# sourceMappingURL=reactions.d.ts.map