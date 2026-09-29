# @foony/chat

A chat API — rooms, messages (with edit/delete), typing indicators, room
reactions, presence, occupancy, and history — built on top of
[`@foony/realtime`](../realtime-js). It adds no new transport; it rides the
existing realtime connection and maps each chat feature onto pub/sub event
names on a per-room channel (`chat:<roomName>`).

```ts
import { Realtime } from '@foony/realtime';
import { ChatClient } from '@foony/chat';

const realtime = new Realtime({ authCallback });
const chat = new ChatClient(realtime);

const room = chat.rooms.get('general');
await room.attach();

room.messages.subscribe((event) => {
  // event.type is 'created' | 'updated' | 'deleted'
  console.log(event.message.text);
});

const message = await room.messages.send({ text: 'Hello!' });
await room.messages.update(message.id, { text: 'Hello, world!' });
await room.messages.delete(message.id);

// Backfill recent history (materialized through the same reconciler).
const page = await room.messages.history({ limit: 50 });

// Presence, typing, reactions, occupancy
await room.presence.enter({ name: 'Alice' });
await room.typing.keystroke();
await room.reactions.send({ name: '🎉' });
room.occupancy.subscribe(({ connections, presenceMembers }) => {});
```

## Design notes

- **Messages** are keyed by a stable, sender-assigned `id`, so `update(id, …)`
  and `delete(id, …)` reference a message directly. Edits/deletes are published
  as new frames and reconciled client-side by `id`; the same reconciler runs
  over the live stream and over `history()`, so both converge on identical
  state regardless of delivery order or duplicates.
- **Typing** is ephemeral: a heartbeat is throttled to `heartbeatThrottleMs`
  (default 10s, must be uniform across clients), and receivers auto-expire a
  typer ~2s after the last heartbeat.
- **Occupancy** is derived entirely from the presence set — `presenceMembers`
  counts distinct client ids, `connections` counts distinct
  (clientId, connectionId) pairs. It counts only members who entered presence.
- **React** bindings are intentionally out of this core package and planned as
  a separate `@foony/chat/react` subpath.

## Examples

Runnable browser + Node examples that exercise every feature live against the prod
edge live in [`examples/`](./examples) (`npm run client` for the React playground,
`npm run bot` for a Node participant). See [examples/README.md](./examples/README.md).

## Scripts

- `npm run build` — dual ESM (`lib/`) + CJS (`lib-cjs/`) build.
- `npm test` — vitest unit tests.

## Releases

Update `package.json`, `package-lock.json`, and `CHANGELOG.md`, then push to `main`.
The [publish workflow](.github/workflows/publish.yml) builds and tests the SDK,
then publishes the version if it is not already on npm. Stable versions use the
`latest` tag. Prerelease versions use `next`.

You can retry a failed release with **Run workflow** on GitHub's Actions page.
Publishing uses npm's trusted publisher for this repository and `publish.yml`.
It does not need an npm token in GitHub secrets.

Publish the realtime dependency first. The workflow installs the released version
recorded under `../realtime-js` in `package-lock.json` before building chat.

## License

[Apache-2.0](./LICENSE) © Foony Limited
