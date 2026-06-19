/**
 * Room registry. Mirrors `Realtime.channels` — `get(name)` returns a stable
 * {@link Room} per name (creating its `chat:<name>` channel on first use), and
 * `release(name)` detaches and drops it.
 */

import type { Realtime } from '@foony/realtime';
import { roomChannelName } from './protocol.js';
import { Room } from './room.js';
import type { RoomOptions } from './types.js';

/** Factory and cache for {@link Room} instances on a {@link ChatClient}. */
export class Rooms {
  private readonly byName = new Map<string, Room>();

  constructor(
    private readonly realtime: Realtime,
    private readonly getClientId: () => string | null,
  ) {}

  /** Get (or create) the room named `name`. Stable instance per name. */
  get(name: string, options?: RoomOptions): Room {
    let existing = this.byName.get(name);
    if (!existing) {
      const channel = this.realtime.channels.get(roomChannelName(name), options?.cipher ? { cipher: options.cipher } : undefined);
      existing = new Room(name, channel, this.getClientId, options);
      this.byName.set(name, existing);
    }
    return existing;
  }

  /** Detach and forget the room named `name`. No-op if not present. */
  release(name: string): void {
    const room = this.byName.get(name);
    if (!room) {
      return;
    }
    this.byName.delete(name);
    room.detach().catch(() => {});
    this.realtime.channels.release(roomChannelName(name));
  }
}
