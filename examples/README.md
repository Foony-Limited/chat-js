# @foony/chat examples

Runnable **client** and **server** examples for the chat SDK, for QA-testing every feature. Only
`@foony/chat` is wired to local `../src` (so you exercise the latest local chat code); its
dependencies `@foony/realtime` and `@foony/global-store` are installed from npm like a real
consumer. For real apps, use the published `@foony/chat` package too.

Both examples authenticate with a **Realtime API key** (`foony.kid_...:sk_...`) and connect to the
prod edge (`wss://realtime.foony.com`).

```
examples/
  client/        React + Vite browser playground (messages, edits, history, presence, typing, reactions, occupancy)
    src/store.ts          @foony/global-store: owns the realtime/chat clients, connection + room state
    src/App.tsx           static shell — reads no store keys, so it never re-renders
    src/ConnectionPanel,
        RoomGate,
        RoomWorkspace.tsx panels that each subscribe (via store.use) to only the slice they need
  server/
    bot.ts       Node chat client: joins a room, subscribes, enters presence, sends heartbeat messages
```

The client follows the Foony global-store pattern: a single `createGlobalStore` holds the realtime
client, chat client, connection state, and joined room. Each panel reads only the keys it needs
with `store.use(key)`, and `App` reads none — so a message arriving (or the connection log growing)
re-renders just the relevant leaf panel, never the whole tree.

## Setup

```bash
cd sdks/chat-js/examples
npm install
```

## Browser playground

```bash
npm run client     # Vite dev server on http://localhost:5181
```

In the UI:

1. **Connection** — set a client id, paste your API key (`foony.kid_...:sk_...`), and *Connect*.
2. **Room** — pick a room name and *Join room* (attaches `chat:<name>`; watch the status badge).
3. **Messages** — send messages, *edit* / *delete* your own, and *Load older* to page back through
   history. Open a second tab (different client id) or run the bot to see two-way flow.
4. **Presence & occupancy** — *Enter presence*; the member list and the `members · conns` counts
   update from the presence stream.
5. **Typing** — type in the box; other members see your typing heartbeat (and it auto-expires).
6. **Reactions** — tap an emoji; reactions stream to all members (self vs. others colour-coded).

> Auth note: these examples use the API key directly, which is fine for trusted contexts. In a real
> browser app you'd keep the key server-side and hand the client a short-lived JWT (the SDK's
> `authCallback` option) — the `key` is shown here only to keep the example self-contained.

## Node bot

A second participant you can run from the terminal:

```bash
REALTIME_KEY="foony.kid_...:sk_..." ROOM=demo npm run bot
```

See the env var docs at the top of `server/bot.ts`.

## Type-checking the examples

```bash
npx tsc -p tsconfig.json          # the Node bot
npx tsc -p client/tsconfig.json   # the browser client
```
