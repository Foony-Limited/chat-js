/** Tests for the message reconciler — the core of materializing chat state. */

import type { MessageFrame } from '@foony/realtime';
import { describe, expect, it } from 'vitest';
import { PAYLOAD_VERSION, type MessagePayload } from './protocol.js';
import { MessageReconciler } from './reconciler.js';

/** Build a chat.message frame carrying `payload`, with a transport version id/timestamp. */
function frame(payload: MessagePayload, opts: { messageId: string; timestamp: number; clientId?: string }): MessageFrame {
  return {
    t: 'msg',
    channel: 'chat:room',
    name: 'chat.message',
    data: payload,
    timestamp: opts.timestamp,
    messageId: opts.messageId,
    ...(opts.clientId === undefined ? {} : { clientId: opts.clientId }),
  };
}

function create(id: string, text: string): MessagePayload {
  return { v: PAYLOAD_VERSION, action: 'create', id, text };
}
function update(id: string, text: string): MessagePayload {
  return { v: PAYLOAD_VERSION, action: 'update', id, text };
}
function del(id: string): MessagePayload {
  return { v: PAYLOAD_VERSION, action: 'delete', id };
}

describe('MessageReconciler', () => {
  it('materializes a created message', () => {
    const reconciler = new MessageReconciler('room');
    const event = reconciler.apply(frame(create('a', 'hi'), { messageId: 'tx-1', timestamp: 100, clientId: 'alice' }));
    expect(event).toMatchObject({ type: 'created', message: { id: 'a', text: 'hi', clientId: 'alice', deleted: false, action: 'create' } });
    expect(event?.message.createdAt.getTime()).toBe(100);
  });

  it('applies an edit, replacing text and advancing updatedAt', () => {
    const reconciler = new MessageReconciler('room');
    reconciler.apply(frame(create('a', 'hi'), { messageId: 'tx-1', timestamp: 100 }));
    const event = reconciler.apply(frame(update('a', 'edited'), { messageId: 'tx-2', timestamp: 200 }));
    expect(event).toMatchObject({ type: 'updated', message: { id: 'a', text: 'edited', action: 'update', deleted: false } });
    expect(event?.message.createdAt.getTime()).toBe(100);
    expect(event?.message.updatedAt.getTime()).toBe(200);
  });

  it('applies a delete, blanking the body', () => {
    const reconciler = new MessageReconciler('room');
    reconciler.apply(frame(create('a', 'hi'), { messageId: 'tx-1', timestamp: 100 }));
    const event = reconciler.apply(frame(del('a'), { messageId: 'tx-2', timestamp: 200 }));
    expect(event).toMatchObject({ type: 'deleted', message: { id: 'a', text: '', deleted: true, action: 'delete' } });
  });

  it('ignores a duplicate frame (same transport id)', () => {
    const reconciler = new MessageReconciler('room');
    reconciler.apply(frame(create('a', 'hi'), { messageId: 'tx-1', timestamp: 100 }));
    const dup = reconciler.apply(frame(create('a', 'hi'), { messageId: 'tx-1', timestamp: 100 }));
    expect(dup).toBeNull();
  });

  it('ignores a stale edit older than the current version', () => {
    const reconciler = new MessageReconciler('room');
    reconciler.apply(frame(create('a', 'hi'), { messageId: 'tx-1', timestamp: 100 }));
    reconciler.apply(frame(update('a', 'newer'), { messageId: 'tx-3', timestamp: 300 }));
    const stale = reconciler.apply(frame(update('a', 'older'), { messageId: 'tx-2', timestamp: 200 }));
    expect(stale).toBeNull();
    expect(reconciler.get('a')?.text).toBe('newer');
  });

  it('handles an edit arriving before its create (out of order)', () => {
    const reconciler = new MessageReconciler('room');
    const updateEvent = reconciler.apply(frame(update('a', 'edited'), { messageId: 'tx-2', timestamp: 200, clientId: 'alice' }));
    expect(updateEvent).toMatchObject({ type: 'updated', message: { id: 'a', text: 'edited' } });
    // The create is older, so it backfills author/createdAt without clobbering the newer text.
    const createEvent = reconciler.apply(frame(create('a', 'original'), { messageId: 'tx-1', timestamp: 100, clientId: 'alice' }));
    expect(createEvent?.type).toBe('created');
    const message = reconciler.get('a');
    expect(message?.text).toBe('edited');
    expect(message?.clientId).toBe('alice');
    expect(message?.createdAt.getTime()).toBe(100);
  });

  it('snapshots messages oldest-first', () => {
    const reconciler = new MessageReconciler('room');
    reconciler.apply(frame(create('b', 'second'), { messageId: 'tx-2', timestamp: 200 }));
    reconciler.apply(frame(create('a', 'first'), { messageId: 'tx-1', timestamp: 100 }));
    expect(reconciler.snapshot().map((message) => message.id)).toEqual(['a', 'b']);
  });

  it('ignores malformed/foreign payloads', () => {
    const reconciler = new MessageReconciler('room');
    expect(reconciler.apply({ t: 'msg', channel: 'chat:room', name: 'chat.message', data: { junk: true }, timestamp: 1, messageId: 'x' })).toBeNull();
  });
});
