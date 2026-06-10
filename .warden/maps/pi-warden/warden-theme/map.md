# Warden Map: pi-warden/warden-theme

Reviewed: 2026-06-10
Scope: pi-warden/warden-theme
Evidence basis: package README/AGENTS; `package.json`; theme JSON; test script; package test; bounded git history.
Git basis: main@6ebda02
Parent map: .warden/map.md

<!-- warden-map:inject:start -->
## Agent Quick Context

- Purpose: `@nekwebdev/warden-theme` owns Warden's Pi theme package with one complete Catppuccin Mocha-derived dark theme, `warden-catppuccin-mocha`.
- Boundaries: Theme resources live under `themes/`; tests under `tests/`; package docs/guidance at root. No runner workflows, Pi agent lifecycle commands, shell integration, terminal OSC probing, Nix, or dev-env behavior belongs here.
- Safe edits: Keep `package.json` `pi.themes` pointed at `./themes`; keep `themes/warden-catppuccin-mocha.json` complete for current Pi color tokens; update README token inventory when theme tokens change.
- Verification: Run `npm test --prefix pi-warden/warden-theme`; broader package-area check is `mise run test:pi-warden`.
- Sharp edges: Use Pi `docs/themes.md` and installed built-in theme schema as token evidence. Prefer explicit Catppuccin Mocha hex vars, readable text/subtext/overlay foregrounds, dark surface/mantle/crust backgrounds, and accent hues for states/markdown/syntax/thinking/bash.
<!-- warden-map:inject:end -->

## Scope Purpose

`pi-warden/warden-theme/` packages Warden's Pi Agent theme resources. It contributes a Catppuccin Mocha-derived dark theme through Pi package theme loading and documents the token inventory required to maintain it.

Maps are orientation only and do not override repo or package `AGENTS.md` instructions.

## Local Structure

| Path | Role | Notes |
|---|---|---|
| `package.json` | npm/Pi manifest | Package name `@nekwebdev/warden-theme`; advertises `pi.themes: ["./themes"]`. |
| `themes/warden-catppuccin-mocha.json` | Theme resource | Complete Pi theme with Catppuccin Mocha vars and token mappings. |
| `README.md` | Human docs | Loading instructions, palette intent, Pi color value forms, var list, token inventory, verification. |
| `AGENTS.md` | Agent guidance | Theme maintenance rules, source evidence, and scope fences. |
| `tests/theme-package.test.mjs` | Package validation | Verifies manifest/resource/theme package expectations. |
| `scripts/run-tests.mjs` | Test runner | Checks expected test file then runs Node test runner. |
| `LICENSE` | Package license | MIT package license file. |

## Local Entry Points

- Development load from repo root: `pi -e ./pi-warden/warden-theme`.
- Direct theme-file load: `pi --theme ./pi-warden/warden-theme/themes/warden-catppuccin-mocha.json`.
- Pi settings UI: load package, open `/settings`, select `warden-catppuccin-mocha`.
- Package manifest resource: `pi.themes` points to `./themes`.

## Local Conventions

- Theme name is `warden-catppuccin-mocha`.
- Theme JSON defines official Catppuccin Mocha hex values in `vars` and references those vars from `colors` and `export`.
- Palette intent is explicit-RGB-first for dark transparent terminals.
- Use text/subtext/overlay vars for readable foreground hierarchy.
- Use surface/mantle/crust vars for quiet panels and backgrounds.
- Reserve accent hues for selected UI, labels, markdown, diffs, syntax, thinking borders, and bash mode.
- Avoid bright state backgrounds; tool backgrounds should stay on surface colors so accents and important text remain readable.
- README token inventory should remain aligned with every current Pi theme token and supported color value form.

## Dependencies and Integration Points

- No runtime Warden package dependency is declared.
- Pi package loader consumes `pi.themes` from `package.json` and loads theme JSON from `themes/`.
- Theme schema URL in JSON points at Pi theme schema under the upstream Pi repository.
- Package guidance treats Pi `docs/themes.md` plus installed built-in theme schema as source evidence for required tokens.
- Package-area smoke tests verify this package folder, manifest, theme dir, and theme file as part of `mise run test:pi-warden`.

## Verification for This Scope

Primary:

- `npm test --prefix pi-warden/warden-theme`

Broader after package list, manifest, or shared package-area changes:

- `mise run test:pi-warden`
- `mise run test`

Manual visual check after theme token or palette changes:

1. Run `pi -e ./pi-warden/warden-theme` from repo root.
2. Open `/settings`.
3. Select `warden-catppuccin-mocha`.
4. Inspect core UI, markdown, tool states, diffs, syntax highlighting, thinking borders, and bash-mode border.

## Safe Edit Notes

- Do not add runner lifecycle, shell integration, agent commands, Nix, or dev-env product behavior here.
- Do not add terminal OSC probing here.
- Keep `themes/warden-catppuccin-mocha.json` complete for current Pi required `colors` tokens.
- Update README palette/token inventory when adding/removing/renaming tokens.
- Preserve Catppuccin Mocha source values and variable intent unless a theme decision explicitly changes palette.
- Keep package independently loadable and testable.

## Recent Evolution from Git History

Recent commits added `@nekwebdev/warden-theme`, added package lock, and switched the theme to Catppuccin Mocha resources. Package-area docs and smoke tests now include `warden-theme` as a direct Pi package.

## Open Questions

No package-internal open question found. Future token changes should start from current Pi theme docs/schema evidence before editing theme JSON or README inventory.
