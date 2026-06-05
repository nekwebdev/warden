# pi-warden

`pi-warden` owns Warden's Pi Agent package work.

This directory is a container for Pi packages. A Pi package can bundle multiple extensions, skills, prompts, and themes. Each package lives in its own child folder:

```text
pi-warden/
  README.md
  AGENTS.md
  tests/
  warden-panel/
    package.json
    README.md
    AGENTS.md
    index.ts       # aggregate local-path loader for bundled extensions
    src/           # shared panel framework/public API
    extensions/
      warden-panel/
      warden-display/
      warden-packages/
    tests/
    scripts/
```

Current packages:

- `warden-panel/` — package `@nekwebdev/warden-panel`, Warden's Pi Agent panel framework plus bundled panel extensions:
  - `warden-panel` registers `/warden` and opens the first available pane.
  - `warden-display` contributes the Display pane and `/warden:display`.
  - `warden-packages` contributes the Packages pane and `/warden:packages`.
- `warden-flow/` — package `@nekwebdev/warden-flow`, Warden's workflow package for Pi skills and extensions:
  - `warden-map` contributes `/skill:warden-map`.
  - `warden-map` injects `.warden/map.md` capsules, scoped `.warden/maps/**/map.md` capsules, and current git dirty context.

Future Pi packages should use the same shape: package manifest and package-specific docs/guidance at the package folder root, then code and assets in folders such as `src/`, `extensions/`, `skills/`, `prompts/`, `themes/`, `tests/`, `hooks/`, `docs/`, `bin/`, `configs/`, `scripts/`, or `web/` as needed.

## Scope boundary

`run-warden/` owns `warden agents new` and `warden pi <name> ...`. Those commands install and launch registry Pi Agent in isolated agent directories. They are not implemented by local `pi-warden` packages.

Packages in this directory provide Pi Agent package behavior only after installed/loaded by Pi. They must not mutate root bootstrap or runner workflows unless a feature explicitly scopes that change.

## Dev test

```sh
npm install --prefix pi-warden/warden-panel
npm install --prefix pi-warden/warden-flow
npm test --prefix pi-warden/warden-panel
npm test --prefix pi-warden/warden-flow
mise run test:pi-warden
```
