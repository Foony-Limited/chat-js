# Changelog

All notable changes to `@foony/chat`. Format loosely follows
[Keep a Changelog](https://keepachangelog.com); versions are semver.

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
