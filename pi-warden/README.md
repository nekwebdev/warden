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
├── warden-panel/
├── warden-flow/
└── warden-theme/
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

Future Warden skills should keep a consistent frontmatter and body-tag shape so skill workflows are easy to scan, compare, and maintain. Keep required body tags present even when empty.

```md
---
name: warden-example
description: Specific workflow description plus when to use it.
argument-hint: [expected arguments]
license: MIT
---

<argument-handling>

</argument-handling>

<scope-gates>

</scope-gates>

<safety>

</safety>

<context-sources>

</context-sources>

<workflow>

</workflow>

<supporting-info>

</supporting-info>

<review-checks>

</review-checks>

<output-format>

</output-format>
```

`argument-hint` is useful documentation metadata for skill arguments. Current Pi versions display it for prompt templates, not `/skill:<name>` autocomplete, unless Pi adds skill support later.

## Warden skill effort settings

Packages that add `warden-*` skills should seed default effort settings in Pi `settings.json` under `warden.effort.skills.<skillName>`. `/warden:effort` is the user-facing control surface for changing those values.

Effort defaults and runtime thinking-level behavior belong in package code and extensions, not skill frontmatter, skill descriptions, or `[effort:*]` prose prefixes.

## Current packages

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

### `warden-flow/`

Package: `@nekwebdev/warden-flow`

Warden's workflow and durable-orientation package for Pi skills and extensions.

Provides:

- `/skill:warden-map` — creates or refreshes repository map files;
- `/skill:warden-docs` — aligns stale `README.md` and `AGENTS.md` files with repo evidence when map freshness is current;
- `/skill:warden-start` — turns rough intent into one small work packet;
- `/skill:warden-grill` — pressure-tests a work packet or manual feedback until TDD-ready;
- `/skill:warden-tdd` — implements one grilled packet slice with strict test-first workflow;
- `/skill:warden-close` — validates an accepted packet or existing closure `handoff.md`, creates or updates final `handoff.md`, and decides changelog/map impact;
- `/skill:warden-commit` — plans safe, atomic local commits and can apply them after exact `Commit` confirmation;
- `/warden:effort` — opens the Warden panel Effort pane for per-skill effort settings through `@nekwebdev/warden-panel`;
- `extensions/warden-map` — injects token-conscious map capsules and git context;
- `extensions/warden-commit` — provides `warden_commit_snapshot` and `warden_commit_apply` for compact commit planning and safe local commit execution;
- `extensions/warden-effort` — seeds and applies configured `warden-*` skill effort before skill expansion;
- map layout and capsule conventions for reducing repeated repo discovery.

Package docs:

```text
pi-warden/warden-flow/README.md
pi-warden/warden-flow/AGENTS.md
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
npm install --prefix pi-warden/warden-panel
npm install --prefix pi-warden/warden-flow

npm test --prefix pi-warden/warden-panel
npm test --prefix pi-warden/warden-flow
npm test --prefix pi-warden/warden-theme

mise run test:pi-warden
```

Package-local commands should remain independently runnable.

## Loading packages in Pi

From the Warden repo root, local packages can be loaded temporarily during development:

```sh
pi -e ./pi-warden/warden-panel
pi -e ./pi-warden/warden-flow
pi -e ./pi-warden/warden-theme
```

Or installed locally into a Pi environment:

```sh
pi install ./pi-warden/warden-panel
pi install ./pi-warden/warden-flow
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
