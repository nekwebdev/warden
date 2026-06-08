# warden-theme Agent Guidance

Package-local guidance for `pi-warden/warden-theme/`.

## Scope

`@nekwebdev/warden-theme` owns Warden's Pi theme resources and terminal color inventory docs.

Keep this package independently loadable with:

```sh
pi -e ./pi-warden/warden-theme
```

Do not add Warden runner workflows, Pi agent lifecycle commands, shell integration, or terminal OSC probing here.

## Theme maintenance

- Treat Pi `docs/themes.md` plus installed built-in theme schema as source evidence for required theme tokens.
- Keep `themes/warden-terminal.json` complete for all current required Pi `colors` tokens.
- Keep palette intent ANSI/default-first: use `""` for default text-like tokens and named vars for terminal-dependent ANSI indexes `0-15` where possible.
- Document “terminal-derived” as Pi-referenceable terminal/default/palette values, not active terminal palette probing.
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
