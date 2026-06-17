/**
 * Internal wire conventions for the chat layer: the reserved `name` values
 * used on the underlying realtime channel and the JSON payload shapes carried
 * in each. Not part of the public API — kept in one place so producers and the
 * reconciler agree.
 */

/** Channel name for a room. The edge grammar forbids `$`, so we namespace with `:`. */
export function roomChannelName(roomName: string): string {
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

/** Payload published under {@link MESSAGE_EVENT}. `id` is the message id in all actions. */
export type MessagePayload =
  | { readonly v: number; readonly action: 'create'; readonly id: string; readonly text: string; readonly metadata?: Record<string, unknown>; readonly headers?: Record<string, unknown> }
  | { readonly v: number; readonly action: 'update'; readonly id: string; readonly text: string; readonly metadata?: Record<string, unknown>; readonly headers?: Record<string, unknown> }
  | { readonly v: number; readonly action: 'delete'; readonly id: string };

/** Payload published under {@link TYPING_EVENT}. */
export type TypingPayload = { readonly state: 'started' | 'stopped' };

/** Payload published under {@link REACTION_EVENT}. */
export type ReactionPayload = { readonly name: string; readonly metadata?: unknown };

/** Parse an unknown message payload, returning null if it is malformed or a foreign frame. */
export function parseMessagePayload(data: unknown): MessagePayload | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const payload = data as Record<string, unknown>;
  const action = payload['action'];
  const id = payload['id'];
  if (typeof id !== 'string' || id === '') {
    return null;
  }
  if (action === 'delete') {
    return { v: PAYLOAD_VERSION, action, id };
  }
  if ((action === 'create' || action === 'update') && typeof payload['text'] === 'string') {
    const text = payload['text'] as string;
    const metadata = isRecord(payload['metadata']) ? (payload['metadata'] as Record<string, unknown>) : undefined;
    const headers = isRecord(payload['headers']) ? (payload['headers'] as Record<string, unknown>) : undefined;
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
export function parseTypingPayload(data: unknown): TypingPayload | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const state = (data as Record<string, unknown>)['state'];
  return state === 'started' || state === 'stopped' ? { state } : null;
}

/** Parse an unknown reaction payload, returning null if malformed. */
export function parseReactionPayload(data: unknown): ReactionPayload | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const name = (data as Record<string, unknown>)['name'];
  if (typeof name !== 'string' || name === '') {
    return null;
  }
  const metadata = (data as Record<string, unknown>)['metadata'];
  return metadata === undefined ? { name } : { name, metadata };
}

/** True when `value` is a non-null, non-array object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
