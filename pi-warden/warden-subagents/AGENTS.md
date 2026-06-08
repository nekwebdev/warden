# warden-subagents Agent Guidance

Package-local guidance for `pi-warden/warden-subagents/`.

## Scope

`@nekwebdev/warden-subagents` owns Warden's Pi subagent-type registry package plus foreground `Agent` tool and background launch/result lookup package work.

Current package owns:

- package identity and manifest;
- foreground `Agent` tool registration;
- background `Agent` launch/result lookup around the foreground runner;
- read-only Warden Panel Subagents pane plus `/agents` and `/warden:agents` aliases;
- in-process child `createAgentSession` foreground runner;
- functional registry API under `src/`;
- embedded default agent types;
- custom `.pi/agents/<name>.md` loading, normalization, diagnostics, and resolution;
- package-local tests and docs for registry, foreground runner, background activity, and read-only panel seams.

Hard fences:

- background launch/result lookup is allowed only through the package-local `AgentManager`, `Agent({ run_in_background: true })`, and `get_subagent_result` tool path;
- native Pi widget and one-per-unconsumed-terminal completion notifications are allowed only through package-local UI/notification helpers;
- read-only Warden Panel pane work is limited to cached active background-agent snapshots and agent-type registry display;
- no background steering, resume, persistent retention, scheduling, RPC, worktree, conversation overlay, or panel admin controls;
- no scheduling;
- no memory behavior;
- no RPC behavior;
- no worktree isolation;
- no Pi command, scheduler, or background registration outside package-local `Agent`/`get_subagent_result` tools, native renderers, `/agents`, and `/warden:agents`;
- no root bootstrap, runner workflow, `warden agents ...`, shell integration, Nix, or dev-environment behavior.

## Agent runner rules

- Register Claude-compatible `Agent` plus `get_subagent_result` for background result lookup.
- `run_in_background: true` returns an agent id immediately and must use extension-instance `AgentManager` state; `resume` remains visibly unsupported and no-op for child session creation.
- Unknown agent types must fall back to `general-purpose` with visible note.
- Disabled agent types must return disabled status and start no child session.
- Preserve foreground status vocabulary: `completed`, `fallback`, `disabled`, `unsupported`, `steered`, `aborted`, `error`; background lifecycle may additionally use `queued` and `running` and must not use `fallback` as lifecycle state.
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
