# pi-warden Agent Guidance

`pi-warden` is Warden's Pi Agent extension package area.

## Directory model

- `pi-warden/` is a container, not an extension package.
- Each extension package lives in its own direct child directory, for example `pi-warden/warden-panel/`.
- Top-level `pi-warden/README.md`, `pi-warden/AGENTS.md`, and `pi-warden/tests/` describe and smoke-test the extension area as a whole.
- Package manifests, package-specific docs, source, tests, scripts, skills, hooks, docs, bin, configs, or web assets belong under the individual extension folder.

Expected extension package shape:

```text
pi-warden/<extension>/
  package.json
  README.md
  AGENTS.md
  src/
  tests/
  scripts/
```

Use only folders that fit the extension.

## Rules

- Read `pi-warden/<extension>/AGENTS.md` before editing inside an extension package.
- Do not put extension package manifests or source files directly at `pi-warden/` root.
- Keep each extension independently installable/testable with `npm install --prefix pi-warden/<extension>` and `npm test --prefix pi-warden/<extension>` when it is TypeScript/npm-based.
- `warden agents new` / `warden pi <name> ...` is a `run-warden` workflow that installs the registry Pi package into per-agent directories; it is not the agent-environment bootstrap for `pi-warden` and not a local `pi-warden` package install.
- Do not mutate root `./warden` or `run-warden/` from extension package work unless a feature explicitly scopes that boundary change.

## Tests

```sh
mise run test:pi-warden
```
