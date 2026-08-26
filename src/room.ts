/**
 * A chat room: one realtime channel (`chat:<name>`) carrying messages,
 * presence, typing, reactions and occupancy. Lifecycle (`attach`/`detach`/
 * status) delegates to the underlying channel rather than duplicating a state
 * machine.
 */

import type { Channel, ChannelStateChange, UnsubscribeFn } from '@foony/realtime';
import type { ChatStorage } from './storage.js';
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
export class Room {
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

  private readonly discontinuityListeners = new Set<DiscontinuityListener>();
  private hadBeenAttached = false;

  constructor(
    /** Room name (without the `chat:` channel prefix). */
    readonly name: string,
    private readonly channel: Channel,
    getClientId: () => string | null,
    options?: RoomOptions,
    storage: ChatStorage | null = null,
  ) {
    this.messages = new Messages(channel, name, getClientId, storage);
    this.presence = new Presence(channel);
    this.typing = new Typing(channel, getClientId, options?.typing?.heartbeatThrottleMs);
    this.reactions = new Reactions(channel, getClientId);
    this.occupancy = new Occupancy(this.presence, options?.occupancy?.debounceMs);
    channel.on((change) => this.onChannelState(change));
  }

  /** Current room status. */
  get status(): RoomStatus {
    return this.channel.state;
  }

  /** Ensure the room is attached so messages and presence flow. */
  async attach(): Promise<void> {
    await this.channel.attach();
  }

  /** Detach from the room (stop receiving). Listeners are preserved. */
  async detach(): Promise<void> {
    await this.channel.detach();
  }

  /** Subscribe to room status changes. Returns an unsubscribe function. */
  onStatusChange(listener: (change: ChannelStateChange) => void): UnsubscribeFn {
    return this.channel.on(listener);
  }

  /**
   * Subscribe to continuity gaps — best-effort: fires when the room re-attaches
   * without a resume, so the app can backfill via `messages.history()`.
   */
  onDiscontinuity(listener: DiscontinuityListener): UnsubscribeFn {
    this.discontinuityListeners.add(listener);
    return () => {
      this.discontinuityListeners.delete(listener);
    };
  }

  private onChannelState(change: ChannelStateChange): void {
    if (change.current === 'attached') {
      if (this.hadBeenAttached && !change.resumed) {
        for (const listener of [...this.discontinuityListeners]) {
          listener(change.reason);
        }
      }
      this.hadBeenAttached = true;
    } else if (change.current === 'detached') {
      // A deliberate detach/re-attach is not a continuity gap.
      this.hadBeenAttached = false;
    }
  }
}
