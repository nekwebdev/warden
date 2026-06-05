# pi-warden Agent Guidance

Repository guidance for any coding agent working in `pi-warden/`.

Keep agent identity and role-specific behavior outside the repo in the agent environment config.

## Instruction order

- Read the repo root `AGENTS.md` first.
- Read this file before changing files under `pi-warden/`.
- Before editing inside a package, read `pi-warden/<package>/AGENTS.md`.
- Package-local guidance overrides this file for that package.
- Use nearby `map.md` files for orientation only.
- Do not treat `map.md` as a task plan, issue tracker, implementation diary, or source of truth for current work.

## Directory model

`pi-warden/` is a container, not a Pi package.

Each Pi package lives in its own direct child directory:

```text
pi-warden/<package>/
```

A Pi package may bundle extensions, skills, prompts, themes, hooks, package APIs, docs, and tests.

Top-level `pi-warden/` files describe and smoke-test the package area as a whole:

```text
pi-warden/
├── README.md
├── AGENTS.md
└── tests/
```

Package manifests and package implementation belong under package folders, never directly under `pi-warden/`.

Expected package shape:

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

Use only folders that fit the package.

## Current package boundaries

- `warden-panel/`
  - Owns Warden panel-related Pi behavior.
  - Owns the panel framework, Display pane, Packages pane, pane registry, and pane action dispatch.
  - Does not own Warden runner workflows.

- `warden-flow/`
  - Owns Warden workflow/orientation Pi behavior.
  - Owns `/skill:warden-map`, map capsule injection, scoped map loading, and git context injection.
  - Does not own general runner workflows or agent lifecycle commands.

## Scope rules

- Do not put package manifests, package source, package tests, package scripts, or package build systems directly under `pi-warden/`.
- Do not mutate root `./warden` or `run-warden/` from package work unless the task explicitly scopes a cross-boundary contract.
- Do not implement `warden agents ...` or `warden pi ...` behavior in local packages.
- Keep Warden-managed Pi agent environment lifecycle behavior in `run-warden/`; package code owns package behavior, not the agent-environment bootstrap.
- Keep package behavior independently installable and testable.
- Keep package boundaries explicit when packages share APIs.

## Skill implementation rules

- Keep skills thin: model-facing workflow guidance, usage instructions, acceptance behavior, and verification expectations.
- When adding or changing a skill, check whether repeated, safety-sensitive, or testable behavior belongs in package `src/` or a sibling extension.
- Do not put deterministic behavior only in skill instructions when it can be implemented and tested.
- Put reusable deterministic logic in package `src/`.
- Use sibling extensions only when Pi lifecycle, runtime, or context-injection behavior is actually involved.
- Add or update package-local tests for deterministic package behavior when code changes.
- Do not add extensions or folders just for ceremony.

## Testing

From the repo root:

```sh
npm install --prefix pi-warden/warden-panel
npm install --prefix pi-warden/warden-flow

npm test --prefix pi-warden/warden-panel
npm test --prefix pi-warden/warden-flow

mise run test:pi-warden
```

Expectations:

- Run package-local tests for changed packages.
- Run `mise run test:pi-warden` when package-area behavior or shared assumptions change.
- Add or update package-local tests for new package behavior.
- Keep package test suites independently runnable.
- If tooling is unavailable, report exactly what could not be run and why.
- Do not claim verification unless the command actually ran.

## Documentation and orientation

Update durable docs only when existing guidance becomes stale:

- `pi-warden/README.md` for human-facing package-area explanation.
- `pi-warden/AGENTS.md` for package-area agent guidance.
- `pi-warden/<package>/README.md` for package usage, commands, APIs, and behavior.
- `pi-warden/<package>/AGENTS.md` for package-specific agent guidance.
- nearby `map.md` files for durable package orientation.

Do not add active task state, issue tracking, speculative TODO forests, or implementation diaries to `README.md`, `AGENTS.md`, or `map.md`.
