# warden-subagents

`@nekwebdev/warden-subagents` is Warden's Pi package home for subagent type definitions and future subagent extension work.

Current package scope:

- tested agent-type registry API;
- embedded default agent types;
- custom agent markdown loading from project and global Pi agent directories;
- synchronous no-op Pi extension factory that performs no Pi API access.

Still intentionally inert:

- no Agent runtime;
- no background execution;
- no UI;
- no scheduling;
- no memory behavior;
- no RPC behavior;
- no worktree isolation;
- no command, tool, renderer, scheduler, or background registration.

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

Default metadata is registry configuration only. This package does not execute subagents.

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

Within one directory, case-fold duplicate filename stems are deterministic: sorted filenames are processed first-wins; later duplicates are ignored with diagnostics.

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
- `run_in_background` — boolean metadata only in this slice.

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
- no Agent runtime, background execution, RPC behavior, scheduling, memory, or worktree isolation until separate accepted slices define them.

## Upstream attribution

Future implementation may adapt ideas from `tintinweb/pi-subagents`, MIT license, referenced commit `2933ca1d8d30e4e229b6c683f20190423fdd1ed3`.

no upstream source is vendored in this package.
