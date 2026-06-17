"use strict";
/**
 * A chat room: one realtime channel (`chat:<name>`) carrying messages,
 * presence, typing, reactions and occupancy. Lifecycle (`attach`/`detach`/
 * status) delegates to the underlying channel rather than duplicating a state
 * machine.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Room = void 0;
const messages_js_1 = require("./messages.js");
const occupancy_js_1 = require("./occupancy.js");
const presence_js_1 = require("./presence.js");
const reactions_js_1 = require("./reactions.js");
const typing_js_1 = require("./typing.js");
/** A chat room and its features. Obtain via `chatClient.rooms.get(name)`. */
class Room {
    name;
    channel;
    /** Messages: send, edit, delete, subscribe, history. */
    messages;
    /** Presence: enter/update/leave plus a local member snapshot. */
    presence;
    /** Typing indicators. */
    typing;
    /** Ephemeral room-level reactions. */
    reactions;
    /** Occupancy counts derived from presence. */
    occupancy;
    discontinuityListeners = new Set();
    hadBeenAttached = false;
    constructor(
    /** Room name (without the `chat:` channel prefix). */
    name, channel, getClientId, options) {
        this.name = name;
        this.channel = channel;
        this.messages = new messages_js_1.Messages(channel, name, getClientId);
        this.presence = new presence_js_1.Presence(channel);
        this.typing = new typing_js_1.Typing(channel, getClientId, options?.typing?.heartbeatThrottleMs);
        this.reactions = new reactions_js_1.Reactions(channel, getClientId);
        this.occupancy = new occupancy_js_1.Occupancy(this.presence, options?.occupancy?.debounceMs);
        channel.on((change) => this.onChannelState(change));
    }
    /** Current room status. */
    get status() {
        return this.channel.state;
    }
    /** Ensure the room is attached so messages and presence flow. */
    async attach() {
        await this.channel.attach();
    }
    /** Detach from the room (stop receiving). Listeners are preserved. */
    async detach() {
        await this.channel.detach();
    }
    /** Subscribe to room status changes. Returns an unsubscribe function. */
    onStatusChange(listener) {
        return this.channel.on(listener);
    }
    /**
     * Subscribe to continuity gaps — best-effort: fires when the room re-attaches
     * without a resume, so the app can backfill via `messages.history()`.
     */
    onDiscontinuity(listener) {
        this.discontinuityListeners.add(listener);
        return () => {
            this.discontinuityListeners.delete(listener);
        };
    }
    onChannelState(change) {
        if (change.current === 'attached') {
            if (this.hadBeenAttached && !change.resumed) {
                for (const listener of [...this.discontinuityListeners]) {
                    listener(change.reason);
                }
            }
            this.hadBeenAttached = true;
        }
        else if (change.current === 'detached') {
            // A deliberate detach/re-attach is not a continuity gap.
            this.hadBeenAttached = false;
        }
    }
}
exports.Room = Room;
//# sourceMappingURL=room.js.map