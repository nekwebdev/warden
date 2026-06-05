# warden-flow

`@nekwebdev/warden-flow` bundles Pi workflow skills and extensions. Current bundled resources are the `warden-map` skill and extension for durable repository orientation.

Goal: reduce repeated repo discovery by maintaining a small map tree and injecting only token-efficient capsules when relevant.

## What it provides

- `/skill:warden-map` — creates or refreshes repository map files.
- `extensions/warden-map` — injects map capsules and git context.
- Session-start map injection — hidden root map capsule from `.warden/map.md`.
- Scoped map injection — hidden scoped capsules from `.warden/maps/<scope>/map.md` appended to relevant tool results.
- Git context injection — branch, short commit, and dirty state.

## Map layout

```text
.warden/
  map.md
  maps/
    <repo-relative-scope>/
      map.md
```

Examples:

```text
.warden/map.md
.warden/maps/pi-warden/map.md
.warden/maps/pi-warden/warden-flow/map.md
```

## Capsule contract

Only marked capsules are auto-injected:

```md
<!-- warden-map:inject:start -->
## Agent Quick Context

- Purpose:
- Boundaries:
- Safe edits:
- Verification:
- Sharp edges:
<!-- warden-map:inject:end -->
```

Full map bodies stay on disk. Agents can read them explicitly when a task needs deeper context.

## Token budget

Approximate budget rule: 1 KB markdown is about 250–350 tokens.

| Context | Target | Hard cap |
|---|---:|---:|
| Root capsule | 3 KB (~900 tokens) | 8 KB (~2,400 tokens) |
| Scoped capsule | 1.5 KB (~450 tokens) | 4 KB (~1,200 tokens) |
| One scoped injection event | — | 6 KB (~1,800 tokens) |
| Session start total | — | 10 KB (~3,000 tokens) |

When a capsule is missing or too large, the extension injects a small notice pointing at the map file instead of injecting the full file.

## Git context

When git is available, the extension injects:

```md
## Current Git Context
- Branch: main
- Commit: abc1234
- Dirty: yes — staged 1, unstaged 3, untracked 2
- Dirty paths: src/a.ts, docs/b.md
```

Git context is cached and re-injected only when branch, commit, or dirty state changes.

## Install locally

From Warden repo root:

```sh
pi install ./pi-warden/warden-flow
```

Or load temporarily:

```sh
pi -e ./pi-warden/warden-flow
```

## Development

```sh
npm install --prefix pi-warden/warden-flow
npm test --prefix pi-warden/warden-flow
mise run test:pi-warden
```
