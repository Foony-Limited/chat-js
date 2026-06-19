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
export { Room } from './room.js';
export { Messages } from './messages.js';
export { Presence } from './presence.js';
export { Typing } from './typing.js';
export { Reactions } from './reactions.js';
export { Occupancy } from './occupancy.js';
export { MessageReconciler } from './reconciler.js';
// Re-exported for convenience so chat users can set up room encryption without a
// direct @foony/realtime import.
export { generateRandomKey } from '@foony/realtime';
//# sourceMappingURL=index.js.map