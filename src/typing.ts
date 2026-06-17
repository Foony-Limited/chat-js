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
import { parseTypingPayload, TYPING_EVENT, type TypingPayload } from './protocol.js';
import type { TypingEvent } from './types.js';

/** Listener invoked whenever the set of typers changes. */
export type TypingListener = (event: TypingEvent) => void;

/** Default heartbeat throttle; must be uniform across clients in a room. */
const DEFAULT_HEARTBEAT_THROTTLE_MS = 10_000;
/** Extra time a receiver waits past the throttle before expiring a typer. */
const GRACE_MS = 2_000;

/** The typing feature of a {@link Room}. */
export class Typing {
  private readonly heartbeatThrottleMs: number;
  private readonly listeners = new Set<TypingListener>();
  /** Active typers (excluding self) → expiry timer. */
  private readonly typers = new Map<string, ReturnType<typeof setTimeout>>();
  /** When the local client last broadcast a heartbeat; -Infinity means "never / send next". */
  private lastSentAt = Number.NEGATIVE_INFINITY;
  private channelUnsubscribe: UnsubscribeFn | null = null;

  constructor(
    private readonly channel: Channel,
    private readonly getClientId: () => string | null,
    heartbeatThrottleMs?: number,
  ) {
    this.heartbeatThrottleMs = heartbeatThrottleMs ?? DEFAULT_HEARTBEAT_THROTTLE_MS;
  }

  /** Signal the local client is typing. Throttled to one heartbeat per window. */
  async keystroke(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSentAt < this.heartbeatThrottleMs) {
      return;
    }
    this.lastSentAt = now;
    const payload: TypingPayload = { state: 'started' };
    await this.channel.publish(TYPING_EVENT, payload);
  }

  /** Signal the local client has stopped typing. */
  async stop(): Promise<void> {
    this.lastSentAt = Number.NEGATIVE_INFINITY;
    const payload: TypingPayload = { state: 'stopped' };
    await this.channel.publish(TYPING_EVENT, payload);
  }

  /** Client ids currently typing (excludes the local client). */
  get currentlyTyping(): ReadonlySet<string> {
    return new Set(this.typers.keys());
  }

  /** Subscribe to typing changes. Attaches the channel on first listener. */
  subscribe(listener: TypingListener): UnsubscribeFn {
    this.listeners.add(listener);
    this.ensureChannelSubscription();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private ensureChannelSubscription(): void {
    if (this.channelUnsubscribe) {
      return;
    }
    this.channelUnsubscribe = this.channel.subscribe(TYPING_EVENT, (frame) => {
      const payload = parseTypingPayload(frame.data);
      const clientId = frame.clientId;
      if (payload === null || clientId === undefined || clientId === this.getClientId()) {
        return;
      }
      if (payload.state === 'started') {
        this.markTyping(clientId);
      } else {
        this.markStopped(clientId);
      }
    });
  }

  private markTyping(clientId: string): void {
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

  private markStopped(clientId: string): void {
    const existing = this.typers.get(clientId);
    if (!existing) {
      return;
    }
    clearTimeout(existing);
    this.typers.delete(clientId);
    this.emit({ type: 'stopped', clientId });
  }

  private emit(change: TypingEvent['change']): void {
    const event: TypingEvent = { currentlyTyping: new Set(this.typers.keys()), change };
    for (const listener of [...this.listeners]) {
      listener(event);
    }
  }
}
