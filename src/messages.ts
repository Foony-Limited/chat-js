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
import type { ChatMessageEvent, Message, MessagePage, SendMessageParams, UpdateMessageParams } from './types.js';
import { newMessageId } from './util.js';

/** Listener invoked for every materialized message change on the room. */
export type MessageListener = (event: ChatMessageEvent) => void;

/**
 * Retention requested for chat messages: the maximum the platform offers (1
 * year). The edge clamps this down to the app's plan ceiling, so a chat message
 * persists as long as the plan allows — versus typing/reactions, which are left
 * at the short ephemeral default. One year in milliseconds.
 */
const MESSAGE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

/** The message feature of a {@link Room}. */
export class Messages {
  private readonly reconciler: MessageReconciler;
  private readonly listeners = new Set<MessageListener>();
  private channelUnsubscribe: UnsubscribeFn | null = null;

  constructor(
    private readonly channel: Channel,
    private readonly roomName: string,
    private readonly getClientId: () => string | null,
  ) {
    this.reconciler = new MessageReconciler(roomName);
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
    await this.channel.publish(MESSAGE_EVENT, payload, { ttlMs: MESSAGE_TTL_MS });
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
    await this.channel.publish(MESSAGE_EVENT, payload, { ttlMs: MESSAGE_TTL_MS });
  }

  /** Delete a message by id. */
  async delete(id: string): Promise<void> {
    const payload: MessagePayload = { v: PAYLOAD_VERSION, action: 'delete', id };
    await this.channel.publish(MESSAGE_EVENT, payload, { ttlMs: MESSAGE_TTL_MS });
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
  async history(params?: { limit?: number; cursor?: string }): Promise<MessagePage> {
    const { messages: frames, more } = await this.channel.history({
      ...(params?.limit === undefined ? {} : { limit: params.limit }),
      ...(params?.cursor === undefined ? {} : { start: params.cursor }),
    });
    const touched: string[] = [];
    for (const frame of frames) {
      if (frame.name !== MESSAGE_EVENT) {
        continue;
      }
      this.reconciler.apply(frame);
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
      hasMore: more,
      ...(frames.length > 0 && frames[0] ? { nextCursor: frames[0].messageId } : {}),
    };
  }

  /** Lazily attach the single channel subscription that feeds the reconciler. */
  private ensureChannelSubscription(): void {
    if (this.channelUnsubscribe) {
      return;
    }
    this.channelUnsubscribe = this.channel.subscribe(MESSAGE_EVENT, (frame) => {
      const event = this.reconciler.apply(frame);
      if (event === null) {
        return;
      }
      for (const listener of [...this.listeners]) {
        listener(event);
      }
    });
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
