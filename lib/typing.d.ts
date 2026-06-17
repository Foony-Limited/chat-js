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
import type { Channel, UnsubscribeFn } from '@foony/realtime';
import type { TypingEvent } from './types.js';
/** Listener invoked whenever the set of typers changes. */
export type TypingListener = (event: TypingEvent) => void;
/** The typing feature of a {@link Room}. */
export declare class Typing {
    private readonly channel;
    private readonly getClientId;
    private readonly heartbeatThrottleMs;
    private readonly listeners;
    /** Active typers (excluding self) → expiry timer. */
    private readonly typers;
    /** When the local client last broadcast a heartbeat; -Infinity means "never / send next". */
    private lastSentAt;
    private channelUnsubscribe;
    constructor(channel: Channel, getClientId: () => string | null, heartbeatThrottleMs?: number);
    /** Signal the local client is typing. Throttled to one heartbeat per window. */
    keystroke(): Promise<void>;
    /** Signal the local client has stopped typing. */
    stop(): Promise<void>;
    /** Client ids currently typing (excludes the local client). */
    get currentlyTyping(): ReadonlySet<string>;
    /** Subscribe to typing changes. Attaches the channel on first listener. */
    subscribe(listener: TypingListener): UnsubscribeFn;
    private ensureChannelSubscription;
    private markTyping;
    private markStopped;
    private emit;
}
//# sourceMappingURL=typing.d.ts.map