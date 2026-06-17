"use strict";
/**
 * Per-room typing indicators — ephemeral, pure client-side logic over the
 * channel's pub/sub (no persistence, no edge support needed).
 *
 * Sender: the first `keystroke()` broadcasts `started` immediately; further
 * keystrokes within `heartbeatThrottleMs` are no-ops, and one after the window
 * re-broadcasts. `stop()` broadcasts `stopped`. As long as a client keeps
 * typing it keeps heartbeating; when it stops, receivers expire it.
 *
 * Receiver: tracks who is typing and auto-expires a typer after
 * `heartbeatThrottleMs + GRACE_MS` with no heartbeat, emitting a synthetic
 * `stopped`. The local client is excluded from the typing set.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Typing = void 0;
const protocol_js_1 = require("./protocol.js");
/** Default heartbeat throttle; must be uniform across clients in a room. */
const DEFAULT_HEARTBEAT_THROTTLE_MS = 10_000;
/** Extra time a receiver waits past the throttle before expiring a typer. */
const GRACE_MS = 2_000;
/** The typing feature of a {@link Room}. */
class Typing {
    channel;
    getClientId;
    heartbeatThrottleMs;
    listeners = new Set();
    /** Active typers (excluding self) → expiry timer. */
    typers = new Map();
    /** When the local client last broadcast a heartbeat; -Infinity means "never / send next". */
    lastSentAt = Number.NEGATIVE_INFINITY;
    channelUnsubscribe = null;
    constructor(channel, getClientId, heartbeatThrottleMs) {
        this.channel = channel;
        this.getClientId = getClientId;
        this.heartbeatThrottleMs = heartbeatThrottleMs ?? DEFAULT_HEARTBEAT_THROTTLE_MS;
    }
    /** Signal the local client is typing. Throttled to one heartbeat per window. */
    async keystroke() {
        const now = Date.now();
        if (now - this.lastSentAt < this.heartbeatThrottleMs) {
            return;
        }
        this.lastSentAt = now;
        const payload = { state: 'started' };
        await this.channel.publish(protocol_js_1.TYPING_EVENT, payload);
    }
    /** Signal the local client has stopped typing. */
    async stop() {
        this.lastSentAt = Number.NEGATIVE_INFINITY;
        const payload = { state: 'stopped' };
        await this.channel.publish(protocol_js_1.TYPING_EVENT, payload);
    }
    /** Client ids currently typing (excludes the local client). */
    get currentlyTyping() {
        return new Set(this.typers.keys());
    }
    /** Subscribe to typing changes. Attaches the channel on first listener. */
    subscribe(listener) {
        this.listeners.add(listener);
        this.ensureChannelSubscription();
        return () => {
            this.listeners.delete(listener);
        };
    }
    ensureChannelSubscription() {
        if (this.channelUnsubscribe) {
            return;
        }
        this.channelUnsubscribe = this.channel.subscribe(protocol_js_1.TYPING_EVENT, (frame) => {
            const payload = (0, protocol_js_1.parseTypingPayload)(frame.data);
            const clientId = frame.clientId;
            if (payload === null || clientId === undefined || clientId === this.getClientId()) {
                return;
            }
            if (payload.state === 'started') {
                this.markTyping(clientId);
            }
            else {
                this.markStopped(clientId);
            }
        });
    }
    markTyping(clientId) {
        const existing = this.typers.get(clientId);
        if (existing) {
            clearTimeout(existing);
        }
        const timer = setTimeout(() => this.markStopped(clientId), this.heartbeatThrottleMs + GRACE_MS);
        this.typers.set(clientId, timer);
        if (!existing) {
            this.emit({ type: 'started', clientId });
        }
    }
    markStopped(clientId) {
        const existing = this.typers.get(clientId);
        if (!existing) {
            return;
        }
        clearTimeout(existing);
        this.typers.delete(clientId);
        this.emit({ type: 'stopped', clientId });
    }
    emit(change) {
        const event = { currentlyTyping: new Set(this.typers.keys()), change };
        for (const listener of [...this.listeners]) {
            listener(event);
        }
    }
}
exports.Typing = Typing;
//# sourceMappingURL=typing.js.map