# pi-warden

`pi-warden` owns Warden's Pi Agent extension package work.

This directory is a container for Pi extension packages. Each extension lives in its own child folder:

```text
pi-warden/
  README.md
  AGENTS.md
  tests/
  warden-panel/
    package.json
    README.md
    AGENTS.md
    index.ts    # optional Pi entry shim when src/index.ts would display poorly
    src/
    tests/
    scripts/
```

Current extension packages:

- `warden-panel/` — package `@nekwebdev/warden-panel`, Warden configuration panel framework for Pi Agent.

Future Pi extension packages should use the same shape: package manifest and package-specific docs/guidance at the extension folder root, then code and assets in folders such as `src/`, `tests/`, `skills/`, `hooks/`, `docs/`, `bin/`, `configs/`, `scripts/`, or `web/` as needed. If Pi loads a local path package from `src/index.ts`, startup may label it `src`; use a root `index.ts` shim when package-folder display is desired.

## Scope boundary

`run-warden/` owns `warden agents new` and `warden pi <name> ...`. Those commands install and launch registry Pi Agent in isolated agent directories. They are not implemented by local `pi-warden` extension packages.

Extension packages in this directory provide Pi Agent package behavior only after installed/loaded by Pi. They must not mutate root bootstrap or runner workflows unless a feature explicitly scopes that change.

## Dev test

```sh
npm install --prefix pi-warden/warden-panel
npm test --prefix pi-warden/warden-panel
mise run test:pi-warden
```
