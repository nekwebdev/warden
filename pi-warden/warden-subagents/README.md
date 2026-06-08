# warden-subagents

`@nekwebdev/warden-subagents` is Warden's Pi package home for subagent type definitions and foreground subagent delegation.

Current package scope:

- tested agent-type registry API;
- embedded default agent types;
- custom agent markdown loading from project and global Pi agent directories;
- foreground `Agent` tool that runs one child Pi agent session in-process and returns final text inline;
- pure helper seams for invocation precedence, prompt/context construction, model resolution, off-by-default model scope enforcement, tool policy, and max-turn planning.

Still intentionally out of scope:

- no background execution;
- no UI;
- no scheduling;
- no memory behavior;
- no RPC behavior;
- no worktree isolation;
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
- `run_in_background` and `resume` — schema-compatible foreground-blocked fields. They return visible unsupported status and start no child session.
- `isolated` and `isolation` — schema-compatible fields accepted for later slices. They cannot override resolved agent isolation in this foreground slice.

Return content is final visible assistant text. `details.status` is one of `completed`, `fallback`, `disabled`, `unsupported`, `steered`, `aborted`, or `error`.

Tool policy is applied before the child receives its task prompt. The runner creates the child session, expands extension-wide selectors from `getAllTools().sourceInfo`, calls `setActiveToolsByName` when available, then sends the prompt.

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
- `memory` — boolean metadata only in this slice.
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
- no background execution, RPC behavior, scheduling, memory, UI, or worktree isolation until separate accepted slices define them.

## Upstream attribution

Future implementation may adapt ideas from `tintinweb/pi-subagents`, MIT license, referenced commit `2933ca1d8d30e4e229b6c683f20190423fdd1ed3`.

no upstream source is vendored in this package.
