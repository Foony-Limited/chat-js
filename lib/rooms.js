/**
 * Room registry. Mirrors `Realtime.channels` — `get(name)` returns a stable
 * {@link Room} per name (creating its `chat:<name>` channel on first use), and
 * `release(name)` detaches and drops it.
 */
import { roomChannelName } from './protocol.js';
import { Room } from './room.js';
/** Factory and cache for {@link Room} instances on a {@link ChatClient}. */
export class Rooms {
    realtime;
    getClientId;
    byName = new Map();
    constructor(realtime, getClientId) {
        this.realtime = realtime;
        this.getClientId = getClientId;
    }
    /** Get (or create) the room named `name`. Stable instance per name. */
    get(name, options) {
        let existing = this.byName.get(name);
        if (!existing) {
            const channel = this.realtime.channels.get(roomChannelName(name));
            existing = new Room(name, channel, this.getClientId, options);
            this.byName.set(name, existing);
        }
        return existing;
    }
    /** Detach and forget the room named `name`. No-op if not present. */
    release(name) {
        const room = this.byName.get(name);
        if (!room) {
            return;
        }
        this.byName.delete(name);
        room.detach().catch(() => { });
        this.realtime.channels.release(roomChannelName(name));
    }
}
//# sourceMappingURL=rooms.js.map