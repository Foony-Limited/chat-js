/**
 * The per-room workspace: one panel per chat feature, wired to a joined `Room`. Demonstrates the
 * full surface — messages (send / edit / delete / live subscribe / history backfill), presence,
 * occupancy, typing indicators, and ephemeral room reactions — in the simplest way that still
 * shows the intended usage.
 */
import {useEffect, useRef, useState} from 'react';
import type {Message, OccupancyData, PresenceMember, Room, RoomStatus} from '@foony/chat';
import {Field, StateBadge, useLog, LogView, describe} from './ui.tsx';

const REACTION_EMOJI = ['👍', '🎉', '❤️', '😂', '🔥'];

export function RoomWorkspace({room, clientId}: {room: Room; clientId: string}) {
  const [status, setStatus] = useState<RoomStatus>(room.status);

  useEffect(() => {
    const offStatus = room.onStatusChange((change) => setStatus(change.current));
    const offGap = room.onDiscontinuity(() => setStatus(room.status));
    return () => {
      offStatus();
      offGap();
    };
  }, [room]);

  return (
    <>
      <section className="panel">
        <div className="spread">
          <h2>Room status</h2>
          <StateBadge state={status} />
        </div>
        <span className="meta">Local client id: <span className="mono">{clientId}</span></span>
      </section>

      <div className="grid">
        <MessagesPanel room={room} clientId={clientId} />
        <div className="col">
          <PresencePanel room={room} clientId={clientId} />
          <TypingPanel room={room} />
          <ReactionsPanel room={room} />
        </div>
      </div>
    </>
  );
}

/** Live message list with send, inline edit, delete, and history backfill. */
function MessagesPanel({room, clientId}: {room: Room; clientId: string}) {
  const [messages, setMessages] = useState<Map<string, Message>>(new Map());
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);

  const merge = (incoming: readonly Message[]) =>
    setMessages((prev) => {
      const next = new Map(prev);
      for (const message of incoming) {
        next.set(message.id, message);
      }
      return next;
    });

  useEffect(() => {
    // Subscribe first so we never miss a live frame, then backfill recent history.
    const off = room.messages.subscribe((event) => merge([event.message]));
    room.messages
      .history({limit: 30})
      .then((page) => {
        merge(page.messages);
        setHasMore(page.hasMore);
        setCursor(page.nextCursor);
      })
      .catch(() => {});
    return off;
  }, [room]);

  async function loadOlder() {
    const page = await room.messages.history({limit: 30, ...(cursor === undefined ? {} : {cursor})});
    merge(page.messages);
    setHasMore(page.hasMore);
    if (page.nextCursor !== undefined) {
      setCursor(page.nextCursor);
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    await room.messages.send({text});
  }

  async function saveEdit() {
    if (editingId === null) return;
    const text = editText.trim();
    const id = editingId;
    setEditingId(null);
    setEditText('');
    if (text) {
      await room.messages.update(id, {text});
    }
  }

  const ordered = [...messages.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return (
    <section className="panel">
      <div className="spread">
        <h2>Messages</h2>
        <button className="secondary tiny" onClick={() => void loadOlder()} disabled={!hasMore}>
          {hasMore ? 'Load older' : 'No older'}
        </button>
      </div>

      <div className="messages">
        {ordered.length === 0 ? (
          <div className="log-empty">No messages yet. Send one, or open a second tab.</div>
        ) : (
          ordered.map((message) => (
            <div key={message.id} className={`msg${message.clientId === clientId ? ' self' : ''}${message.deleted ? ' deleted' : ''}`}>
              <div className="msg-head">
                <span className="author">{message.clientId || '?'}</span>
                <span className="when">{message.createdAt.toLocaleTimeString()}</span>
                {message.action === 'update' ? <span className="edited">(edited)</span> : null}
                {message.clientId === clientId && !message.deleted ? (
                  <span className="msg-actions">
                    <button
                      className="secondary tiny"
                      onClick={() => {
                        setEditingId(message.id);
                        setEditText(message.text);
                      }}
                    >
                      edit
                    </button>
                    <button className="secondary tiny" onClick={() => void room.messages.delete(message.id)}>
                      delete
                    </button>
                  </span>
                ) : null}
              </div>
              <div className="msg-text">{message.deleted ? 'message deleted' : message.text}</div>
            </div>
          ))
        )}
      </div>

      {editingId !== null ? (
        <div className="row">
          <input className="grow" value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus />
          <button onClick={() => void saveEdit()}>Save edit</button>
          <button
            className="secondary"
            onClick={() => {
              setEditingId(null);
              setEditText('');
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="row">
          <input
            className="grow"
            value={draft}
            placeholder="Type a message…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void send();
              }
            }}
          />
          <button onClick={() => void send()} disabled={!draft.trim()}>
            Send
          </button>
        </div>
      )}
    </section>
  );
}

/** Presence membership + presence-derived occupancy. */
function PresencePanel({room, clientId}: {room: Room; clientId: string}) {
  const [members, setMembers] = useState<PresenceMember[]>(() => room.presence.get());
  const [occupancy, setOccupancy] = useState<OccupancyData>(() => room.occupancy.get());
  const [present, setPresent] = useState(false);

  useEffect(() => {
    const offPresence = room.presence.subscribe(() => setMembers(room.presence.get()));
    const offOccupancy = room.occupancy.subscribe(setOccupancy);
    return () => {
      offPresence();
      offOccupancy();
    };
  }, [room]);

  async function enter() {
    await room.presence.enter({name: clientId});
    setPresent(true);
  }
  async function leave() {
    await room.presence.leave();
    setPresent(false);
  }

  return (
    <section className="panel">
      <div className="spread">
        <h2>Presence &amp; occupancy</h2>
        <span className="badge mono">
          {occupancy.presenceMembers} members · {occupancy.connections} conns
        </span>
      </div>
      <div className="row">
        {present ? (
          <button className="secondary" onClick={() => void leave()}>Leave presence</button>
        ) : (
          <button onClick={() => void enter()}>Enter presence</button>
        )}
      </div>
      <div className="members">
        {members.length === 0 ? (
          <div className="log-empty">No one is present.</div>
        ) : (
          members.map((member) => (
            <div className="member" key={`${member.clientId} ${member.connectionId}`}>
              <span className="who">{member.clientId}</span>
              <span className="meta mono">{describe(member.data)}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

/** Typing indicator: emit a heartbeat on keystroke, show remote typers. */
function TypingPanel({room}: {room: Room}) {
  const [typers, setTypers] = useState<string[]>([]);
  const [text, setText] = useState('');
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const off = room.typing.subscribe((event) => setTypers([...event.currentlyTyping]));
    return () => {
      off();
      if (stopTimer.current) {
        clearTimeout(stopTimer.current);
      }
    };
  }, [room]);

  function onChange(value: string) {
    setText(value);
    void room.typing.keystroke();
    // Send an explicit stop shortly after the user pauses, so others clear faster
    // than the heartbeat-expiry fallback.
    if (stopTimer.current) {
      clearTimeout(stopTimer.current);
    }
    stopTimer.current = setTimeout(() => void room.typing.stop(), 1500);
  }

  return (
    <section className="panel">
      <h2>Typing</h2>
      <Field label="Type here — others see your heartbeat">
        <input value={text} onChange={(e) => onChange(e.target.value)} placeholder="Start typing…" />
      </Field>
      <div className="typing-line">{typers.length === 0 ? ' ' : `${typers.join(', ')} ${typers.length === 1 ? 'is' : 'are'} typing…`}</div>
    </section>
  );
}

/** Ephemeral room reactions: send an emoji, watch them stream in. */
function ReactionsPanel({room}: {room: Room}) {
  const {entries, append} = useLog();
  const [burst, setBurst] = useState<string>('');

  useEffect(() => {
    const off = room.reactions.subscribe((reaction) => {
      append(reaction.isSelf ? 'out' : 'in', reaction.clientId, reaction.name);
      setBurst(reaction.name);
    });
    return off;
  }, [room]);

  return (
    <section className="panel">
      <div className="spread">
        <h2>Reactions</h2>
        <span className="reaction-burst">{burst}</span>
      </div>
      <div className="reactions-row">
        {REACTION_EMOJI.map((emoji) => (
          <button key={emoji} className="secondary" onClick={() => void room.reactions.send({name: emoji})}>
            {emoji}
          </button>
        ))}
      </div>
      <LogView entries={entries} emptyText="Reactions appear here." />
    </section>
  );
}
