/**
 * Feature tests for the chat layer driven by a fake realtime Channel — no
 * network. Covers messages (send/echo/edit), typing (throttle + receiver
 * expiry), reactions (isSelf), presence membership, and presence-derived
 * occupancy.
 */

import type { Channel, MessageFrame, PresenceEventFrame, Realtime } from '@foony/realtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Messages } from './messages.js';
import { Rooms } from './rooms.js';
import { Occupancy } from './occupancy.js';
import { Presence } from './presence.js';
import { Reactions } from './reactions.js';
import { Typing } from './typing.js';

/** Minimal fake presence facade matching the bits the chat layer uses. */
class FakePresence {
  readonly entered: unknown[] = [];
  private readonly subs = new Set<(frame: PresenceEventFrame) => void>();
  async enter(data?: unknown): Promise<void> {
    this.entered.push(data);
  }
  async update(): Promise<void> {}
  async leave(): Promise<void> {}
  subscribe(listener: (frame: PresenceEventFrame) => void): () => void {
    this.subs.add(listener);
    return () => this.subs.delete(listener);
  }
  emit(frame: PresenceEventFrame): void {
    for (const listener of [...this.subs]) {
      listener(frame);
    }
  }
}

/** Minimal fake Channel: records publishes, echoes them back, lets tests inject frames. */
class FakeChannel {
  readonly published: { name: string; data: unknown; ttlMs?: number }[] = [];
  readonly presence = new FakePresence();
  echo = true;
  clientId = 'me';
  private seq = 0;
  private readonly subs = new Map<string, Set<(frame: MessageFrame) => void>>();

  async publish(name: string, data: unknown, options?: { ttlMs?: number }): Promise<void> {
    this.published.push({ name, data, ...(options?.ttlMs === undefined ? {} : { ttlMs: options.ttlMs }) });
    if (this.echo) {
      this.deliver(name, data, this.clientId);
    }
  }

  deliver(name: string, data: unknown, clientId: string): void {
    this.seq += 1;
    const frame: MessageFrame = { t: 'msg', channel: 'chat:room', name, data, messageId: `tx-${this.seq}`, timestamp: this.seq, clientId };
    for (const listener of [...(this.subs.get(name) ?? [])]) {
      listener(frame);
    }
  }

  subscribe(name: string, listener: (frame: MessageFrame) => void): () => void {
    let set = this.subs.get(name);
    if (!set) {
      set = new Set();
      this.subs.set(name, set);
    }
    set.add(listener);
    return () => set!.delete(listener);
  }

  // Stubs so a Room can be constructed around the fake channel.
  readonly state = 'attached';
  on(): () => void {
    return () => {};
  }
  async attach(): Promise<void> {}
  async detach(): Promise<void> {}
}

/** Build a presence frame for the fake presence facade. */
function presenceFrame(action: 'enter' | 'update' | 'leave', clientId: string, connectionId: string): PresenceEventFrame {
  return { t: 'presEvt', channel: 'chat:room', action, clientId, connectionId, timestamp: 1 };
}

function fakeChannel(): { channel: Channel; fake: FakeChannel } {
  const fake = new FakeChannel();
  return { channel: fake as unknown as Channel, fake };
}

describe('Messages', () => {
  it('send publishes a create and returns a stable id; the echo is reconciled', async () => {
    const { channel, fake } = fakeChannel();
    const messages = new Messages(channel, 'room', () => 'me');
    const events: string[] = [];
    messages.subscribe((event) => events.push(`${event.type}:${event.message.text}`));

    const sent = await messages.send({ text: 'hello' });
    expect(sent.id).toMatch(/^\d+-[0-9a-f]+$/);
    expect(fake.published[0]).toMatchObject({ name: 'chat.message', data: { action: 'create', id: sent.id, text: 'hello' } });
    // Retention comes from the channel's namespace rule, not a per-message TTL.
    expect(fake.published[0]?.ttlMs).toBeUndefined();
    expect(events).toContain('created:hello');
  });

  it('edit and delete reference the original id', async () => {
    const { channel, fake } = fakeChannel();
    const messages = new Messages(channel, 'room', () => 'me');
    const sent = await messages.send({ text: 'hi' });
    await messages.update(sent.id, { text: 'edited' });
    await messages.delete(sent.id);
    expect(fake.published.map((publish) => publish.data)).toMatchObject([
      { action: 'create', id: sent.id },
      { action: 'update', id: sent.id, text: 'edited' },
      { action: 'delete', id: sent.id },
    ]);
  });
});

describe('Rooms encryption', () => {
  it('forwards the room cipher to the underlying channel', () => {
    const calls: { name: string; options: unknown }[] = [];
    const realtime = {
      channels: {
        get: (name: string, options?: unknown) => {
          calls.push({ name, options });
          return fakeChannel().channel;
        },
        release: () => {},
      },
    } as unknown as Realtime;

    const key = 'A'.repeat(44); // base64-ish placeholder; Rooms just forwards it
    new Rooms(realtime, () => 'me').get('general', { cipher: { key } });

    expect(calls[0]).toMatchObject({ name: 'chat:general', options: { cipher: { key } } });
  });
});

describe('Reactions', () => {
  it('marks the local client reactions as self', async () => {
    const { channel, fake } = fakeChannel();
    fake.clientId = 'me';
    const reactions = new Reactions(channel, () => 'me');
    const seen: { name: string; isSelf: boolean }[] = [];
    reactions.subscribe((reaction) => seen.push({ name: reaction.name, isSelf: reaction.isSelf }));
    await reactions.send({ name: '🎉' });
    expect(seen).toEqual([{ name: '🎉', isSelf: true }]);
  });
});

describe('Presence and Occupancy', () => {
  it('tracks members and derives occupancy counts', () => {
    const { channel, fake } = fakeChannel();
    const presence = new Presence(channel);
    const occupancy = new Occupancy(presence);
    presence.subscribe(() => {});

    fake.presence.emit(presenceFrame('enter', 'alice', 'c1'));
    fake.presence.emit(presenceFrame('enter', 'alice', 'c2')); // same user, 2nd device
    fake.presence.emit(presenceFrame('enter', 'bob', 'c3'));
    expect(occupancy.get()).toEqual({ connections: 3, presenceMembers: 2 });
    expect(presence.isUserPresent('bob')).toBe(true);

    fake.presence.emit(presenceFrame('leave', 'bob', 'c3'));
    expect(occupancy.get()).toEqual({ connections: 2, presenceMembers: 1 });
    expect(presence.isUserPresent('bob')).toBe(false);
  });
});

describe('Typing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('throttles repeated keystrokes to one heartbeat per window', async () => {
    vi.setSystemTime(0);
    const { channel, fake } = fakeChannel();
    fake.echo = false; // don't deliver our own typing back
    const typing = new Typing(channel, () => 'me', 10_000);
    await typing.keystroke();
    await typing.keystroke(); // within window: no-op
    expect(fake.published).toHaveLength(1);
    vi.setSystemTime(10_001);
    await typing.keystroke(); // window elapsed: new heartbeat
    expect(fake.published).toHaveLength(2);
  });

  it('marks a remote typer and auto-expires it after the grace window', () => {
    const { channel, fake } = fakeChannel();
    const typing = new Typing(channel, () => 'me', 10_000);
    const events: string[] = [];
    typing.subscribe((event) => events.push(`${event.change.type}:${event.change.clientId}`));

    fake.deliver('chat.typing', { state: 'started' }, 'alice');
    expect(typing.currentlyTyping.has('alice')).toBe(true);
    expect(events).toEqual(['started:alice']);

    vi.advanceTimersByTime(12_001); // throttle + grace
    expect(typing.currentlyTyping.has('alice')).toBe(false);
    expect(events).toEqual(['started:alice', 'stopped:alice']);
  });

  it('ignores the local client own typing frames', () => {
    const { channel, fake } = fakeChannel();
    const typing = new Typing(channel, () => 'me', 10_000);
    const events: string[] = [];
    typing.subscribe((event) => events.push(event.change.clientId));
    fake.deliver('chat.typing', { state: 'started' }, 'me');
    expect(events).toEqual([]);
    expect(typing.currentlyTyping.size).toBe(0);
  });
});
