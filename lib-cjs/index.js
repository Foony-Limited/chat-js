"use strict";
/**
 * Public entry point for @foony/chat.
 *
 * A chat layer over @foony/realtime: construct a `ChatClient` from a `Realtime`
 * instance, then `chat.rooms.get(name)` for messages, presence, typing,
 * reactions and occupancy. React bindings are intentionally out of this core
 * package (planned as a separate `@foony/chat/react` subpath).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRandomKey = exports.MessageReconciler = exports.Occupancy = exports.Reactions = exports.Typing = exports.Presence = exports.Messages = exports.Room = exports.Rooms = exports.ChatClient = void 0;
var chatClient_js_1 = require("./chatClient.js");
Object.defineProperty(exports, "ChatClient", { enumerable: true, get: function () { return chatClient_js_1.ChatClient; } });
var rooms_js_1 = require("./rooms.js");
Object.defineProperty(exports, "Rooms", { enumerable: true, get: function () { return rooms_js_1.Rooms; } });
var room_js_1 = require("./room.js");
Object.defineProperty(exports, "Room", { enumerable: true, get: function () { return room_js_1.Room; } });
var messages_js_1 = require("./messages.js");
Object.defineProperty(exports, "Messages", { enumerable: true, get: function () { return messages_js_1.Messages; } });
var presence_js_1 = require("./presence.js");
Object.defineProperty(exports, "Presence", { enumerable: true, get: function () { return presence_js_1.Presence; } });
var typing_js_1 = require("./typing.js");
Object.defineProperty(exports, "Typing", { enumerable: true, get: function () { return typing_js_1.Typing; } });
var reactions_js_1 = require("./reactions.js");
Object.defineProperty(exports, "Reactions", { enumerable: true, get: function () { return reactions_js_1.Reactions; } });
var occupancy_js_1 = require("./occupancy.js");
Object.defineProperty(exports, "Occupancy", { enumerable: true, get: function () { return occupancy_js_1.Occupancy; } });
var reconciler_js_1 = require("./reconciler.js");
Object.defineProperty(exports, "MessageReconciler", { enumerable: true, get: function () { return reconciler_js_1.MessageReconciler; } });
// Re-exported for convenience so chat users can set up room encryption without a
// direct @foony/realtime import.
var realtime_1 = require("@foony/realtime");
Object.defineProperty(exports, "generateRandomKey", { enumerable: true, get: function () { return realtime_1.generateRandomKey; } });
//# sourceMappingURL=index.js.map