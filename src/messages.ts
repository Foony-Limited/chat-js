/**
 * Per-room message API: send, edit, delete, subscribe, and history.
 *
 * One {@link MessageReconciler} is shared across every subscriber and the
 * history backfill, so live and replayed frames converge on identical state.
 * Subscribers see only live frames; history is returned as a separate page
 * (the app renders backfill itself, matching Ably's historyBeforeSubscribe).
 */

import type { Channel, MessageFrame, UnsubscribeFn } from '@foony/realtime';
import { MESSAGE_EVENT, PAYLOAD_VERSION, type MessagePayload } from './protocol.js';
import { MessageReconciler } from './reconciler.js';
import type { ChatStorage } from './storage.js';
import type { ChatMessageEvent, Message, MessagePage, SendMessageParams, UpdateMessageParams } from './types.js';
import { newMessageId } from './util.js';

/** Listener invoked for every materialized message change on the room. */
export type MessageListener = (event: ChatMessageEvent) => void;

/**
 * How many stored frames a room keeps. Matches a deep scrollback page: anything older is
 * re-fetchable through `history()` and not worth the disk.
 */
const PERSIST_MAX_FRAMES = 300;

/** Delay between an applied frame and the storage write, so bursts save once. */
const PERSIST_DEBOUNCE_MS = 300;

/** Page size fetched when a stored resume cursor has aged out of retention. */
const RECOVER_PAGE_LIMIT = 100;

/** Default history page size, matching the server's default. */
const DEFAULT_HISTORY_LIMIT = 100;

/** The message feature of a {@link Room}. */
export class Messages {
  private readonly reconciler: MessageReconciler;
  private readonly listeners = new Set<MessageListener>();
  private channelUnsubscribe: UnsubscribeFn | null = null;

  /** Resolves once the stored snapshot (if any) has been replayed and the resume cursor seeded. */
  private readonly ready: Promise<void>;
  /** Frames worth persisting (those with a seq), oldest-first after each normalize. */
  private frameLog: MessageFrame[] = [];
  /** True when older messages remain on the server below the stored window. */
  private storedHasMore = false;
  /** The seeded resume serial, until the first attach reports whether it held. */
  private seededSerial = 0;
  private channelStateOff: UnsubscribeFn | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSubscribe = false;

  constructor(
    private readonly channel: Channel,
    private readonly roomName: string,
    private readonly getClientId: () => string | null,
    private readonly storage: ChatStorage | null = null,
  ) {
    this.reconciler = new MessageReconciler(roomName);
    this.ready = this.storage ? this.restore() : Promise.resolve();
  }

  /**
   * Replay the stored snapshot into the reconciler and seed the channel's resume cursor, so the
   * first attach replays only the gap. Runs before the first channel subscribe (see
   * `ensureChannelSubscription`), because a seed after attach is a no-op.
   */
  private async restore(): Promise<void> {
    let state = null;
    try {
      state = await this.storage!.load(this.roomName);
    } catch {
      return;
    }
    if (!state || state.frames.length === 0) {
      return;
    }
    for (const frame of state.frames) {
      if (frame.name === MESSAGE_EVENT) {
        this.reconciler.apply(frame);
      }
      if (frame.seq !== undefined && frame.seq > 0) {
        this.frameLog.push(frame);
      }
    }
    this.storedHasMore = state.hasMore;
    if (state.serial > 0) {
      this.seededSerial = state.serial;
      this.channel.resumeFrom(state.serial);
      this.channelStateOff = this.channel.on((change) => this.onChannelState(change));
    }
  }

  /**
   * The seeded cursor is judged by the first attach: `resumed: false` means the serial aged out
   * of retention, so the stored copy may be missing messages and is thrown away.
   */
  private onChannelState(change: { readonly current: string; readonly resumed: boolean }): void {
    if (change.current !== 'attached' || this.seededSerial === 0) {
      return;
    }
    this.seededSerial = 0;
    this.channelStateOff?.();
    this.channelStateOff = null;
    if (!change.resumed) {
      void this.recoverFromLostCursor();
    }
  }

  /**
   * The stored window could not be stitched to the live stream, so drop it and fetch a fresh
   * page, emitting the result to subscribers like live traffic (their render already happened
   * from the stale copy).
   */
  private async recoverFromLostCursor(): Promise<void> {
    try {
      await this.storage!.remove(this.roomName);
    } catch {
      // Best effort: a failed remove leaves a stale copy that the next failed resume retries.
    }
    this.frameLog = [];
    this.storedHasMore = true;
    try {
      const { messages: frames, more } = await this.channel.history({ limit: RECOVER_PAGE_LIMIT });
      this.storedHasMore = more;
      for (const frame of frames) {
        this.addToFrameLog(frame);
        if (frame.name !== MESSAGE_EVENT) {
          continue;
        }
        const event = this.reconciler.apply(frame);
        if (event === null) {
          continue;
        }
        for (const listener of [...this.listeners]) {
          listener(event);
        }
      }
      this.schedulePersist();
    } catch {
      // The room still works live; the next history() call backfills.
    }
  }

  /** Send a new message. Returns the message optimistically; its `id` is stable. */
  async send(params: SendMessageParams): Promise<Message> {
    const id = newMessageId();
    const payload: MessagePayload = {
      v: PAYLOAD_VERSION,
      action: 'create',
      id,
      text: params.text,
      ...(params.metadata === undefined ? {} : { metadata: params.metadata }),
      ...(params.headers === undefined ? {} : { headers: params.headers }),
    };
    await this.channel.publish(MESSAGE_EVENT, payload);
    const now = new Date();
    return {
      id,
      clientId: this.getClientId() ?? '',
      roomName: this.roomName,
      text: params.text,
      metadata: params.metadata ?? {},
      headers: params.headers ?? {},
      createdAt: now,
      updatedAt: now,
      action: 'create',
      deleted: false,
    };
  }

  /** Edit a message by id. Replaces text/metadata/headers (omitted fields clear). */
  async update(id: string, params: UpdateMessageParams): Promise<void> {
    const payload: MessagePayload = {
      v: PAYLOAD_VERSION,
      action: 'update',
      id,
      text: params.text,
      ...(params.metadata === undefined ? {} : { metadata: params.metadata }),
      ...(params.headers === undefined ? {} : { headers: params.headers }),
    };
    await this.channel.publish(MESSAGE_EVENT, payload);
  }

  /** Delete a message by id. */
  async delete(id: string): Promise<void> {
    const payload: MessagePayload = { v: PAYLOAD_VERSION, action: 'delete', id };
    await this.channel.publish(MESSAGE_EVENT, payload);
  }

  /**
   * Subscribe to live message changes. The first subscriber attaches the
   * underlying channel subscription; the last to unsubscribe removes it.
   */
  subscribe(listener: MessageListener): UnsubscribeFn {
    this.listeners.add(listener);
    this.ensureChannelSubscription();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && this.channelUnsubscribe) {
        this.channelUnsubscribe();
        this.channelUnsubscribe = null;
      }
    };
  }

  /**
   * Fetch a page of past messages, oldest-first, materialized through the same
   * reconciler as the live stream. Pass `cursor` (a previous page's
   * `nextCursor`) to page further back.
   */
  async history(params?: { limit?: number; cursor?: number }): Promise<MessagePage> {
    if (this.storage) {
      await this.ready;
      if (params?.cursor === undefined) {
        const stored = this.storedPage(params?.limit ?? DEFAULT_HISTORY_LIMIT);
        if (stored) {
          return stored;
        }
      }
    }
    const { messages: frames, more } = await this.channel.history({
      ...(params?.limit === undefined ? {} : { limit: params.limit }),
      ...(params?.cursor === undefined ? {} : { before: params.cursor }),
    });
    const touched: string[] = [];
    for (const frame of frames) {
      this.addToFrameLog(frame);
      if (frame.name !== MESSAGE_EVENT) {
        continue;
      }
      this.reconciler.apply(frame);
      const id = messageIdOf(frame);
      if (id !== null && !touched.includes(id)) {
        touched.push(id);
      }
    }
    this.schedulePersist();
    const messages = touched
      .map((id) => this.reconciler.get(id))
      .filter((message): message is Message => message !== undefined);
    return {
      messages,
      hasMore: more,
      ...(frames.length > 0 && frames[0]?.seq !== undefined ? { nextCursor: frames[0].seq } : {}),
    };
  }

  /**
   * Build the newest page from the stored window, or null when the window is too small for the
   * request (fewer frames than asked and older messages remain on the server).
   */
  private storedPage(limit: number): MessagePage | null {
    this.normalizeFrameLog();
    if (this.frameLog.length === 0 || (this.frameLog.length < limit && this.storedHasMore)) {
      return null;
    }
    const window = this.frameLog.slice(-limit);
    const touched: string[] = [];
    for (const frame of window) {
      const id = messageIdOf(frame);
      if (id !== null && !touched.includes(id)) {
        touched.push(id);
      }
    }
    const messages = touched
      .map((id) => this.reconciler.get(id))
      .filter((message): message is Message => message !== undefined);
    return {
      messages,
      hasMore: this.storedHasMore || this.frameLog.length > window.length,
      ...(window[0]?.seq === undefined ? {} : { nextCursor: window[0].seq }),
    };
  }

  /** Lazily attach the single channel subscription that feeds the reconciler. */
  private ensureChannelSubscription(): void {
    if (this.channelUnsubscribe || this.pendingSubscribe) {
      return;
    }
    if (!this.storage) {
      this.channelUnsubscribe = this.channel.subscribe(MESSAGE_EVENT, (frame) => this.onLiveFrame(frame));
      return;
    }
    // With storage, the subscribe waits for the restore: the resume seed must be in place
    // before the attach the subscription triggers, or the server backfills nothing.
    this.pendingSubscribe = true;
    void this.ready.then(() => {
      this.pendingSubscribe = false;
      if (this.channelUnsubscribe || this.listeners.size === 0) {
        return;
      }
      this.channelUnsubscribe = this.channel.subscribe(MESSAGE_EVENT, (frame) => this.onLiveFrame(frame));
    });
  }

  /** Apply one live frame, fan it out, and keep the stored window fresh. */
  private onLiveFrame(frame: MessageFrame): void {
    this.addToFrameLog(frame);
    const event = this.reconciler.apply(frame);
    if (event !== null) {
      for (const listener of [...this.listeners]) {
        listener(event);
      }
    }
    this.schedulePersist();
  }

  /** Track a sequenced frame for persistence. No-op without storage. */
  private addToFrameLog(frame: MessageFrame): void {
    if (!this.storage || frame.seq === undefined || frame.seq <= 0) {
      return;
    }
    this.frameLog.push(frame);
    if (this.frameLog.length > PERSIST_MAX_FRAMES * 2) {
      this.normalizeFrameLog();
    }
  }

  /** Sort, dedupe by seq, and trim the frame log to the newest window. */
  private normalizeFrameLog(): void {
    if (this.frameLog.length === 0) {
      return;
    }
    const bySeq = new Map<number, MessageFrame>();
    for (const frame of this.frameLog) {
      bySeq.set(frame.seq!, frame);
    }
    const sorted = [...bySeq.values()].sort((left, right) => left.seq! - right.seq!);
    if (sorted.length > PERSIST_MAX_FRAMES) {
      this.frameLog = sorted.slice(-PERSIST_MAX_FRAMES);
      this.storedHasMore = true;
    } else {
      this.frameLog = sorted;
    }
  }

  /** Save the stored window shortly, coalescing bursts into one write. */
  private schedulePersist(): void {
    if (!this.storage || this.persistTimer !== null) {
      return;
    }
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.normalizeFrameLog();
      if (this.frameLog.length === 0) {
        return;
      }
      const serial = this.frameLog[this.frameLog.length - 1]!.seq!;
      void this.storage!
        .save(this.roomName, { frames: [...this.frameLog], serial, hasMore: this.storedHasMore })
        .catch(() => {
          // Best effort: a lost save costs the next load a server history fetch, nothing more.
        });
    }, PERSIST_DEBOUNCE_MS);
  }
}

/** The chat message id a frame refers to (payload `id`), or null if unparseable. */
function messageIdOf(frame: MessageFrame): string | null {
  const data = frame.data;
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const id = (data as Record<string, unknown>)['id'];
  return typeof id === 'string' && id !== '' ? id : null;
}
