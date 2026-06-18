/**
 * Connection form + status, subscribed to only the connection slice of the store. Re-renders when
 * the connection state / ids / log change — never because a chat message arrived.
 */
import {clearConnectionLog, connect, disconnect, store} from './store.ts';
import {Field, StateBadge, LogView} from './ui.tsx';

export function ConnectionPanel() {
  const [apiKey, setApiKey] = store.use('apiKey');
  const [clientId, setClientId] = store.use('clientId');
  const [connectionState] = store.use('connectionState');
  const [connectionId] = store.use('connectionId');
  const [confirmedClientId] = store.use('confirmedClientId');
  const [chat] = store.use('chat');
  const [connectionLog] = store.use('connectionLog');

  const isConnecting = connectionState === 'connecting';
  return (
    <section className="panel">
      <div className="spread">
        <h2>Connection</h2>
        <StateBadge state={connectionState} />
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
        <button className="secondary" onClick={clearConnectionLog}>Clear log</button>
      </div>

      <LogView entries={connectionLog} emptyText="Connection events appear here." />
    </section>
  );
}
