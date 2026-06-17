/**
 * A chat room: one realtime channel (`chat:<name>`) carrying messages,
 * presence, typing, reactions and occupancy. Lifecycle (`attach`/`detach`/
 * status) delegates to the underlying channel rather than duplicating a state
 * machine.
 */
import type { Channel, ChannelStateChange, UnsubscribeFn } from '@foony/realtime';
import { Messages } from './messages.js';
import { Occupancy } from './occupancy.js';
import { Presence } from './presence.js';
import { Reactions } from './reactions.js';
import { Typing } from './typing.js';
import type { RoomOptions } from './types.js';
/** Room lifecycle status — the underlying channel's state. */
export type RoomStatus = Channel['state'];
/** Listener invoked when a continuity gap is detected on (re)attach. */
export type DiscontinuityListener = (reason?: Error) => void;
/** A chat room and its features. Obtain via `chatClient.rooms.get(name)`. */
export declare class Room {
    /** Room name (without the `chat:` channel prefix). */
    readonly name: string;
    private readonly channel;
    /** Messages: send, edit, delete, subscribe, history. */
    readonly messages: Messages;
    /** Presence: enter/update/leave plus a local member snapshot. */
    readonly presence: Presence;
    /** Typing indicators. */
    readonly typing: Typing;
    /** Ephemeral room-level reactions. */
    readonly reactions: Reactions;
    /** Occupancy counts derived from presence. */
    readonly occupancy: Occupancy;
    private readonly discontinuityListeners;
    private hadBeenAttached;
    constructor(
    /** Room name (without the `chat:` channel prefix). */
    name: string, channel: Channel, getClientId: () => string | null, options?: RoomOptions);
    /** Current room status. */
    get status(): RoomStatus;
    /** Ensure the room is attached so messages and presence flow. */
    attach(): Promise<void>;
    /** Detach from the room (stop receiving). Listeners are preserved. */
    detach(): Promise<void>;
    /** Subscribe to room status changes. Returns an unsubscribe function. */
    onStatusChange(listener: (change: ChannelStateChange) => void): UnsubscribeFn;
    /**
     * Subscribe to continuity gaps — best-effort: fires when the room re-attaches
     * without a resume, so the app can backfill via `messages.history()`.
     */
    onDiscontinuity(listener: DiscontinuityListener): UnsubscribeFn;
    private onChannelState;
}
//# sourceMappingURL=room.d.ts.map