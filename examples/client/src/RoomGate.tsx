/**
 * Renders the room form once connected, and the room workspace once joined. Subscribes only to
 * `chat`, `room`, `roomName`, and the confirmed client id — so it re-renders on join/leave but not
 * on per-message activity inside the workspace.
 */
import {joinRoom, leaveRoom, store} from './store.ts';
import {RoomWorkspace} from './RoomWorkspace.tsx';
import {Field} from './ui.tsx';

export function RoomGate() {
  const [chat] = store.use('chat');
  const [room] = store.use('room');
  const [roomName, setRoomName] = store.use('roomName');
  const [confirmedClientId] = store.use('confirmedClientId');
  const [clientId] = store.use('clientId');

  if (!chat) {
    return null;
  }

  return (
    <>
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

      {room ? <RoomWorkspace key={room.name} room={room} clientId={confirmedClientId ?? clientId} /> : null}
    </>
  );
}
