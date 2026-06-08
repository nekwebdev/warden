# warden-theme Agent Guidance

Package-local guidance for `pi-warden/warden-theme/`.

## Scope

`@nekwebdev/warden-theme` owns Warden's Pi theme resources and palette inventory docs.

Keep this package independently loadable with:

```sh
pi -e ./pi-warden/warden-theme
```

Do not add Warden runner workflows, Pi agent lifecycle commands, shell integration, or terminal OSC probing here.

## Theme maintenance

- Treat Pi `docs/themes.md` plus installed built-in theme schema as source evidence for required theme tokens.
- Keep `themes/warden-catppuccin-mocha.json` complete for all current required Pi `colors` tokens.
- Keep palette intent Catppuccin Mocha explicit-RGB-first: define vars with official Mocha hex values, use text/subtext/overlay vars for readable foreground hierarchy, use surface/mantle/crust vars for dark transparent backgrounds, and reserve accent hues for states, markdown, syntax, thinking borders, and bash mode.
- Document Pi-supported color value forms plus the Catppuccin Mocha variable inventory.
- Update `README.md` token inventory whenever required Pi theme tokens change.

## Tests

Run package-local validation after changes:

```sh
npm test --prefix pi-warden/warden-theme
```

Run package-area smoke after changing package manifests, package list docs, or shared assumptions:

```sh
mise run test:pi-warden
```
