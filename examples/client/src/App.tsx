/**
 * Top-level playground UI. Owns the `Realtime` client + a `ChatClient`, drives the connection
 * lifecycle, and lets you join a room — then renders the room workspace. Authenticates with a raw
 * API key (`key`) against the prod edge (wss://realtime.foony.com).
 */
import {useEffect, useRef, useState} from 'react';
import {Realtime, type ConnectionState} from '@foony/realtime';
import {ChatClient, type Room} from '@foony/chat';
import {RoomWorkspace} from './RoomWorkspace.tsx';
import {Field, StateBadge, useLog, LogView} from './ui.tsx';

export function App() {
  const [apiKey, setApiKey] = useState('');
  const [clientId, setClientId] = useState(() => `web-${Math.random().toString(36).slice(2, 7)}`);
  const [roomName, setRoomName] = useState('demo');

  const [chat, setChat] = useState<ChatClient | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [state, setState] = useState<ConnectionState>('initialized');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [confirmedClientId, setConfirmedClientId] = useState<string | null>(null);
  const clientRef = useRef<Realtime | null>(null);
  const {entries, append, clear} = useLog();

  // Close the socket if the component unmounts while connected.
  useEffect(() => () => void clientRef.current?.close(), []);

  function connect() {
    if (clientRef.current) return;
    // No endpoint configured → the SDK connects to the prod default (wss://realtime.foony.com).
    const realtime = new Realtime({clientId, key: apiKey.trim()});
    realtime.connection.on((next, reason) => {
      setState(next);
      setConnectionId(realtime.getConnectionId());
      setConfirmedClientId(realtime.getClientId());
      append(next === 'failed' || next === 'disconnected' ? 'err' : 'sys', next, reason ? reason.message : '');
    });
    clientRef.current = realtime;
    setChat(new ChatClient(realtime));
    append('sys', 'connect', 'key auth → wss://realtime.foony.com');
    realtime.connect().catch((error) => append('err', 'connect', String(error)));
  }

  async function disconnect() {
    const realtime = clientRef.current;
    if (!realtime) return;
    await realtime.close();
    clientRef.current = null;
    setChat(null);
    setRoom(null);
    setConnectionId(null);
    setConfirmedClientId(null);
    append('sys', 'close', 'connection closed');
  }

  function joinRoom() {
    if (!chat) return;
    const joined = chat.rooms.get(roomName.trim());
    joined.attach().catch((error) => append('err', 'attach', String(error)));
    setRoom(joined);
    append('sys', 'room', `joined ${roomName.trim()} (channel chat:${roomName.trim()})`);
  }

  function leaveRoom() {
    if (!chat || !room) return;
    chat.rooms.release(room.name);
    setRoom(null);
    append('sys', 'room', `left ${room.name}`);
  }

  const isConnecting = state === 'connecting';
  return (
    <div className="app">
      <header className="app-header">
        <h1>@foony/chat playground</h1>
        <p>Join a room and exercise messages, edits, history, presence, typing, reactions, and occupancy.</p>
      </header>

      <section className="panel">
        <div className="spread">
          <h2>Connection</h2>
          <StateBadge state={state} />
        </div>

        <div className="row">
          <Field label="Client id">
            <input value={clientId} onChange={(e) => setClientId(e.target.value)} disabled={!!chat} />
          </Field>
          <Field label="API key (appSlug.publicKeyId:privateKey)">
            <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="foony.kid_...:sk_..." disabled={!!chat} />
          </Field>
        </div>

        <div className="row">
          {chat ? (
            <button className="secondary" onClick={() => void disconnect()}>Disconnect</button>
          ) : (
            <button onClick={connect} disabled={isConnecting || !apiKey.trim()}>Connect</button>
          )}
          <span className="meta mono">connectionId: {connectionId ?? '—'}</span>
          <span className="meta mono">clientId: {confirmedClientId ?? '—'}</span>
          <button className="secondary" onClick={clear}>Clear log</button>
        </div>

        <LogView entries={entries} emptyText="Connection events appear here." />
      </section>

      {chat ? (
        <section className="panel">
          <div className="spread">
            <h2>Room</h2>
            {room ? <span className="badge mono">{room.name}</span> : null}
          </div>
          <div className="row">
            <Field label="Room name">
              <input value={roomName} onChange={(e) => setRoomName(e.target.value)} disabled={!!room} />
            </Field>
            {room ? (
              <button className="secondary" onClick={leaveRoom}>Leave room</button>
            ) : (
              <button onClick={joinRoom} disabled={!roomName.trim()}>Join room</button>
            )}
          </div>
        </section>
      ) : null}

      {room ? <RoomWorkspace key={room.name} room={room} clientId={confirmedClientId ?? clientId} /> : null}
    </div>
  );
}
