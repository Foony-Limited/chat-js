/**
 * Per-room occupancy, derived entirely from the presence set — no edge call.
 *
 * `connections` counts distinct (clientId, connectionId) pairs present (a user
 * on two devices = two connections); `presenceMembers` counts distinct client
 * ids. This reuses presence's TTL-based ghost-leave detection, so counts
 * self-heal after a crash. Limitation: it only counts members who entered
 * presence — always the case in a chat room, where joining enters presence.
 */
import type { UnsubscribeFn } from '@foony/realtime';
import type { Presence } from './presence.js';
import type { Occupancy as OccupancyData } from './types.js';
/** Listener invoked when occupancy counts change. */
export type OccupancyListener = (occupancy: OccupancyData) => void;
/** The occupancy feature of a {@link Room}. */
export declare class Occupancy {
    private readonly presence;
    private readonly listeners;
    private readonly debounceMs;
    private debounceTimer;
    private lastEmitted;
    private membersChangedUnsubscribe;
    constructor(presence: Presence, debounceMs?: number);
    /** Current occupancy snapshot, computed from the local presence member set. */
    get(): OccupancyData;
    /** Subscribe to occupancy changes (debounced, deduplicated). */
    subscribe(listener: OccupancyListener): UnsubscribeFn;
    private scheduleEmit;
}
//# sourceMappingURL=occupancy.d.ts.map