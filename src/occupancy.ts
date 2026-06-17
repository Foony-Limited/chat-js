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

/** Default debounce for occupancy change events. */
const DEFAULT_DEBOUNCE_MS = 1_000;

/** The occupancy feature of a {@link Room}. */
export class Occupancy {
  private readonly listeners = new Set<OccupancyListener>();
  private readonly debounceMs: number;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastEmitted: OccupancyData | null = null;
  private membersChangedUnsubscribe: UnsubscribeFn | null = null;

  constructor(
    private readonly presence: Presence,
    debounceMs?: number,
  ) {
    this.debounceMs = debounceMs ?? DEFAULT_DEBOUNCE_MS;
  }

  /** Current occupancy snapshot, computed from the local presence member set. */
  get(): OccupancyData {
    const members = this.presence.get();
    const clientIds = new Set(members.map((member) => member.clientId));
    return { connections: members.length, presenceMembers: clientIds.size };
  }

  /** Subscribe to occupancy changes (debounced, deduplicated). */
  subscribe(listener: OccupancyListener): UnsubscribeFn {
    this.listeners.add(listener);
    if (!this.membersChangedUnsubscribe) {
      this.membersChangedUnsubscribe = this.presence.onMembersChanged(() => this.scheduleEmit());
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && this.membersChangedUnsubscribe) {
        this.membersChangedUnsubscribe();
        this.membersChangedUnsubscribe = null;
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
          this.debounceTimer = null;
        }
      }
    };
  }

  private scheduleEmit(): void {
    if (this.debounceTimer) {
      return;
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      const current = this.get();
      if (this.lastEmitted && this.lastEmitted.connections === current.connections && this.lastEmitted.presenceMembers === current.presenceMembers) {
        return;
      }
      this.lastEmitted = current;
      for (const listener of [...this.listeners]) {
        listener(current);
      }
    }, this.debounceMs);
  }
}
