/**
 * Internal wire conventions for the chat layer: the reserved `name` values
 * used on the underlying realtime channel and the JSON payload shapes carried
 * in each. Not part of the public API — kept in one place so producers and the
 * reconciler agree.
 */
/** Channel name for a room. The edge grammar forbids `$`, so we namespace with `:`. */
export function roomChannelName(roomName) {
    return `chat:${roomName}`;
}
/** Event name carrying message create/update/delete payloads. */
export const MESSAGE_EVENT = 'chat.message';
/** Event name carrying ephemeral room-level reactions. */
export const REACTION_EVENT = 'chat.reaction';
/** Event name carrying ephemeral typing heartbeats and stops. */
export const TYPING_EVENT = 'chat.typing';
/** Payload schema version, bumped if the on-channel shape ever changes. */
export const PAYLOAD_VERSION = 1;
/** Parse an unknown message payload, returning null if it is malformed or a foreign frame. */
export function parseMessagePayload(data) {
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
        return { v: PAYLOAD_VERSION, action, id };
    }
    if ((action === 'create' || action === 'update') && typeof payload['text'] === 'string') {
        const text = payload['text'];
        const metadata = isRecord(payload['metadata']) ? payload['metadata'] : undefined;
        const headers = isRecord(payload['headers']) ? payload['headers'] : undefined;
        return {
            v: PAYLOAD_VERSION,
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
export function parseTypingPayload(data) {
    if (typeof data !== 'object' || data === null) {
        return null;
    }
    const state = data['state'];
    return state === 'started' || state === 'stopped' ? { state } : null;
}
/** Parse an unknown reaction payload, returning null if malformed. */
export function parseReactionPayload(data) {
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