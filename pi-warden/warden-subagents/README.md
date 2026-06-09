# warden-subagents

`@nekwebdev/warden-subagents` is Warden's Pi package home for subagent type definitions, foreground subagent delegation, background launch/result lookup, one-shot scheduled subagent jobs, and the read-only Warden Panel Subagents pane.

Current package scope:

- tested agent-type registry API;
- embedded default agent types;
- custom agent markdown loading from project and global Pi agent directories;
- foreground `Agent` tool that runs one child Pi agent session in-process and returns final text inline;
- caller-requested worktree isolation for `Agent({ isolation: "worktree" })` runs;
- background `Agent` mode that returns an agent ID immediately and lets parents retrieve queued/running/completed/error/aborted state with `get_subagent_result`;
- session-scoped one-shot `Agent({ schedule })` jobs stored under Pi session storage and surfaced in `/agents`;
- read-only Warden Panel Subagents pane opened by `/agents` and `/warden:agents`;
- pure helper seams for invocation precedence, prompt/context construction, scoped memory prompt extras, model resolution, off-by-default model scope enforcement, tool policy, and max-turn planning.

Still intentionally out of scope:

- no background steering, resume, persistent retention, cron/interval recurrence, RPC, conversation overlay, or panel admin controls;
- native Pi widget and one-per-unconsumed-terminal completion notifications are in scope only for package-local background `Agent` activity;
- no scheduling beyond session-scoped one-shot `Agent({ schedule })` jobs;
- memory behavior is limited to explicit `memory: project|local|user` prompt extras, safe `MEMORY.md` index reads, read-only fallback, and selected-directory creation for write-capable explicit subagent runs;
- no RPC behavior;
- no custom-agent frontmatter `isolation: worktree` semantics or transcript JSONL streaming yet;
- no runner workflow or `warden agents ...` lifecycle behavior.

## Foreground `Agent` tool

The extension registers Claude-compatible tool name `Agent`.

Minimal use:

```json
{
  "subagent_type": "Explore",
  "description": "Find repo evidence without writes",
  "prompt": "Inspect package tests and summarize likely verification commands."
}
```

Key parameters:

- `subagent_type` — agent type to run. Unknown names fall back to `general-purpose` with visible note.
- `prompt` — delegated child task.
- `description` — short human-readable task label.
- `model` — optional caller model request such as `provider/modelId`, `haiku`, or `sonnet`; agent frontmatter `model` wins.
- `thinking` — optional child thinking level; agent frontmatter `thinking` wins.
- `max_turns` — optional explicit turn limit. At limit, child receives wrap-up steer; after 3 grace turns, runner aborts.
- `inherit_context` — request compact parent conversation bridge. Resolved agent config still controls default context inheritance.
- `run_in_background` — when `true`, starts the child through the package-local background manager and returns visible text plus `details.agentId`/`details.status` immediately.
- `schedule` — optional one-shot future run. Accepts positive relative `+10s`, `+5m`, `+2h`, `+1d` values or absolute ISO timestamps with explicit timezone (`Z` or offset).
- `resume` — schema-compatible blocked field. It returns visible unsupported status and starts no child session.
- `isolated` and `isolation` — compatibility fields except exact `isolation: "worktree"`, which requests strict temporary git worktree isolation for this call. Other values remain no-ops.

Foreground return content is final visible assistant text. `details.status` is one of `completed`, `fallback`, `disabled`, `unsupported`, `steered`, `aborted`, or `error`. Scheduled launch returns `scheduled` with `details.scheduleId` and `details.nextRunAt`. Background launch returns `queued` or `running`, and lookup returns `queued`, `running`, `completed`, `error`, or `aborted`; unknown background types fall back to `general-purpose` with `details.note` but keep lifecycle status vocabulary.

Tool policy is applied before the child receives its task prompt. The runner creates the child session, expands extension-wide selectors from `getAllTools().sourceInfo`, calls `setActiveToolsByName` when available, then sends the prompt.

## Worktree isolation

`Agent({ isolation: "worktree" })` validates that the parent cwd is in a git repo with at least one commit and a clean checkout. Uncommitted tracked files and untracked non-ignored files block the run; ignored files are allowed. The child runs in a temporary OS-dir worktree with a Warden-owned prefix, rooted at committed `HEAD`. When parent cwd is a repo subdirectory, child cwd maps to the same relative subdirectory in the worktree.

The child system prompt gets a worktree notice with temp path, parent cwd, branch persistence rule, and committed-files-only warning. Delegated user task text is unchanged. Ignored or untracked artifacts such as `node_modules` may be absent.

Successful no-change runs remove the temp worktree. Successful changed runs stage all worktree changes with `git add -A`, commit with `--no-verify` as `Subagent <id>: <description>` (falling back to agent type), create `pi-agent-<id>` or next `-2`/`-3` branch, report `details.worktree` plus exact `git merge <branch>` guidance, then remove the worktree. Child `error`/`aborted` with changes, commit failures, and branch failures preserve the worktree path for manual recovery and do not auto-commit failed child work.

Background worktree setup happens when queued work starts. The launch call still returns the background agent ID immediately; setup failures surface through `get_subagent_result`.

Custom-agent frontmatter `isolation: worktree`, transcript JSONL streaming, and broad orphan worktree pruning are deferred.

Custom-agent memory prompt extras are active only for explicit string scopes:

- `memory: project` uses `<project>/.pi/agent-memory/<agent>/`.
- `memory: local` uses `<project>/.pi/agent-memory-local/<agent>/`.
- `memory: user` uses `<getAgentDir()>/agent-memory/<agent>/`.

`<project>` is the nearest ancestor containing `.pi/agents`; when none exists, invocation `cwd` is used. `memory: local` never mutates `.gitignore` or other VCS ignore files; users own repository ignore policy.

Agents with effective `write` or `edit` after `disallowed_tools` receive read/write memory instructions and the runner creates only the selected memory directory during that explicit subagent run. The runner never creates starter `MEMORY.md` content. Agents without effective `write` or `edit` receive read-only memory instructions, may get `read` added when it was absent and not denied, and do not create missing memory directories. Denied `read` is not re-added; if a safe `MEMORY.md` index already exists, the runner may inject its first 200 lines and warns that no further memory reads are available through tools.

## Background result lookup

Use `Agent` with `run_in_background: true` to start work without blocking the parent turn:

```json
{
  "subagent_type": "Explore",
  "description": "Inspect tests",
  "prompt": "Find narrow validation commands.",
  "run_in_background": true
}
```

The visible result includes the background agent ID and initial `queued` or `running` state. Use `get_subagent_result` with that ID to check state or retrieve final text:

```json
{ "agent_id": "agent-1" }
```

Use `wait: true` when the parent needs the final result and should wait for `completed`, `error`, or `aborted`:

```json
{ "agent_id": "agent-1", "wait": true }
```

The default background concurrency is 4 per extension session. Foreground calls bypass this queue. Session shutdown aborts active background work and clears in-memory records.

## One-shot scheduling

Use `Agent` with `schedule` to persist a one-shot future background run scoped to the current Pi session:

```json
{
  "subagent_type": "Explore",
  "description": "Inspect after delay",
  "prompt": "Inspect package tests and summarize findings.",
  "schedule": "+10s"
}
```

Accepted schedule formats:

- positive relative values with units `s`, `m`, `h`, or `d`: `+10s`, `+5m`, `+2h`, `+1d`;
- absolute ISO timestamps with explicit timezone, such as `2026-06-08T12:30:00Z` or `2026-06-08T13:30:00+01:00`.

Rejected formats include zero, negative, decimal, unknown units, timezone-less ISO strings, cron, and interval strings. Cron and interval errors say those forms are deferred.

Scheduled calls cannot combine with `inherit_context`, `resume`, or `run_in_background`. They return immediately with `details.status: "scheduled"`, a session-local `schedule-<n>` id, and next run time; no child session starts at schedule time. Stored jobs keep caller prompt/params only, never a parent context snapshot, and fire later with `inherit_context: false` through the existing background `AgentManager` while the same compatible session runtime is alive or rearmed.

Schedule state is Warden-named under Pi session storage:

```text
<ctx.sessionManager.getSessionDir()>/warden-subagent-schedules/<ctx.sessionManager.getSessionId()>.json
```

Writes use an exclusive `.lock` file plus temp-file rename. Print/json headless schedule calls persist and return immediately; timers are unref'd and do not keep headless processes alive.

## Subagents pane

Use `/agents` or `/warden:agents` to open Warden Panel focused on the Subagents pane. The pane renders a cached read-only snapshot loaded at command time from:

- active package-local `AgentManager.getActivitySnapshot()` queued/running background agents;
- session-scoped scheduled jobs with id, agent type, description, next run, last status, and run count;
- default and custom agent types loaded from command `ctx.cwd`;
- registry diagnostics as a concise count plus first message.

The pane shows source and disabled indicators for agent types, zero-state text when no background agents or scheduled jobs exist, and no create/edit/delete/stop/settings/remove/admin controls in this slice.

## Registry API

Package root exports:

```ts
import {
	DEFAULT_AGENT_TYPES,
	loadAgentTypes,
	resolveAgentType,
} from "@nekwebdev/warden-subagents";
```

`loadAgentTypes({ cwd, globalAgentsDir?, projectAgentsDir? })` loads defaults plus custom markdown agent definitions and returns `{ agents, diagnostics }`.

`resolveAgentType(registry, name)` is pure over an already-loaded registry. It performs no filesystem IO and returns one of:

- `{ status: "found", agent }`;
- `{ status: "disabled", name }`;
- `{ status: "unknown", name }`.

Lookup is case-insensitive.

## Default agent types

Built-in defaults:

- `general-purpose` — append-mode parent-twin metadata: `promptMode: "append"`, `inheritContext: true`, `isolation: "parent-twin"`, all tools, enabled.
- `Explore` — read-only standalone default with `read`, `grep`, `find`, and `ls`.
- `Plan` — read-only standalone default with `read`, `grep`, `find`, and `ls`.

## Custom agent locations

Custom agents are markdown files named `.pi/agents/<name>.md` or `<global-agent-dir>/agents/<name>.md`.

When directories are not injected for tests:

- project agents come from nearest ancestor `.pi/agents/` found by walking upward from `cwd`;
- global agents come from `getAgentDir()/agents`, including `$PI_CODING_AGENT_DIR/agents` when Pi env config points there.

Precedence:

1. embedded defaults;
2. global agents;
3. nearest project agents.

Higher-precedence filename stems override lower definitions. `enabled: false` masks lower definitions and resolves as `disabled`.

Filename stem is canonical type key. Frontmatter `name`, when present, is display metadata only and never changes lookup key.

## Minimal custom agent

`.pi/agents/example.md`:

```md
---
name: Example Helper
description: Read-only helper for local discovery.
tools: read, grep, find, ls
thinking: low
---
Inspect requested files and summarize repository evidence without editing.
```

## Frontmatter fields

Supported fields:

- `name` — optional display metadata.
- `description` — optional description; missing value warns and defaults to empty string.
- `display_name` — optional display label.
- `tools` — comma string or YAML array. Supports built-ins `read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`; `all`/`*`; `none`; `ext:<extension>`; `ext:<extension>/<tool>`.
- `extensions` — comma string or YAML array of extension ids.
- `skills` — comma string or YAML array of skill ids.
- `disallowed_tools` — comma string or YAML array of tool selectors.
- `memory` — optional explicit scope `project`, `local`, or `user`. Legacy `memory: true` and invalid values warn and remain inactive.
- `enabled` — boolean; `false` masks lower-precedence definitions.
- `isolation` — `standalone` or `parent-twin`.
- `isolated` — boolean alias; `isolated: true` maps to `standalone` only when `isolation` is absent.
- `model` — non-empty string.
- `thinking` — `off`, `minimal`, `low`, `medium`, `high`, or `xhigh`.
- `max_turns` — positive integer.
- `prompt_mode` — `replace` or `append`.
- `inherit_context` — boolean.
- `run_in_background` — boolean metadata only; foreground tool rejects background runs.

List fields trim entries, de-duplicate entries, and warn on non-string values.

Missing custom execution-shape fields normalize to standalone metadata: `isolation: "standalone"`, `inheritContext: false`, `promptMode: "replace"`, and `runInBackground: false`.

Validation is lenient. Unreadable files, malformed/non-object frontmatter, and empty prompt bodies are skipped. Invalid individual field values keep the agent with safe defaults plus structured diagnostics.

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
- no background steering, resume, persistent retention, RPC behavior, cron/interval scheduling, conversation overlay, custom-agent worktree frontmatter, transcript JSONL streaming, broad orphan worktree pruning, or panel admin controls until separate accepted slices define them.

## Upstream attribution

Future implementation may adapt ideas from `tintinweb/pi-subagents`, MIT license, referenced commit `2933ca1d8d30e4e229b6c683f20190423fdd1ed3`.

no upstream source is vendored in this package.
