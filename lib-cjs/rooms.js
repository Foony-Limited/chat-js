"use strict";
/**
 * Room registry. Mirrors `Realtime.channels` — `get(name)` returns a stable
 * {@link Room} per name (creating its `chat:<name>` channel on first use), and
 * `release(name)` detaches and drops it.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Rooms = void 0;
const protocol_js_1 = require("./protocol.js");
const room_js_1 = require("./room.js");
/** Factory and cache for {@link Room} instances on a {@link ChatClient}. */
class Rooms {
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
            const channel = this.realtime.channels.get((0, protocol_js_1.roomChannelName)(name));
            existing = new room_js_1.Room(name, channel, this.getClientId, options);
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
        this.realtime.channels.release((0, protocol_js_1.roomChannelName)(name));
    }
}
exports.Rooms = Rooms;
//# sourceMappingURL=rooms.js.map