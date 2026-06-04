# warden-packages

`@nekwebdev/warden-packages` adds a package-manager pane to Warden's Pi Agent panel.

## Command

- `/warden:packages` — opens Warden panel on the Packages pane.

## Packages pane

The pane reads global Pi packages from `$PI_CODING_AGENT_DIR/settings.json` (`packages` array). V1 intentionally ignores project-local `.pi/settings.json` packages.

Supported package entries match Pi settings:

```json
{
  "packages": [
    "npm:@foo/bar@1.0.0",
    "git:github.com/user/repo@v1",
    "https://github.com/user/repo",
    "/absolute/path/to/package",
    "./relative/path/to/package",
    "~/home/path/to/package",
    {
      "source": "npm:@foo/bar",
      "extensions": []
    }
  ]
}
```

The first option is `Install new package`, which opens a text prompt and accepts any one-line package source; Pi's package manager validates the source. A blank line separates install from the package list section. The package list section says `Select packages to remove` until rows are selected, then `Remove selected` replaces that line and opens a confirmation dialog listing the exact sources. Rows display exact package sources only. Space/Enter toggles installed rows for removal.

After install/remove, the extension writes a concise chat report and tells the user to restart Pi to load package changes. It does not auto-reload Pi.

## Package layout

```text
warden-packages/
  package.json
  README.md
  AGENTS.md
  index.ts      # Pi manifest shim so startup list shows "warden-packages"
  src/
    index.ts
    operations.ts
    packages.ts
    pane.ts
  tests/
  scripts/
```

## Dependency

`warden-packages` integrates through `@nekwebdev/warden-panel` public pane APIs. It keeps package-manager operations out of `warden-panel`.

## Dev test

```sh
npm install --prefix pi-warden/warden-packages
npm test --prefix pi-warden/warden-packages
mise run test:pi-warden
```
