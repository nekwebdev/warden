# warden-subagents Agent Guidance

Package-local guidance for `pi-warden/warden-subagents/`.

## Scope

`@nekwebdev/warden-subagents` owns Warden's Pi subagent-type registry package and future Pi subagents extension work.

Current package owns:

- package identity and manifest;
- synchronous no-op extension factory;
- functional registry API under `src/`;
- embedded default agent types;
- custom `.pi/agents/<name>.md` loading, normalization, diagnostics, and resolution;
- package-local registry tests and docs.

Preserve inert runtime behavior unless a later packet explicitly scopes runtime work.

Hard fences:

- no Agent runtime;
- no background execution;
- no UI;
- no scheduling;
- no memory behavior;
- no RPC behavior;
- no worktree isolation;
- no Pi command, tool, renderer, scheduler, or background registration;
- no root bootstrap, runner workflow, `warden agents ...`, shell integration, Nix, or dev-environment behavior.

## Registry implementation rules

- Keep filesystem IO in loading functions such as `loadAgentTypes` and custom-agent discovery.
- Keep `resolveAgentType` pure over an already-loaded registry.
- Use structured diagnostics for caller display; do not print from registry code.
- Treat custom-agent filename stem as canonical type key. Frontmatter `name` is display metadata only.
- Keep default agent prompt bodies Warden-owned; do not vendor upstream prompt bodies.
- Normalize metadata only. Do not execute tool, extension, model, thinking, isolation, memory, background, or prompt semantics in this package slice.

## Attribution

Future implementation may adapt ideas from `tintinweb/pi-subagents`, MIT license, referenced commit `2933ca1d8d30e4e229b6c683f20190423fdd1ed3`.

no upstream source is vendored in this package.

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
