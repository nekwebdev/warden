# warden-panel

`@nekwebdev/warden-panel` is Warden's Pi Agent configuration panel framework.

## Commands

- `/warden` — opens the Warden panel on the built-in Settings pane.
- `/warden:settings` — explicit alias for the same Settings pane.

Pi command names are exact matches, so both aliases are registered separately.

## Settings

The built-in Settings pane manages `warden.useNerdGlyphs` in `$PI_CODING_AGENT_DIR/settings.json`. Writes preserve unrelated root keys and existing `warden` keys such as `warden.agents.<name>.cwd`.

The panel uses draft state while open. Space/Enter toggles displayed preference, Apply writes settings, and Esc/Close exits without writing draft changes.

## Pane framework

```ts
import { contributeWardenPane } from "@nekwebdev/warden-panel";

contributeWardenPane({
  id: "example",
  label: "Example",
  order: 50,
  command: "warden:example",
  itemCount: () => 0,
  render: (_ctx, _width, _active) => ["Example pane"],
});
```

Duplicate pane IDs are rejected.

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

This package does not implement package-manager behavior, dependency installers, MCP config mutation, or Warden runner changes. `warden agents new` and `warden pi <name> ...` remain owned by `run-warden/`.

## Dev test

```sh
npm install --prefix pi-warden/warden-panel
npm test --prefix pi-warden/warden-panel
mise run test:pi-warden
```
