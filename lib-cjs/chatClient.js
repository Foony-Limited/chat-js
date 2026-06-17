"use strict";
/**
 * ChatClient is the top-level entry point: wrap a connected (or connecting)
 * {@link Realtime} client and use `chat.rooms.get(name)` to start chatting.
 * The chat layer adds no new transport — it rides the existing connection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatClient = void 0;
const rooms_js_1 = require("./rooms.js");
/** Chat client built on top of a {@link Realtime} instance. */
class ChatClient {
    realtime;
    /** Room registry and factory. */
    rooms;
    constructor(realtime) {
        this.realtime = realtime;
        this.rooms = new rooms_js_1.Rooms(realtime, () => this.clientId);
    }
    /** The underlying realtime connection (status, events). */
    get connection() {
        return this.realtime.connection;
    }
    /**
     * The resolved client id for this connection, or null until the auth
     * handshake completes. Used to attribute messages and detect self.
     */
    get clientId() {
        return this.realtime.getClientId();
    }
}
exports.ChatClient = ChatClient;
//# sourceMappingURL=chatClient.js.map