# Changelog

All notable Warden changes are recorded here.

## Unreleased

### Changed

- Warden Flow map freshness now uses the requested map's per-map basis and committed changes since that basis, so commits containing only map-owned files keep refreshed maps fresh while later non-map commits mark them stale.
- Warden Flow docs and `warden-docs` guidance now describe classifier-based map freshness instead of direct map-state SHA equality with `HEAD`.

### Tests

- Added Warden Flow coverage for map-only commits, non-map commits, same-HEAD freshness, invalid or missing state, unreachable bases, and formatted freshness metadata.
