# Changelog

All notable changes to `@foony/chat`. Format loosely follows
[Keep a Changelog](https://keepachangelog.com); versions are semver.

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
