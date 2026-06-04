# pi-warden Agent Guidance

`pi-warden` is Warden's Pi Agent package area.

## Directory model

- `pi-warden/` is a container, not a Pi package.
- Each Pi package lives in its own direct child directory, for example `pi-warden/warden-panel/`.
- A Pi package may bundle multiple extensions, skills, prompts, and themes.
- Top-level `pi-warden/README.md`, `pi-warden/AGENTS.md`, and `pi-warden/tests/` describe and smoke-test the package area as a whole.
- Package manifests, package-specific docs, source, tests, scripts, extensions, skills, hooks, docs, bin, configs, or web assets belong under the individual package folder.

Expected package shape:

```text
pi-warden/<package>/
  package.json
  README.md
  AGENTS.md
  src/          # shared package code/public API when needed
  extensions/   # one or more Pi extensions when needed
  skills/       # package skills when needed
  tests/
  scripts/
```

Use only folders that fit the package.

## Rules

- Read `pi-warden/<package>/AGENTS.md` before editing inside a package.
- Do not put package manifests or source files directly at `pi-warden/` root.
- Keep each package independently installable/testable with `npm install --prefix pi-warden/<package>` and `npm test --prefix pi-warden/<package>` when it is TypeScript/npm-based.
- `warden-panel` is the current Pi package. It bundles the Warden panel command, Display pane, and Packages pane extensions while keeping shared panel framework APIs in `src/`.
- `warden agents new` / `warden pi <name> ...` is a `run-warden` workflow that installs the registry Pi package into per-agent directories; it is not the agent-environment bootstrap for `pi-warden` and not a local `pi-warden` package install.
- Do not mutate root `./warden` or `run-warden/` from package work unless a feature explicitly scopes that boundary change.

## Tests

```sh
mise run test:pi-warden
```
