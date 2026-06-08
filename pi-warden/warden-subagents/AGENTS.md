# warden-subagents Agent Guidance

Package-local guidance for `pi-warden/warden-subagents/`.

## Scope

`@nekwebdev/warden-subagents` owns Warden's Pi subagent-type registry package and foreground `Agent` tool package work.

Current package owns:

- package identity and manifest;
- foreground `Agent` tool registration;
- in-process child `createAgentSession` foreground runner;
- functional registry API under `src/`;
- embedded default agent types;
- custom `.pi/agents/<name>.md` loading, normalization, diagnostics, and resolution;
- package-local tests and docs for registry and foreground runner seams.

Hard fences:

- no background execution;
- no UI;
- no scheduling;
- no memory behavior;
- no RPC behavior;
- no worktree isolation;
- no Pi command, renderer, scheduler, or background registration;
- no root bootstrap, runner workflow, `warden agents ...`, shell integration, Nix, or dev-environment behavior.

## Foreground runner rules

- Register only Claude-compatible `Agent` tool name in this slice.
- Keep `run_in_background: true` and `resume` visibly unsupported and no-op for child session creation.
- Unknown agent types must fall back to `general-purpose` with visible note.
- Disabled agent types must return disabled status and start no child session.
- Preserve status vocabulary: `completed`, `fallback`, `disabled`, `unsupported`, `steered`, `aborted`, `error`.
- Agent frontmatter `model`, `thinking`, and `max_turns` win over caller fields.
- Caller `isolated`/`isolation` fields are schema compatibility only and must not override resolved agent isolation in this slice.
- Apply tool policy before first child prompt: create child session, inspect `getAllTools().sourceInfo` for extension-wide selectors, set active tools, then prompt.
- Keep model scope enforcement pure and off by default. Do not read or write real Pi settings for model scope in this slice.
- Parent context inheritance must include recent visible user/assistant text only, exclude tool payloads/results, cap at 6000 characters, and include a truncation marker when capped.

## Registry implementation rules

- Keep filesystem IO in loading functions such as `loadAgentTypes` and custom-agent discovery.
- Keep `resolveAgentType` pure over an already-loaded registry.
- Use structured diagnostics for caller display; do not print from registry code.
- Treat custom-agent filename stem as canonical type key. Frontmatter `name` is display metadata only.
- Keep default agent prompt bodies Warden-owned; do not vendor upstream prompt bodies.
- Normalize registry metadata in registry code; execute foreground runtime semantics only in runner/tool code.

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
