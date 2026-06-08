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

- `warden-flow/`
  - Owns Warden workflow/orientation Pi behavior.
  - Owns `/skill:warden-map`, map capsule injection, scoped map loading, and git context injection.
  - Owns `/skill:warden-docs` for stale durable doc alignment when map freshness is current.
  - Owns `/skill:warden-start`, `/skill:warden-grill`, `/skill:warden-tdd`, and `/skill:warden-close` workflow skills.
  - Owns `/skill:warden-commit`, commit snapshot/apply tools, and local commit safety rules.
  - Owns `/warden:effort` and per-skill effort defaults for Warden Flow skills.
  - Declares `@nekwebdev/warden-panel` as its package dependency for Effort pane contribution through the public panel API.
  - Does not own general runner workflows or agent lifecycle commands.

- `warden-panel/`
  - Owns Warden panel-related Pi behavior.
  - Owns the panel framework, Display pane, Packages pane, pane registry, and pane action dispatch.
  - Does not own Warden runner workflows.

- `warden-subagents/`
  - Owns Warden's future Pi subagents extension package home.
  - Current scaffold owns only package identity and a synchronous no-op extension factory.
  - Does not own Agent runtime, background execution, RPC behavior, worktree isolation, runner workflows, or agent lifecycle commands.

- `warden-theme/`
  - Owns Warden Catppuccin Mocha-derived Pi theme resources.
  - Owns `themes/warden-catppuccin-mocha.json`, theme token inventory docs, and theme validation.
  - Does not own Warden runner workflows, agent lifecycle commands, or terminal OSC probing.

## Scope rules

- Do not put package manifests, package source, package tests, package scripts, or package build systems directly under `pi-warden/`.
- Do not mutate root `./warden` or `run-warden/` from package work unless the task explicitly scopes a cross-boundary contract.
- Do not implement `warden agents ...` or `warden pi ...` behavior in local packages.
- Keep Warden-managed Pi agent environment lifecycle behavior in `run-warden/`; package code owns package behavior, not the agent-environment bootstrap.
- Keep package behavior independently installable and testable.
- Keep package boundaries explicit when packages share APIs.
- When one Warden package imports another Warden package API, declare that dependency in the importing package manifest.

## Skill implementation rules

- Keep skills thin: model-facing workflow guidance, usage instructions, acceptance behavior, and verification expectations.
- When adding or changing a skill, check whether repeated, safety-sensitive, or testable behavior belongs in package `src/` or a sibling extension.
- Do not put deterministic behavior only in skill instructions when it can be implemented and tested.
- Put reusable deterministic logic in package `src/`.
- New `warden-*` skills need default effort settings seeded through the owning package code under `warden.effort.skills`.
- Companion extension behavior should account for configured effort before the skill runs when skill runtime behavior depends on Pi thinking level.
- Use sibling extensions only when Pi lifecycle, runtime, or context-injection behavior is actually involved.
- Add or update package-local tests for deterministic package behavior when code changes.
- Do not add extensions or folders just for ceremony.

## Warden skill template

Future Warden skills should start from this shape. Keep every body tag present, even when a tag is empty for a narrow skill.

```md
---
name: warden-example
description: Specific workflow description plus when to use it.
argument-hint: [type of argument 1, type of argument 2, ...]
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

- `name`, `description`, and `license` follow the Agent Skills frontmatter shape used by `warden-grill`.
- `argument-hint` documents expected `/skill:<name>` arguments. Pi currently treats it as metadata for skills; do not rely on autocomplete display unless Pi adds skill support.
- Add extra body tags only when the skill truly needs them; any clear tag name may be used when it captures relevant, repeated structure for that skill.
- Good optional tag candidates include `<inputs>`, `<state-files>`, `<decision-points>`, `<handoff>`, and `<failure-modes>`.
- Keep deterministic, repeated, safety-sensitive, or testable behavior in package code instead of only in template prose.

## Testing

From the repo root:

```sh
npm install --prefix pi-warden/warden-panel
npm install --prefix pi-warden/warden-flow
npm install --prefix pi-warden/warden-subagents

npm test --prefix pi-warden/warden-panel
npm test --prefix pi-warden/warden-flow
npm test --prefix pi-warden/warden-subagents

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
