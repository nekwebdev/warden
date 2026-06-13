# pi-warden

`pi-warden` is Warden's Pi Agent package area.

This directory is a container for independently installable and testable Pi packages. It is not itself a Pi package.

Pi packages may bundle:

- extensions;
- skills;
- prompts;
- themes;
- hooks;
- shared package APIs;
- package-specific docs and tests.

## Package model

Each package lives in its own direct child folder:

```text
pi-warden/
├── README.md
├── AGENTS.md
├── tests/
├── fresh-skill/
├── warden-flow/
├── warden-panel/
├── warden-subagents/
├── warden-theme/
└── warden-web/
```

Package manifests, source, tests, scripts, extensions, skills, prompts, themes, docs, configs, and web assets belong under the individual package folder:

```text
pi-warden/<package>/
├── package.json
├── README.md
├── AGENTS.md
├── src/
├── extensions/
├── skills/
├── prompts/
├── themes/
├── tests/
└── scripts/
```

Use only the folders that fit the package. Do not create ceremony just to make the tree look important. Trees have enough problems.

## Skill, extension, and code split

Skills are thin model-facing workflow entrypoints. Deterministic behavior that can be implemented, tested, reused, or constrained belongs in package-owned code, not only in skill prose.

Use:

- `src/` for reusable deterministic logic and package APIs;
- `extensions/` for Pi runtime integration such as startup injection, tool-result hooks, scoped context injection, and ambient behavior;
- `skills/` for workflow guidance, usage instructions, acceptance behavior, and verification expectations.

Do not add extensions or folders just for ceremony. Add them when package behavior needs them.

When packages import sibling package APIs, declare that package-to-package dependency in the importing package manifest. `warden-flow` depends on `@nekwebdev/warden-panel` for the Effort pane contribution.

## Warden skill template

Future Warden skills should start from the bundled template at:

```text
pi-warden/warden-flow/skills/warden-create-skill/templates/SKILL-template.md
```

The template is a category palette, not literal final skill content. Generated skills should keep only mandatory frontmatter, mandatory concrete sections, relevant optional sections, and applicable default content. Strip template comments, `Status:` labels, placeholder text, generator guidance, unused headings, and examples that do not prevent real misuse.

`/skill:warden-create-skill` uses this template to create global skills under `$PI_CODING_AGENT_DIR/.agents/skills/` or project skills under `.agents/skills/`.

`argument-hint` is useful documentation metadata for skill arguments. Current Pi versions display it for prompt templates, not `/skill:<name>` autocomplete, unless Pi adds skill support later.

## Warden skill effort settings

Packages that add `warden-*` skills should seed default effort settings in Pi `settings.json` under `warden.effort.skills.<skillName>`. `/warden:effort` is the user-facing control surface for changing those values.

Effort defaults and runtime thinking-level behavior belong in package code and extensions, not skill frontmatter, skill descriptions, or `[effort:*]` prose prefixes.

## Current packages

### `fresh-skill/`

Package: `@nekwebdev/fresh-skill`

Standalone `/fresh` extension package for starting a clean Pi session and replaying a selected loaded skill with preserved arguments.

Provides:

- `/fresh <skill> [args...]` — validates a loaded skill, creates a replacement session, and sends `/skill:<skill> [args...]` from replacement-session context.

Package docs:

```text
pi-warden/fresh-skill/README.md
pi-warden/fresh-skill/AGENTS.md
```

### `warden-flow/`

Package: `@nekwebdev/warden-flow`

Warden's workflow and durable-orientation package for Pi skills and extensions.

Provides:

- `/skill:warden-map` — creates or refreshes repository map files;
- `/skill:warden-docs` — aligns stale `README.md` and `AGENTS.md` files with repo evidence when map freshness is current;
- `/skill:warden-create-skill` — creates a new global or project Agent Skill from the bundled Warden skill template;
- `/skill:warden-start` — turns rough intent into one small work packet;
- `/skill:warden-prompt` — workshops vague work ideas into comprehensive `/skill:warden-start` prompts without editing files or running workflows;
- `/skill:warden-grill` — pressure-tests a work packet or manual feedback until TDD-ready;
- `/skill:warden-tdd` — implements one grilled packet slice with strict test-first workflow;
- `/skill:warden-close` — validates an accepted packet or existing closure `handoff.md`, creates or updates final `handoff.md`, and decides changelog/map impact;
- `/skill:warden-commit` — plans safe, atomic local commits and can apply them after plan approval;
- `/warden:effort` — opens the Warden panel Effort pane for per-skill effort settings through `@nekwebdev/warden-panel`;
- `extensions/warden-map` — injects token-conscious map capsules and git context;
- `extensions/warden-commit` — provides `warden_commit_snapshot` and `warden_commit_apply` for compact commit planning and safe local commit execution;
- `extensions/warden-effort` — seeds and applies configured `warden-*` skill effort before skill expansion;
- `extensions/warden-tmux-question-alert` — flashes Warden's tmux robot prefix and sends a Linux desktop notification while `ask_user_question` waits;
- map layout and capsule conventions for reducing repeated repo discovery.

Package docs:

```text
pi-warden/warden-flow/README.md
pi-warden/warden-flow/AGENTS.md
```

### `warden-panel/`

Package: `@nekwebdev/warden-panel`

Warden's Pi Agent panel framework and bundled panel extensions.

Provides:

- `/warden` — opens the Warden panel on the first available pane;
- `/warden:display` — opens the Display pane;
- `/warden:packages` — opens the Packages pane;
- shared panel framework APIs for other Warden packages.

Package docs:

```text
pi-warden/warden-panel/README.md
pi-warden/warden-panel/AGENTS.md
```

### `warden-subagents/`

Package: `@nekwebdev/warden-subagents`

Warden's Pi subagent-type registry package and future subagents extension home.

Current package provides:

- a tested registry API for default and custom agent types;
- embedded `general-purpose`, `Explore`, and `Plan` default definitions;
- custom `.pi/agents/<name>.md` loading with project-over-global precedence, case-insensitive resolution, normalized config, and structured diagnostics;
- a synchronous no-op extension factory that performs no Pi API access;
- explicit fences against Agent runtime, background execution, RPC behavior, and worktree isolation until later slices define them.

Package docs:

```text
pi-warden/warden-subagents/README.md
pi-warden/warden-subagents/AGENTS.md
```

### `warden-theme/`

Package: `@nekwebdev/warden-theme`

Warden's Catppuccin Mocha-derived Pi theme package.

Provides:

- `themes/warden-catppuccin-mocha.json` — complete Pi theme using official Catppuccin Mocha hex vars;
- README inventory mapping every current Pi theme color token to its Catppuccin Mocha var and Pi-supported color value forms.

Package docs:

```text
pi-warden/warden-theme/README.md
pi-warden/warden-theme/AGENTS.md
```

### `warden-web/`

Package: `@nekwebdev/warden-web`

Warden's local web server package and future mobile-first browser UI for Warden-managed Pi agents.

Provides now:

- a package-local Node HTTP server;
- `GET /health` and `GET /api/agents`;
- Warden-managed Pi agent discovery read model;
- `warden-web` and `warden-web-server` package bins;
- package-local TypeScript, oxlint, oxfmt, tests, build, smoke, and dry-pack checks.

Package docs:

```text
pi-warden/warden-web/README.md
pi-warden/warden-web/AGENTS.md
```

## Scope boundary

`pi-warden` packages provide Pi Agent package behavior after they are installed or loaded by Pi.

They do not own Warden runner workflows.

These belong to `run-warden/`:

```sh
warden agents new <name>
warden agents update <name>
warden agents set <name> cwd <dir>
warden agents show <name>
warden agents list
warden pi <name> ...
```

Do not mutate root `./warden` or `run-warden/` from package work unless the task explicitly scopes a cross-boundary contract.

## Local package development

From the Warden repo root:

```sh
npm install --prefix pi-warden/fresh-skill
npm install --prefix pi-warden/warden-panel
npm install --prefix pi-warden/warden-flow
npm install --prefix pi-warden/warden-subagents
npm install --prefix pi-warden/warden-web

npm test --prefix pi-warden/fresh-skill
npm test --prefix pi-warden/warden-panel
npm test --prefix pi-warden/warden-flow
npm test --prefix pi-warden/warden-subagents
npm test --prefix pi-warden/warden-theme
npm test --prefix pi-warden/warden-web

mise run test:pi-warden
```

Package-local commands should remain independently runnable.

## Loading packages in Pi

From the Warden repo root, local packages can be loaded temporarily during development:

```sh
pi -e ./pi-warden/fresh-skill
pi -e ./pi-warden/warden-panel
pi -e ./pi-warden/warden-flow
pi -e ./pi-warden/warden-subagents
pi -e ./pi-warden/warden-theme
```

Or installed locally into a Pi environment:

```sh
pi install ./pi-warden/fresh-skill
pi install ./pi-warden/warden-panel
pi install ./pi-warden/warden-flow
pi install ./pi-warden/warden-subagents
pi install ./pi-warden/warden-theme
```

Warden-managed Pi agent environments are created and launched by `run-warden/`, not by local package code in this directory.

## Agent guidance

Before editing in this area:

1. read the repo root `AGENTS.md`;
2. read `pi-warden/AGENTS.md`;
3. read the package-local `AGENTS.md` before editing inside `pi-warden/<package>/`;
4. use nearby `map.md` files for orientation only.

Role identity for specialist agents belongs in their Pi environment config, not in this repository.

## Durable orientation

`map.md` files are durable orientation context. They are not task plans, issue trackers, implementation diaries, or current-work state.

Update package READMEs, package `AGENTS.md`, and nearby maps only when package structure, commands, behavior, or durable orientation changes.
