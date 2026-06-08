# warden-subagents

`@nekwebdev/warden-subagents` is Warden's Pi package home for future subagent extension work.

Current scaffold is intentionally inert:

- no Agent runtime;
- no background execution;
- no UI;
- no scheduling;
- no memory;
- no RPC behavior;
- no worktree isolation;
- no command, tool, renderer, scheduler, or background registration.

Package exports root `index.ts` for package-level imports and advertises one Pi extension entry at `extensions/subagents/index.ts`. That extension factory is synchronous, type-only imports Pi `ExtensionAPI`, and performs no Pi API property access.

## Development

From repo root:

```sh
npm install --prefix pi-warden/warden-subagents
npm test --prefix pi-warden/warden-subagents
npm pack --dry-run --prefix pi-warden/warden-subagents
mise run test:pi-warden
```

Load locally during development:

```sh
pi -e ./pi-warden/warden-subagents
```

## Scope fences

Future slices may add subagent behavior inside this package only when packet scope says so. Keep these fences explicit:

- no runner workflow changes;
- no `warden agents ...` lifecycle command changes;
- no root bootstrap changes;
- no shell integration;
- no Nix or dev-environment product behavior;
- no Agent runtime, background execution, RPC behavior, scheduling, memory, or worktree isolation until separate accepted slices define them.

## Upstream attribution

Future implementation may adapt ideas from `tintinweb/pi-subagents`, MIT license, referenced commit `2933ca1d8d30e4e229b6c683f20190423fdd1ed3`.

no upstream source is vendored in this scaffold.
