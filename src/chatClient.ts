/**
 * ChatClient is the top-level entry point: wrap a connected (or connecting)
 * {@link Realtime} client and use `chat.rooms.get(name)` to start chatting.
 * The chat layer adds no new transport — it rides the existing connection.
 */

import type { Connection, Realtime } from '@foony/realtime';
import { Rooms } from './rooms.js';
import type { ChatStorage } from './storage.js';

/** Client-wide options. */
export type ChatClientOptions = {
  /**
   * Persist each room's recent messages between page loads (see
   * {@link indexedDbChatStorage | `indexedDbChatStorage()`}). A returning client renders from
   * its stored copy and the server replays only what it missed, instead of serving history
   * again on every visit. Omit to keep everything in memory.
   */
  readonly storage?: ChatStorage;
};

/** Chat client built on top of a {@link Realtime} instance. */
export class ChatClient {
  /** Room registry and factory. */
  readonly rooms: Rooms;

  constructor(private readonly realtime: Realtime, options?: ChatClientOptions) {
    this.rooms = new Rooms(realtime, () => this.clientId, options?.storage ?? null);
  }

  /** The underlying realtime connection (status, events). */
  get connection(): Connection {
    return this.realtime.connection;
  }

  /**
   * The resolved client id for this connection, or null until the auth
   * handshake completes. Used to attribute messages and detect self.
   */
  get clientId(): string | null {
    return this.realtime.getClientId();
  }
}
