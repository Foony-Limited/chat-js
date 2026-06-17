/**
 * Internal wire conventions for the chat layer: the reserved `name` values
 * used on the underlying realtime channel and the JSON payload shapes carried
 * in each. Not part of the public API — kept in one place so producers and the
 * reconciler agree.
 */
/** Channel name for a room. The edge grammar forbids `$`, so we namespace with `:`. */
export declare function roomChannelName(roomName: string): string;
/** Event name carrying message create/update/delete payloads. */
export declare const MESSAGE_EVENT = "chat.message";
/** Event name carrying ephemeral room-level reactions. */
export declare const REACTION_EVENT = "chat.reaction";
/** Event name carrying ephemeral typing heartbeats and stops. */
export declare const TYPING_EVENT = "chat.typing";
/** Payload schema version, bumped if the on-channel shape ever changes. */
export declare const PAYLOAD_VERSION = 1;
/** Payload published under {@link MESSAGE_EVENT}. `id` is the message id in all actions. */
export type MessagePayload = {
    readonly v: number;
    readonly action: 'create';
    readonly id: string;
    readonly text: string;
    readonly metadata?: Record<string, unknown>;
    readonly headers?: Record<string, unknown>;
} | {
    readonly v: number;
    readonly action: 'update';
    readonly id: string;
    readonly text: string;
    readonly metadata?: Record<string, unknown>;
    readonly headers?: Record<string, unknown>;
} | {
    readonly v: number;
    readonly action: 'delete';
    readonly id: string;
};
/** Payload published under {@link TYPING_EVENT}. */
export type TypingPayload = {
    readonly state: 'started' | 'stopped';
};
/** Payload published under {@link REACTION_EVENT}. */
export type ReactionPayload = {
    readonly name: string;
    readonly metadata?: unknown;
};
/** Parse an unknown message payload, returning null if it is malformed or a foreign frame. */
export declare function parseMessagePayload(data: unknown): MessagePayload | null;
/** Parse an unknown typing payload, returning null if malformed. */
export declare function parseTypingPayload(data: unknown): TypingPayload | null;
/** Parse an unknown reaction payload, returning null if malformed. */
export declare function parseReactionPayload(data: unknown): ReactionPayload | null;
//# sourceMappingURL=protocol.d.ts.map