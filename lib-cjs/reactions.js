"use strict";
/**
 * Per-room reactions — ephemeral, fire-and-forget broadcasts (e.g. a floating
 * emoji). Not stored or aggregated; distinct from per-message reactions (which
 * are out of scope for v1). Pure pub/sub over the channel.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Reactions = void 0;
const protocol_js_1 = require("./protocol.js");
/** The room-reaction feature of a {@link Room}. */
class Reactions {
    channel;
    getClientId;
    listeners = new Set();
    channelUnsubscribe = null;
    constructor(channel, getClientId) {
        this.channel = channel;
        this.getClientId = getClientId;
    }
    /** Broadcast a room reaction. */
    async send(params) {
        const payload = {
            name: params.name,
            ...(params.metadata === undefined ? {} : { metadata: params.metadata }),
        };
        await this.channel.publish(protocol_js_1.REACTION_EVENT, payload);
    }
    /** Subscribe to room reactions. Attaches the channel on first listener. */
    subscribe(listener) {
        this.listeners.add(listener);
        this.ensureChannelSubscription();
        return () => {
            this.listeners.delete(listener);
        };
    }
    ensureChannelSubscription() {
        if (this.channelUnsubscribe) {
            return;
        }
        this.channelUnsubscribe = this.channel.subscribe(protocol_js_1.REACTION_EVENT, (frame) => {
            const payload = (0, protocol_js_1.parseReactionPayload)(frame.data);
            if (payload === null) {
                return;
            }
            const clientId = frame.clientId ?? '';
            const reaction = {
                name: payload.name,
                clientId,
                ...(payload.metadata === undefined ? {} : { metadata: payload.metadata }),
                createdAt: new Date(frame.timestamp),
                isSelf: clientId !== '' && clientId === this.getClientId(),
            };
            for (const subscriber of [...this.listeners]) {
                subscriber(reaction);
            }
        });
    }
}
exports.Reactions = Reactions;
//# sourceMappingURL=reactions.js.map