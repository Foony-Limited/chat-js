/**
 * Global store for the playground, in the Foony `createGlobalStore` style. It owns the realtime
 * client, the chat client, the connection lifecycle, and the joined room, plus the connection
 * event log. Components subscribe to only the keys they read (via `store.use(key)`), so a message
 * arriving — or the connection log growing — never re-renders the whole `App`.
 */
import {createGlobalStore} from '@foony/global-store';
import {Realtime, type ConnectionState} from '@foony/realtime';
import {ChatClient, type Room} from '@foony/chat';
import type {LogEntry} from './ui.tsx';

type PlaygroundState = {
  /** API key typed into the connection form. */
  apiKey: string;
  /** Desired client id typed into the connection form. */
  clientId: string;
  /** Desired room name typed into the room form. */
  roomName: string;
  /** The realtime client, once connecting/connected. */
  realtime: Realtime | null;
  /** The chat client wrapping {@link realtime}. */
  chat: ChatClient | null;
  /** Live connection lifecycle state. */
  connectionState: ConnectionState;
  /** Server-assigned connection id, after auth. */
  connectionId: string | null;
  /** Server-confirmed client id, after auth. */
  confirmedClientId: string | null;
  /** The currently joined room, if any. */
  room: Room | null;
  /** Rolling, capped connection/room event log. */
  connectionLog: readonly LogEntry[];
};

/** The single playground store instance. */
export const store = createGlobalStore<PlaygroundState>({
  apiKey: '',
  clientId: `web-${Math.random().toString(36).slice(2, 7)}`,
  roomName: 'demo',
  realtime: null,
  chat: null,
  connectionState: 'initialized',
  connectionId: null,
  confirmedClientId: null,
  room: null,
  connectionLog: [],
});

const MAX_LOG_ENTRIES = 200;
let nextLogId = 0;

/** Append one line to the connection log, capping its length. */
function log(kind: LogEntry['kind'], tag: string, body: string): void {
  store.set('connectionLog', (previous) => {
    const entry: LogEntry = {id: nextLogId++, time: new Date().toLocaleTimeString(), kind, tag, body};
    const next = [...previous, entry];
    return next.length > MAX_LOG_ENTRIES ? next.slice(next.length - MAX_LOG_ENTRIES) : next;
  });
}

/** Open the realtime connection and create the chat client. Idempotent. */
export function connect(): void {
  if (store.get('realtime')) {
    return;
  }
  // No endpoint configured → the SDK connects to the prod default (wss://realtime.foony.com).
  const realtime = new Realtime({clientId: store.get('clientId'), key: store.get('apiKey').trim()});
  realtime.connection.on((next, reason) => {
    store.update({
      connectionState: next,
      connectionId: realtime.getConnectionId(),
      confirmedClientId: realtime.getClientId(),
    });
    log(next === 'failed' || next === 'disconnected' ? 'err' : 'sys', next, reason ? reason.message : '');
  });
  store.update({realtime, chat: new ChatClient(realtime)});
  log('sys', 'connect', 'key auth → wss://realtime.foony.com');
  realtime.connect().catch((error) => log('err', 'connect', String(error)));
}

/** Close the connection and clear derived state. */
export async function disconnect(): Promise<void> {
  const realtime = store.get('realtime');
  if (!realtime) {
    return;
  }
  await realtime.close();
  store.update({realtime: null, chat: null, room: null, connectionId: null, confirmedClientId: null});
  log('sys', 'close', 'connection closed');
}

/** Join (and attach) the room named by `roomName`. */
export function joinRoom(): void {
  const chat = store.get('chat');
  if (!chat) {
    return;
  }
  const name = store.get('roomName').trim();
  const room = chat.rooms.get(name);
  room.attach().catch((error) => log('err', 'attach', String(error)));
  store.set('room', room);
  log('sys', 'room', `joined ${name} (channel chat:${name})`);
}

/** Leave and release the current room. */
export function leaveRoom(): void {
  const chat = store.get('chat');
  const room = store.get('room');
  if (!chat || !room) {
    return;
  }
  chat.rooms.release(room.name);
  store.set('room', null);
  log('sys', 'room', `left ${room.name}`);
}

/** Clear the connection log. */
export function clearConnectionLog(): void {
  store.set('connectionLog', []);
}
