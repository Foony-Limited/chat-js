/**
 * Server-side SDK example: a chat "bot" that joins a room, subscribes to messages, enters
 * presence, and sends a heartbeat message on an interval. Run it as a second participant while you
 * drive the browser client — you'll see its messages and reactions arrive in the UI, and the
 * client's messages logged here.
 *
 * Demonstrates @foony/chat used from Node with API key auth (the standard way a trusted server
 * connects). Connects to the prod edge (wss://realtime.foony.com).
 *
 * Run: `REALTIME_KEY="foony.kid_...:sk_..." npm run bot` (from the examples/ directory).
 * Env:
 *   REALTIME_KEY   API key in `appSlug.publicKeyId:privateKey` form (required)
 *   CLIENT_ID      This bot's client id (default "bot")
 *   ROOM           Room to join (default "demo")
 *   INTERVAL_MS    Heartbeat send interval (default 5000)
 */
import {Realtime} from '@foony/realtime';
import {ChatClient} from '../../src/index.js';

const apiKey = process.env.REALTIME_KEY;
if (!apiKey) {
  throw new Error('bot: set REALTIME_KEY to a "foony.kid_...:sk_..." API key');
}
const clientId = process.env.CLIENT_ID ?? 'bot';
const roomName = process.env.ROOM ?? 'demo';
const intervalMs = Number(process.env.INTERVAL_MS ?? 5000);

console.log(`[bot] connecting with API key, room=${roomName}`);
const realtime = new Realtime({clientId, key: apiKey});
realtime.connection.on((state, reason) => {
  console.log(`[bot] connection -> ${state}${reason ? ` (${reason.message})` : ''}`);
});

const chat = new ChatClient(realtime);
await realtime.connect();
console.log(`[bot] connected: connectionId=${realtime.getConnectionId()} clientId=${realtime.getClientId()}`);

const room = chat.rooms.get(roomName);

room.messages.subscribe((event) => {
  console.log(`[bot] message ${event.type} from ${event.message.clientId || '?'}: ${event.message.text}`);
});
room.presence.subscribe((event) => {
  console.log(`[bot] presence ${event.type} ${event.member.clientId}`);
});
room.typing.subscribe((event) => {
  if (event.change.type === 'started') {
    console.log(`[bot] ${event.change.clientId} is typing…`);
  }
});

await room.attach();
await room.presence.enter({name: clientId, role: 'bot'});

let count = 1;
const timer = setInterval(() => {
  const text = `heartbeat ${count++} from ${clientId}`;
  room.messages.send({text, metadata: {bot: true}}).catch((error) => console.error('[bot] send failed:', error));
  console.log(`[bot] sent: ${text}`);
}, intervalMs);

// Leave presence and close cleanly so other members see us depart.
async function shutdown() {
  clearInterval(timer);
  console.log('[bot] shutting down...');
  try {
    await room.presence.leave();
  } finally {
    await realtime.close();
    process.exit(0);
  }
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
