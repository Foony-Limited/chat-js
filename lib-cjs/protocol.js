"use strict";
/**
 * Internal wire conventions for the chat layer: the reserved `name` values
 * used on the underlying realtime channel and the JSON payload shapes carried
 * in each. Not part of the public API — kept in one place so producers and the
 * reconciler agree.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYLOAD_VERSION = exports.TYPING_EVENT = exports.REACTION_EVENT = exports.MESSAGE_EVENT = void 0;
exports.roomChannelName = roomChannelName;
exports.parseMessagePayload = parseMessagePayload;
exports.parseTypingPayload = parseTypingPayload;
exports.parseReactionPayload = parseReactionPayload;
/** Channel name for a room. The edge grammar forbids `$`, so we namespace with `:`. */
function roomChannelName(roomName) {
    return `chat:${roomName}`;
}
/** Event name carrying message create/update/delete payloads. */
exports.MESSAGE_EVENT = 'chat.message';
/** Event name carrying ephemeral room-level reactions. */
exports.REACTION_EVENT = 'chat.reaction';
/** Event name carrying ephemeral typing heartbeats and stops. */
exports.TYPING_EVENT = 'chat.typing';
/** Payload schema version, bumped if the on-channel shape ever changes. */
exports.PAYLOAD_VERSION = 1;
/** Parse an unknown message payload, returning null if it is malformed or a foreign frame. */
function parseMessagePayload(data) {
    if (typeof data !== 'object' || data === null) {
        return null;
    }
    const payload = data;
    const action = payload['action'];
    const id = payload['id'];
    if (typeof id !== 'string' || id === '') {
        return null;
    }
    if (action === 'delete') {
        return { v: exports.PAYLOAD_VERSION, action, id };
    }
    if ((action === 'create' || action === 'update') && typeof payload['text'] === 'string') {
        const text = payload['text'];
        const metadata = isRecord(payload['metadata']) ? payload['metadata'] : undefined;
        const headers = isRecord(payload['headers']) ? payload['headers'] : undefined;
        return {
            v: exports.PAYLOAD_VERSION,
            action,
            id,
            text,
            ...(metadata === undefined ? {} : { metadata }),
            ...(headers === undefined ? {} : { headers }),
        };
    }
    return null;
}
/** Parse an unknown typing payload, returning null if malformed. */
function parseTypingPayload(data) {
    if (typeof data !== 'object' || data === null) {
        return null;
    }
    const state = data['state'];
    return state === 'started' || state === 'stopped' ? { state } : null;
}
/** Parse an unknown reaction payload, returning null if malformed. */
function parseReactionPayload(data) {
    if (typeof data !== 'object' || data === null) {
        return null;
    }
    const name = data['name'];
    if (typeof name !== 'string' || name === '') {
        return null;
    }
    const metadata = data['metadata'];
    return metadata === undefined ? { name } : { name, metadata };
}
/** True when `value` is a non-null, non-array object. */
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=protocol.js.map