/**
 * Persistence tests: a room restored from ChatStorage serves history without touching the
 * server, seeds the channel's resume cursor before the first attach, keeps the store fresh as
 * live frames apply, and recovers when the stored cursor has aged out of retention.
 */

import type { MessageFrame } from '@foony/realtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Messages } from './messages.js';
import { MESSAGE_EVENT, PAYLOAD_VERSION } from './protocol.js';
import type { ChatStorage, PersistedRoomState } from './storage.js';

/** A create-action message frame with the given seq. */
function frame(seq: number, text = `m${seq}`): MessageFrame {
  return {
    t: 'msg',
    channel: 'chat:room',
    name: MESSAGE_EVENT,
    data: { v: PAYLOAD_VERSION, action: 'create', id: `id-${seq}`, text },
    timestamp: seq,
    messageId: `mx-${seq}`,
    clientId: 'alice',
    seq,
  };
}

/** In-memory ChatStorage recording every call. */
class MemoryStorage implements ChatStorage {
  saved = new Map<string, PersistedRoomState>();
  removed: string[] = [];
  constructor(initial?: Record<string, PersistedRoomState>) {
    for (const [room, state] of Object.entries(initial ?? {})) {
      this.saved.set(room, state);
    }
  }
  async load(room: string): Promise<PersistedRoomState | null> {
    return this.saved.get(room) ?? null;
  }
  async save(room: string, state: PersistedRoomState): Promise<void> {
    this.saved.set(room, state);
  }
  async remove(room: string): Promise<void> {
    this.saved.delete(room);
    this.removed.push(room);
  }
}

/** Fake channel recording call order plus queued history pages and state listeners. */
class FakeChannel {
  calls: string[] = [];
  resumedFrom: number[] = [];
  historyCalls: { limit?: number; before?: number }[] = [];
  historyPages: { messages: MessageFrame[]; more: boolean }[] = [];
  private readonly subs = new Map<string, Set<(frame: MessageFrame) => void>>();
  private readonly stateListeners = new Set<(change: unknown) => void>();

  resumeFrom(serial: number): void {
    this.calls.push('resumeFrom');
    this.resumedFrom.push(serial);
  }
  subscribe(name: string, listener: (frame: MessageFrame) => void): () => void {
    this.calls.push('subscribe');
    let set = this.subs.get(name);
    if (!set) {
      set = new Set();
      this.subs.set(name, set);
    }
    set.add(listener);
    return () => set!.delete(listener);
  }
  deliver(messageFrame: MessageFrame): void {
    for (const listener of [...(this.subs.get(messageFrame.name) ?? [])]) {
      listener(messageFrame);
    }
  }
  async history(params?: { limit?: number; before?: number }): Promise<{ messages: MessageFrame[]; more: boolean }> {
    this.historyCalls.push(params ?? {});
    return this.historyPages.shift() ?? { messages: [], more: false };
  }
  on(listener: (change: unknown) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }
  emitState(change: { current: string; previous: string; resumed: boolean }): void {
    for (const listener of [...this.stateListeners]) {
      listener(change);
    }
  }
  async publish(): Promise<void> {}
  readonly state = 'attached';
  async attach(): Promise<void> {}
  async detach(): Promise<void> {}
}

/** Flush pending microtasks so async restore/persist settle. */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

function makeMessages(channel: FakeChannel, storage: ChatStorage) {
  return new Messages(channel as never, 'room', () => 'me', storage);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('chat persistence', () => {
  it('serves history from storage without touching the server and seeds the resume cursor', async () => {
    const storage = new MemoryStorage({ room: { frames: [frame(1), frame(2), frame(3)], serial: 3, hasMore: false } });
    const channel = new FakeChannel();
    const messages = makeMessages(channel, storage);

    const page = await messages.history({ limit: 3 });
    expect(page.messages.map((message) => message.text)).toEqual(['m1', 'm2', 'm3']);
    expect(page.hasMore).toBe(false);
    expect(channel.historyCalls).toHaveLength(0);
    expect(channel.resumedFrom).toEqual([3]);
  });

  it('holds the first channel subscribe until the restore lands, so the seed precedes the attach', async () => {
    const storage = new MemoryStorage({ room: { frames: [frame(1)], serial: 1, hasMore: false } });
    const channel = new FakeChannel();
    const messages = makeMessages(channel, storage);

    messages.subscribe(() => {});
    await settle();
    expect(channel.calls.indexOf('resumeFrom')).toBeGreaterThanOrEqual(0);
    expect(channel.calls.indexOf('resumeFrom')).toBeLessThan(channel.calls.indexOf('subscribe'));
  });

  it('persists live frames as they apply', async () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage({ room: { frames: [frame(1)], serial: 1, hasMore: false } });
    const channel = new FakeChannel();
    const messages = makeMessages(channel, storage);
    messages.subscribe(() => {});
    await settle();

    channel.deliver(frame(2));
    await vi.runAllTimersAsync();
    const saved = storage.saved.get('room');
    expect(saved?.serial).toBe(2);
    expect(saved?.frames.map((stored) => stored.seq)).toEqual([1, 2]);
  });

  it('caps what it persists and marks that older messages remain', async () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage({ room: { frames: [], serial: 0, hasMore: false } });
    const channel = new FakeChannel();
    const messages = makeMessages(channel, storage);
    messages.subscribe(() => {});
    await settle();

    for (let seq = 1; seq <= 305; seq++) {
      channel.deliver(frame(seq));
    }
    await vi.runAllTimersAsync();
    const saved = storage.saved.get('room');
    expect(saved?.frames.length).toBe(300);
    expect(saved?.frames[0]?.seq).toBe(6);
    expect(saved?.hasMore).toBe(true);
  });

  it('falls back to the server when the stored window is smaller than the request', async () => {
    const storage = new MemoryStorage({ room: { frames: [frame(1), frame(2)], serial: 2, hasMore: true } });
    const channel = new FakeChannel();
    channel.historyPages.push({ messages: [frame(1), frame(2), frame(3)], more: false });
    const messages = makeMessages(channel, storage);

    const page = await messages.history({ limit: 50 });
    expect(channel.historyCalls).toHaveLength(1);
    expect(page.messages.length).toBe(3);
  });

  it('clears storage and refetches fresh history when the stored cursor aged out', async () => {
    const storage = new MemoryStorage({ room: { frames: [frame(1)], serial: 1, hasMore: false } });
    const channel = new FakeChannel();
    channel.historyPages.push({ messages: [frame(10)], more: true });
    const messages = makeMessages(channel, storage);
    const received: string[] = [];
    messages.subscribe((event) => received.push(event.message.text));
    await settle();

    channel.emitState({ current: 'attached', previous: 'attaching', resumed: false });
    await settle();
    expect(storage.removed).toContain('room');
    expect(channel.historyCalls).toHaveLength(1);
    expect(received).toContain('m10');
  });
});
