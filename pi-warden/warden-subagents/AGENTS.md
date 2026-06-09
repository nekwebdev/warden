# warden-subagents Agent Guidance

Package-local guidance for `pi-warden/warden-subagents/`.

## Scope

`@nekwebdev/warden-subagents` owns Warden's Pi subagent-type registry package plus foreground `Agent` tool, background launch/result lookup package work, and scoped custom-agent memory prompt extras.

Current package owns:

- package identity and manifest;
- foreground `Agent` tool registration;
- caller-requested `Agent({ isolation: "worktree" })` temporary git worktree isolation;
- background `Agent` launch/result lookup around the foreground runner;
- read-only Warden Panel Subagents pane plus `/agents` and `/warden:agents` aliases;
- session-scoped one-shot `Agent({ schedule })` jobs with Warden-named Pi session storage and `/agents` visibility;
- scoped custom-agent memory prompt extras for explicit `memory: project|local|user` frontmatter;
- in-process child `createAgentSession` foreground runner;
- functional registry API under `src/`;
- embedded default agent types;
- custom `.pi/agents/<name>.md` loading, normalization, diagnostics, and resolution;
- package-local tests and docs for registry, foreground runner, background activity, and read-only panel seams.

Hard fences:

- background launch/result lookup is allowed only through the package-local `AgentManager`, `Agent({ run_in_background: true })`, and `get_subagent_result` tool path;
- native Pi widget and one-per-unconsumed-terminal completion notifications are allowed only through package-local UI/notification helpers;
- read-only Warden Panel pane work is limited to cached active background-agent snapshots and agent-type registry display;
- no background steering, resume, persistent retention, cron/interval recurrence, RPC, conversation overlay, or panel admin controls;
- no scheduling beyond session-scoped one-shot `Agent({ schedule })` jobs;
- no memory behavior beyond explicit `memory: project|local|user` prompt extras, safe `MEMORY.md` index reads, read-only fallback, and selected-directory creation for write-capable explicit subagent runs;
- no RPC behavior;
- no custom-agent frontmatter `isolation: worktree`, transcript JSONL streaming, or broad orphan worktree pruning;
- no Pi command, scheduler, or background registration outside package-local `Agent`/`get_subagent_result` tools, one-shot schedule runtime, native renderers, `/agents`, and `/warden:agents`;
- no root bootstrap, runner workflow, `warden agents ...`, shell integration, Nix, or dev-environment behavior.

## Agent runner rules

- Register Claude-compatible `Agent` plus `get_subagent_result` for background result lookup.
- `run_in_background: true` returns an agent id immediately and must use extension-instance `AgentManager` state; `resume` remains visibly unsupported and no-op for child session creation.
- `Agent({ schedule })` accepts one-shot positive relative `+Ns/+Nm/+Nh/+Nd` values and timezone-explicit ISO timestamps only. It stores caller prompt/params in `<ctx.sessionManager.getSessionDir()>/warden-subagent-schedules/<ctx.sessionManager.getSessionId()>.json`, rejects `inherit_context`, `resume`, and `run_in_background`, forces no parent-context bridge, and fires through package-local `AgentManager` when the same session runtime is alive or rearmed. Cron, interval recurrence, settings toggles, removal/admin controls, and cross-session daemons stay deferred.
- Unknown agent types must fall back to `general-purpose` with visible note.
- Disabled agent types must return disabled status and start no child session.
- Preserve foreground status vocabulary: `completed`, `fallback`, `disabled`, `unsupported`, `steered`, `aborted`, `error`; scheduled launch may return `scheduled`; background lifecycle may additionally use `queued` and `running` and must not use `fallback` as lifecycle state.
- Agent frontmatter `model`, `thinking`, and `max_turns` win over caller fields.
- Exact caller `isolation: "worktree"` enables package-owned temporary git worktree isolation; all other caller `isolated`/`isolation` values stay compatibility no-ops.
- Worktree isolation must validate a clean committed parent git checkout before child start, run child cwd in the matching temp worktree path, add only a system-prompt worktree notice, auto-commit successful changed work with `git add -A` and `--no-verify`, persist via `pi-agent-<id>` branch collision suffixes, report `details.worktree`, and preserve changed failed worktrees for recovery.
- Background worktree validation/setup belongs at queued run start; initial background launch still returns agent id immediately.
- Apply tool policy before first child prompt: create child session, inspect `getAllTools().sourceInfo` for extension-wide selectors, set active tools, then prompt.
- Keep model scope enforcement pure and off by default. Do not read or write real Pi settings for model scope in this slice.
- Parent context inheritance must include recent visible user/assistant text only, exclude tool payloads/results, cap at 6000 characters, and include a truncation marker when capped.
- Custom-agent memory is active only for explicit string scopes `project`, `local`, or `user`; `memory: true` and invalid values warn and remain inactive.
- Memory directories are exactly `<project>/.pi/agent-memory/<agent>/`, `<project>/.pi/agent-memory-local/<agent>/`, and `<getAgentDir()>/agent-memory/<agent>/`; `<project>` is nearest ancestor containing `.pi/agents`, falling back to invocation cwd.
- `memory: local` must not mutate `.gitignore` or any VCS ignore file; users own repository ignore policy.
- Memory may add only `read` when absent and not denied. It must never add `write` or `edit`.
- Read/write memory instructions require effective `write` or `edit` after `disallowed_tools`; otherwise use read-only instructions and do not create missing memory directories.
- Never create starter `MEMORY.md` content; only inject a bounded 200-line safe `MEMORY.md` index when present.

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
