/**
 * Per-room reactions — ephemeral, fire-and-forget broadcasts (e.g. a floating
 * emoji). Not stored or aggregated; distinct from per-message reactions (which
 * are out of scope for v1). Pure pub/sub over the channel.
 */

import type { Channel, UnsubscribeFn } from '@foony/realtime';
import { parseReactionPayload, REACTION_EVENT, type ReactionPayload } from './protocol.js';
import type { RoomReaction } from './types.js';

/** Listener invoked for every room reaction. */
export type ReactionListener = (reaction: RoomReaction) => void;

/** The room-reaction feature of a {@link Room}. */
export class Reactions {
  private readonly listeners = new Set<ReactionListener>();
  private channelUnsubscribe: UnsubscribeFn | null = null;

  constructor(
    private readonly channel: Channel,
    private readonly getClientId: () => string | null,
  ) {}

  /** Broadcast a room reaction. */
  async send(params: { name: string; metadata?: unknown }): Promise<void> {
    const payload: ReactionPayload = {
      name: params.name,
      ...(params.metadata === undefined ? {} : { metadata: params.metadata }),
    };
    await this.channel.publish(REACTION_EVENT, payload);
  }

  /** Subscribe to room reactions. Attaches the channel on first listener. */
  subscribe(listener: ReactionListener): UnsubscribeFn {
    this.listeners.add(listener);
    this.ensureChannelSubscription();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private ensureChannelSubscription(): void {
    if (this.channelUnsubscribe) {
      return;
    }
    this.channelUnsubscribe = this.channel.subscribe(REACTION_EVENT, (frame) => {
      const payload = parseReactionPayload(frame.data);
      if (payload === null) {
        return;
      }
      const clientId = frame.clientId ?? '';
      const reaction: RoomReaction = {
        name: payload.name,
        clientId,
        ...(payload.metadata === undefined ? {} : { metadata: payload.metadata }),
        createdAt: new Date(frame.timestamp),
        isSelf: clientId !== '' && clientId === this.getClientId(),
      };
      for (const subscriber of [...this.listeners]) {
        subscriber(reaction);
      }
    });
  }
}
