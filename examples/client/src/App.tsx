/**
 * Top-level playground shell. Intentionally reads no store keys, so it mounts once and never
 * re-renders — each child panel subscribes to just the store slice it needs. Closes the
 * connection on unmount.
 */
import {useEffect} from 'react';
import {disconnect} from './store.ts';
import {ConnectionPanel} from './ConnectionPanel.tsx';
import {RoomGate} from './RoomGate.tsx';

export function App() {
  useEffect(() => () => void disconnect(), []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>@foony/chat playground</h1>
        <p>Join a room and exercise messages, edits, history, presence, typing, reactions, and occupancy.</p>
      </header>

      <ConnectionPanel />
      <RoomGate />
    </div>
  );
}
