/**
 * Public entry point for @foony/chat.
 *
 * A chat layer over @foony/realtime: construct a `ChatClient` from a `Realtime`
 * instance, then `chat.rooms.get(name)` for messages, presence, typing,
 * reactions and occupancy. React bindings are intentionally out of this core
 * package (planned as a separate `@foony/chat/react` subpath).
 */

export { ChatClient } from './chatClient.js';
export { Rooms } from './rooms.js';
export { Room, type RoomStatus, type DiscontinuityListener } from './room.js';
export { Messages, type MessageListener } from './messages.js';
export { Presence, type PresenceListener } from './presence.js';
export { Typing, type TypingListener } from './typing.js';
export { Reactions, type ReactionListener } from './reactions.js';
export { Occupancy, type OccupancyListener } from './occupancy.js';
export { MessageReconciler } from './reconciler.js';
// Re-exported for convenience so chat users can set up room encryption without a
// direct @foony/realtime import.
export { generateRandomKey, type CipherParams } from '@foony/realtime';
export type {
  Message,
  MessageAction,
  ChatMessageEvent,
  SendMessageParams,
  UpdateMessageParams,
  MessagePage,
  PresenceMember,
  PresenceEvent,
  TypingEvent,
  RoomReaction,
  Occupancy as OccupancyData,
  RoomOptions,
} from './types.js';
