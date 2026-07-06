/**
 * Public types for the @foony/chat API.
 *
 * Foony-native shapes inspired by Ably Chat: a {@link Message} is keyed by a
 * stable `id` (so edit/delete reference it directly), and presence/typing/
 * reactions/occupancy mirror the concepts without copying Ably's exact names.
 */

import type { CipherParams } from '@foony/realtime';

/** Latest action that produced a message's current state. */
export type MessageAction = 'create' | 'update' | 'delete';

/**
 * A materialized chat message. Edits replace `text`/`metadata`/`headers`;
 * deletes blank them and set {@link Message.deleted}. Reconcile by `id`.
 */
export type Message = {
  /** Stable, sender-assigned message id. Pass it to `update`/`delete`. */
  readonly id: string;
  /** Client id of the author. */
  readonly clientId: string;
  /** Room this message belongs to. */
  readonly roomName: string;
  /** Message body; `''` once the message is deleted. */
  readonly text: string;
  /** Arbitrary application metadata; `{}` once deleted. */
  readonly metadata: Readonly<Record<string, unknown>>;
  /** Arbitrary application headers; `{}` once deleted. */
  readonly headers: Readonly<Record<string, unknown>>;
  /** When the message was created (server publish time). */
  readonly createdAt: Date;
  /** When the message last changed; equals `createdAt` until edited or deleted. */
  readonly updatedAt: Date;
  /** The latest applied action. */
  readonly action: MessageAction;
  /** True once a delete has been applied. */
  readonly deleted: boolean;
};

/** Event delivered to message subscribers as the room's history materializes. */
export type ChatMessageEvent =
  | { readonly type: 'created'; readonly message: Message }
  | { readonly type: 'updated'; readonly message: Message }
  | { readonly type: 'deleted'; readonly message: Message };

/** Fields a caller may set when sending a new message. */
export type SendMessageParams = {
  /** Message body. */
  readonly text: string;
  /** Optional application metadata. */
  readonly metadata?: Record<string, unknown>;
  /** Optional application headers. */
  readonly headers?: Record<string, unknown>;
};

/** Fields a caller may change when editing a message. Omitted fields are cleared. */
export type UpdateMessageParams = {
  /** New message body. */
  readonly text: string;
  /** Replacement metadata (defaults to `{}`). */
  readonly metadata?: Record<string, unknown>;
  /** Replacement headers (defaults to `{}`). */
  readonly headers?: Record<string, unknown>;
};

/** A page of materialized messages returned by `messages.history`. */
export type MessagePage = {
  /** Messages in the page, oldest-first. */
  readonly messages: readonly Message[];
  /** True when older messages remain beyond this page. */
  readonly hasMore: boolean;
  /** Cursor (the page's oldest message serial) to pass back for the next page. */
  readonly nextCursor?: number;
};

/** A single presence member in a room. */
export type PresenceMember = {
  /** Member's client id. */
  readonly clientId: string;
  /** Member's connection id (a user on two devices appears as two members). */
  readonly connectionId: string;
  /** Presence payload supplied on enter/update, if any. */
  readonly data?: unknown;
  /** When this member's presence last changed. */
  readonly updatedAt: Date;
};

/** Normalized presence transition delivered to presence subscribers. */
export type PresenceEvent = {
  /** Which transition occurred. */
  readonly type: 'enter' | 'update' | 'leave';
  /** The member the transition is about. */
  readonly member: PresenceMember;
};

/** Snapshot of who is currently typing in a room (excludes the local client). */
export type TypingEvent = {
  /** Client ids currently typing. */
  readonly currentlyTyping: ReadonlySet<string>;
  /** The change that produced this event. */
  readonly change: { readonly type: 'started' | 'stopped'; readonly clientId: string };
};

/** An ephemeral, room-level reaction (fire-and-forget; not stored). */
export type RoomReaction = {
  /** Reaction name, e.g. an emoji or short code. */
  readonly name: string;
  /** Client id that sent the reaction. */
  readonly clientId: string;
  /** Optional reaction metadata. */
  readonly metadata?: unknown;
  /** When the reaction was sent (server publish time). */
  readonly createdAt: Date;
  /** True when the local client sent this reaction. */
  readonly isSelf: boolean;
};

/** Room occupancy counts derived from the presence set. */
export type Occupancy = {
  /** Distinct (clientId, connectionId) pairs present — i.e. connections in presence. */
  readonly connections: number;
  /** Distinct client ids present. */
  readonly presenceMembers: number;
};

/** Per-room configuration. */
export type RoomOptions = {
  /**
   * Enable end-to-end encryption for the room. All message, typing, reaction, and
   * presence payloads are encrypted client-side with this key, so the edge only
   * sees ciphertext. Share the key between members out of band (e.g.
   * `generateRandomKey`); never send it to the server.
   */
  readonly cipher?: CipherParams;
  /** Typing config. */
  readonly typing?: {
    /**
     * How often a continuously-typing client re-broadcasts that it is typing,
     * and the basis for receiver-side expiry. Must be uniform across clients
     * in a room. Defaults to 10000ms.
     */
    readonly heartbeatThrottleMs?: number;
  };
  /** Occupancy config. */
  readonly occupancy?: {
    /** Debounce window for occupancy change events. Defaults to 1000ms. */
    readonly debounceMs?: number;
  };
};
