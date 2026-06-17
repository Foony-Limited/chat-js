/**
 * ChatClient is the top-level entry point: wrap a connected (or connecting)
 * {@link Realtime} client and use `chat.rooms.get(name)` to start chatting.
 * The chat layer adds no new transport — it rides the existing connection.
 */
import { Rooms } from './rooms.js';
/** Chat client built on top of a {@link Realtime} instance. */
export class ChatClient {
    realtime;
    /** Room registry and factory. */
    rooms;
    constructor(realtime) {
        this.realtime = realtime;
        this.rooms = new Rooms(realtime, () => this.clientId);
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
//# sourceMappingURL=chatClient.js.map