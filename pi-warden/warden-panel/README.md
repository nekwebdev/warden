# warden-panel

`@nekwebdev/warden-panel` is Warden's Pi Agent configuration panel framework.

## Commands

- `/warden` — opens the Warden panel on the built-in Settings pane.
- `/warden:settings` — explicit alias for the same Settings pane.

Pi command names are exact matches, so both aliases are registered separately.

## Settings

The built-in Settings pane manages `warden.useNerdGlyphs` in `$PI_CODING_AGENT_DIR/settings.json`. Writes preserve unrelated root keys and existing `warden` keys such as `warden.agents.<name>.cwd`.

The panel uses draft state while open. Space/Enter toggles displayed preference, Apply appears only when changes are pending and writes settings, and Esc exits without writing draft changes.

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
  index.ts      # Pi manifest shim so startup list shows "warden-panel"
  src/
    index.ts
    commands.ts
    panel.ts
    registry.ts
    settings.ts
    glyphs.ts
    panes/
  tests/
  scripts/
```

## Scope boundary

This package does not implement package-manager behavior, dependency installers, MCP config mutation, or Warden runner changes. Package-manager panes belong in sibling packages such as `@nekwebdev/warden-packages`. `warden agents new` and `warden pi <name> ...` remain owned by `run-warden/`.

## Dev test

```sh
npm install --prefix pi-warden/warden-panel
npm test --prefix pi-warden/warden-panel
mise run test:pi-warden
```
