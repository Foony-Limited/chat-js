/**
 * Room registry. Mirrors `Realtime.channels` — `get(name)` returns a stable
 * {@link Room} per name (creating its `chat:<name>` channel on first use), and
 * `release(name)` detaches and drops it.
 */
import type { Realtime } from '@foony/realtime';
import { Room } from './room.js';
import type { RoomOptions } from './types.js';
/** Factory and cache for {@link Room} instances on a {@link ChatClient}. */
export declare class Rooms {
    private readonly realtime;
    private readonly getClientId;
    private readonly byName;
    constructor(realtime: Realtime, getClientId: () => string | null);
    /** Get (or create) the room named `name`. Stable instance per name. */
    get(name: string, options?: RoomOptions): Room;
    /** Detach and forget the room named `name`. No-op if not present. */
    release(name: string): void;
}
//# sourceMappingURL=rooms.d.ts.map