# Changelog

All notable changes to `@foony/chat`. Format loosely follows
[Keep a Changelog](https://keepachangelog.com); versions are semver.

## 0.3.2

### Fixed

- **Scrolling back through history works for messages published as a batch.**
  Before, `history()` stopped after the first page when the oldest message on
  it came from a batch. Needs `@foony/realtime` 0.16.2 or later.
- **The room cache keeps every message of a batch.** A cached room could drop
  all but one message of a batch, and they never came back on the next visit.

## 0.3.1

### Fixed

- Chat continues without its local cache when browser privacy settings block IndexedDB or the cache runs out of space.

## 0.3.0

### Added

- **Rooms can persist between page loads.** Pass a storage to the client and a
  returning visitor renders from their local copy while the server replays only
  what they missed, so `history()` resolves instantly on repeat visits:

  ```js
  const chat = new ChatClient(realtime, {
    storage: indexedDbChatStorage() ?? undefined,
  });
  ```

  `indexedDbChatStorage()` keeps the newest 300 messages per room in
  IndexedDB and returns null where IndexedDB does not exist. If a stored
  copy is too old to stitch to the live stream, it is dropped and history
  is fetched fresh. Requires `@foony/realtime` 0.16.0.

## 0.2.0

### Changed

- **Message retention now comes from the channel's namespace rule** instead of
  a per-message TTL, which `@foony/realtime` 0.14.0 removed. `send`, `update`,
  and `delete` behave the same, and messages persist as long as the app's plan
  and namespace rule allow.

- **Breaking: `messages.history` pages by serial.** `cursor` (and a page's
  `nextCursor`) is now the oldest message's serial, a number, instead of a
  message id string. Paging cannot loop or skip when a message id is reused,
  and deep scrollback is much faster. Requires `@foony/realtime` >= 0.14.0.

## 0.1.0

### Added

- **End-to-end room encryption.** `rooms.get(name, { cipher: { key } })`
  encrypts every message, typing, reaction, and presence payload client-side, so
  the edge only sees ciphertext. `generateRandomKey` and `CipherParams` are
  re-exported for convenience. Requires `@foony/realtime` >= 0.3.0.
- **Durable message retention.** `messages.send/update/delete` request long
  retention via per-message TTL; the edge clamps it to the app's plan, while
  typing/reactions stay ephemeral.

## 0.0.1

- Initial release: rooms, messages (send/edit/delete, live subscribe, history
  backfill), presence, typing indicators, room reactions, and presence-derived
  occupancy.
