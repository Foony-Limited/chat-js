/**
 * Message reconciler: folds a stream of create/update/delete frames into
 * materialized {@link Message} state, keyed by message id. The same reconciler
 * runs over the live subscription and over replayed history, so both paths
 * converge on identical state regardless of delivery order or duplicates.
 *
 * Version ordering uses the transport `(timestamp, messageId)` pair: a later
 * mutation wins, and a re-delivered frame (same messageId) is ignored.
 */

import type { MessageFrame } from '@foony/realtime';
import { parseMessagePayload, type MessagePayload } from './protocol.js';
import type { ChatMessageEvent, Message } from './types.js';

/** Internal per-message bookkeeping. */
type Entry = {
  message: Message;
  /** True once the original `create` has been folded in. */
  createSeen: boolean;
  /** Transport timestamp of the version that set the current text. */
  versionTs: number;
  /** Transport messageId of that version. */
  versionId: string;
  /** Every transport messageId already applied, for idempotent replay. */
  readonly applied: Set<string>;
};

/** Stateful reconciler for a single room's messages. */
export class MessageReconciler {
  private readonly byId = new Map<string, Entry>();

  constructor(private readonly roomName: string) {}

  /**
   * Fold one channel frame into state. Returns the event a subscriber should
   * see, or null when the frame is malformed, a duplicate, or stale.
   */
  apply(frame: MessageFrame): ChatMessageEvent | null {
    const payload = parseMessagePayload(frame.data);
    if (payload === null) {
      return null;
    }
    const timestamp = frame.timestamp;
    const versionId = frame.messageId;
    if (payload.action === 'create') {
      return this.applyCreate(payload, frame.clientId ?? '', timestamp, versionId);
    }
    return this.applyMutation(payload, frame.clientId ?? '', timestamp, versionId);
  }

  /** The current materialized state of one message, if known. */
  get(id: string): Message | undefined {
    return this.byId.get(id)?.message;
  }

  /** Current materialized messages, oldest-first by creation then id. */
  snapshot(): Message[] {
    return [...this.byId.values()]
      .map((entry) => entry.message)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  }

  private applyCreate(payload: Extract<MessagePayload, { action: 'create' }>, clientId: string, timestamp: number, versionId: string): ChatMessageEvent | null {
    const existing = this.byId.get(payload.id);
    if (existing) {
      if (existing.applied.has(versionId)) {
        return null;
      }
      existing.applied.add(versionId);
      // A mutation arrived before its create: backfill author/createdAt, and
      // adopt the create's body only if it is newer than the winning mutation
      // (i.e. no later edit/delete has superseded it).
      const createdAt = new Date(timestamp);
      const adoptBody = isNewer(existing.versionTs, existing.versionId, timestamp, versionId);
      existing.createSeen = true;
      existing.message = {
        ...existing.message,
        clientId,
        createdAt,
        ...(adoptBody
          ? {
              text: payload.text,
              metadata: payload.metadata ?? {},
              headers: payload.headers ?? {},
              updatedAt: createdAt,
              action: 'create',
              deleted: false,
            }
          : {}),
      };
      if (adoptBody) {
        existing.versionTs = timestamp;
        existing.versionId = versionId;
      }
      return { type: 'created', message: existing.message };
    }
    const createdAt = new Date(timestamp);
    const message: Message = {
      id: payload.id,
      clientId,
      roomName: this.roomName,
      text: payload.text,
      metadata: payload.metadata ?? {},
      headers: payload.headers ?? {},
      createdAt,
      updatedAt: createdAt,
      action: 'create',
      deleted: false,
    };
    this.byId.set(payload.id, { message, createSeen: true, versionTs: timestamp, versionId, applied: new Set([versionId]) });
    return { type: 'created', message };
  }

  private applyMutation(payload: Extract<MessagePayload, { action: 'update' | 'delete' }>, clientId: string, timestamp: number, versionId: string): ChatMessageEvent | null {
    let entry = this.byId.get(payload.id);
    if (!entry) {
      // Mutation before create: stand up a placeholder the create can complete.
      const createdAt = new Date(timestamp);
      const placeholder: Message = {
        id: payload.id,
        clientId,
        roomName: this.roomName,
        text: '',
        metadata: {},
        headers: {},
        createdAt,
        updatedAt: createdAt,
        action: 'create',
        deleted: false,
      };
      entry = { message: placeholder, createSeen: false, versionTs: -1, versionId: '', applied: new Set() };
      this.byId.set(payload.id, entry);
    }
    if (entry.applied.has(versionId)) {
      return null;
    }
    entry.applied.add(versionId);
    if (!isNewer(entry.versionTs, entry.versionId, timestamp, versionId)) {
      return null;
    }
    const updatedAt = new Date(timestamp);
    if (payload.action === 'delete') {
      entry.message = { ...entry.message, text: '', metadata: {}, headers: {}, updatedAt, action: 'delete', deleted: true };
      entry.versionTs = timestamp;
      entry.versionId = versionId;
      return { type: 'deleted', message: entry.message };
    }
    entry.message = {
      ...entry.message,
      text: payload.text,
      metadata: payload.metadata ?? {},
      headers: payload.headers ?? {},
      updatedAt,
      action: 'update',
      deleted: false,
    };
    entry.versionTs = timestamp;
    entry.versionId = versionId;
    return { type: 'updated', message: entry.message };
  }
}

/** True when `(ts, id)` is strictly newer than `(priorTs, priorId)`. */
function isNewer(priorTs: number, priorId: string, ts: number, id: string): boolean {
  if (ts !== priorTs) {
    return ts > priorTs;
  }
  return id > priorId;
}
