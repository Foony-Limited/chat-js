/**
 * Optional message persistence. A {@link ChatStorage} keeps a per-room snapshot between page
 * loads, so a returning client renders instantly from its own copy and the server replays only
 * what was missed (via the channel's resume cursor) instead of serving history again.
 */

import type { MessageFrame } from '@foony/realtime';

/** Snapshot of one room persisted between sessions. */
export type PersistedRoomState = {
  /** Raw message frames, oldest-first, replayed through the reconciler on load. */
  readonly frames: readonly MessageFrame[];
  /** Newest stored seq, seeded as the resume cursor so the server replays only the gap. */
  readonly serial: number;
  /** True when older messages remained on the server below the stored window when saved. */
  readonly hasMore: boolean;
};

/** Where room snapshots live. Implementations must tolerate concurrent tabs (last write wins). */
export type ChatStorage = {
  /** The stored snapshot for `room`, or null when none exists. */
  load(room: string): Promise<PersistedRoomState | null>;
  /** Overwrite `room`'s snapshot. */
  save(room: string, state: PersistedRoomState): Promise<void>;
  /** Drop `room`'s snapshot (its resume cursor aged out, or the room was released). */
  remove(room: string): Promise<void>;
};

/** Object store holding one record per room inside the IndexedDB database. */
const STORE = 'rooms';

/**
 * A {@link ChatStorage} backed by IndexedDB, or null where IndexedDB does not exist (Node,
 * some webviews) so callers can pass the result straight to `new ChatClient(...)`.
 *
 * @example
 * const chat = new ChatClient(realtime, { storage: indexedDbChatStorage() ?? undefined });
 */
export function indexedDbChatStorage(dbName = 'foony-chat'): ChatStorage | null {
  if (typeof indexedDB === 'undefined') {
    return null;
  }
  const database = openDatabase(dbName);
  return {
    async load(room: string): Promise<PersistedRoomState | null> {
      const db = await database;
      return await requestOf<PersistedRoomState | undefined>(
        db.transaction(STORE, 'readonly').objectStore(STORE).get(room),
      ) ?? null;
    },
    async save(room: string, state: PersistedRoomState): Promise<void> {
      const db = await database;
      await requestOf(db.transaction(STORE, 'readwrite').objectStore(STORE).put(state, room));
    },
    async remove(room: string): Promise<void> {
      const db = await database;
      await requestOf(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(room));
    },
  };
}

/** Open (or create) the database with its single room store. */
function openDatabase(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexedDB open failed'));
  });
}

/** Promisify one IDBRequest. */
function requestOf<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexedDB request failed'));
  });
}
