# warden-subagents Agent Guidance

Package-local guidance for `pi-warden/warden-subagents/`.

## Scope

`@nekwebdev/warden-subagents` owns Warden's future Pi subagents extension package.

Current package is scaffold-only. Preserve inert behavior unless a later packet explicitly scopes runtime work.

Hard fences:

- no Agent runtime;
- no background execution;
- no UI;
- no scheduling;
- no memory;
- no RPC behavior;
- no worktree isolation;
- no Pi command, tool, renderer, scheduler, or background registration in scaffold work;
- no root bootstrap, runner workflow, `warden agents ...`, shell integration, Nix, or dev-environment behavior.

## Attribution

Future implementation may adapt ideas from `tintinweb/pi-subagents`, MIT license, referenced commit `2933ca1d8d30e4e229b6c683f20190423fdd1ed3`.

no upstream source is vendored in this scaffold.

## Tests

Run package-local validation after changes:

```sh
npm test --prefix pi-warden/warden-subagents
```

Run package-area smoke after changing package manifests, package list docs, or shared assumptions:

```sh
mise run test:pi-warden
```

Run pack inspection when changing package manifest or publish file list:

```sh
npm pack --dry-run --prefix pi-warden/warden-subagents
```
