# warden-panel

`@nekwebdev/warden-panel` is Warden's Pi Agent panel framework and bundled panel package.

## Commands

- `/warden` — opens the Warden panel on the first available pane.
- `/warden:display` — opens the Warden panel on the Display pane.
- `/warden:packages` — opens the Warden panel on the Packages pane.

Pi command names are exact matches. This package does not register `/warden:settings`.

## Display pane

The Display pane manages `warden.useNerdGlyphs` in `$PI_CODING_AGENT_DIR/settings.json`. Writes preserve unrelated root keys and existing `warden` keys such as `warden.agents.<name>.cwd`.

The panel uses draft state while open. Space/Enter toggles displayed preference, Apply appears only when changes are pending and writes settings, and Esc exits without writing draft changes.

## Packages pane

The Packages pane reads global Pi packages from `$PI_CODING_AGENT_DIR/settings.json` (`packages` array). V1 intentionally ignores project-local `.pi/settings.json` packages.

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

## Pane framework

```ts
import {
  contributeWardenPane,
  contributeWardenPaneActionHandler,
} from "@nekwebdev/warden-panel";

contributeWardenPane({
  id: "example",
  label: "Example",
  order: 50,
  command: "warden:example",
  showApplyControl: false,
  itemCount: () => 1,
  render: (ctx, _width, _active) => [
    ctx.selectedIndex === 0 ? "> Run action" : "  Run action",
  ],
  handleInput: () => ({ action: "run" }),
});

contributeWardenPaneActionHandler("example", async (action, ctx) => {
  if (action.action === "run") ctx.commandContext.ui.notify("Ran action", "info");
});
```

Duplicate pane IDs are rejected. Pane registry and action-handler state is shared through `globalThis` so independently loaded Warden packages can contribute panes to the same panel. `showWardenPanel()` is exported for package commands that open the panel on a contributed pane. Pane render context includes `maxPaneLines` for scroll-window calculations.

## Package layout

```text
warden-panel/
  package.json
  README.md
  AGENTS.md
  index.ts       # aggregate local-path loader for bundled extensions
  src/
    index.ts     # public panel framework API
    commands.ts
    panel.ts
    registry.ts
    settings.ts
    glyphs.ts
  extensions/
    warden-panel/
      index.ts
    warden-display/
      index.ts
      pane.ts
    warden-packages/
      index.ts
      operations.ts
      packages.ts
      pane.ts
  tests/
  scripts/
```

`package.json` advertises bundled extensions with:

```json
{
  "pi": {
    "extensions": ["./extensions/*/index.ts"]
  }
}
```

`exports["."]` points at `./src/index.ts` so external panes can import the panel framework API from `@nekwebdev/warden-panel`.

## Scope boundary

This package owns panel-related Pi behavior: panel framework, Display pane, Packages pane, and pane action dispatch. It does not own Warden runner workflows. `warden agents new` and `warden pi <name> ...` remain owned by `run-warden/`.

## Dev test

```sh
npm install --prefix pi-warden/warden-panel
npm test --prefix pi-warden/warden-panel
mise run test:pi-warden
```
