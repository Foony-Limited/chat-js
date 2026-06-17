"use strict";
/**
 * Message reconciler: folds a stream of create/update/delete frames into
 * materialized {@link Message} state, keyed by message id. The same reconciler
 * runs over the live subscription and over replayed history, so both paths
 * converge on identical state regardless of delivery order or duplicates.
 *
 * Version ordering uses the transport `(timestamp, messageId)` pair: a later
 * mutation wins, and a re-delivered frame (same messageId) is ignored.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageReconciler = void 0;
const protocol_js_1 = require("./protocol.js");
/** Stateful reconciler for a single room's messages. */
class MessageReconciler {
    roomName;
    byId = new Map();
    constructor(roomName) {
        this.roomName = roomName;
    }
    /**
     * Fold one channel frame into state. Returns the event a subscriber should
     * see, or null when the frame is malformed, a duplicate, or stale.
     */
    apply(frame) {
        const payload = (0, protocol_js_1.parseMessagePayload)(frame.data);
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
    get(id) {
        return this.byId.get(id)?.message;
    }
    /** Current materialized messages, oldest-first by creation then id. */
    snapshot() {
        return [...this.byId.values()]
            .map((entry) => entry.message)
            .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
    }
    applyCreate(payload, clientId, timestamp, versionId) {
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
        const message = {
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
    applyMutation(payload, clientId, timestamp, versionId) {
        let entry = this.byId.get(payload.id);
        if (!entry) {
            // Mutation before create: stand up a placeholder the create can complete.
            const createdAt = new Date(timestamp);
            const placeholder = {
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
exports.MessageReconciler = MessageReconciler;
/** True when `(ts, id)` is strictly newer than `(priorTs, priorId)`. */
function isNewer(priorTs, priorId, ts, id) {
    if (ts !== priorTs) {
        return ts > priorTs;
    }
    return id > priorId;
}
//# sourceMappingURL=reconciler.js.map