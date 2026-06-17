/**
 * ChatClient is the top-level entry point: wrap a connected (or connecting)
 * {@link Realtime} client and use `chat.rooms.get(name)` to start chatting.
 * The chat layer adds no new transport — it rides the existing connection.
 */

import type { Connection, Realtime } from '@foony/realtime';
import { Rooms } from './rooms.js';

/** Chat client built on top of a {@link Realtime} instance. */
export class ChatClient {
  /** Room registry and factory. */
  readonly rooms: Rooms;

  constructor(private readonly realtime: Realtime) {
    this.rooms = new Rooms(realtime, () => this.clientId);
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
