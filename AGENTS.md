# Warden Agent Guidance

Repository guidance for any coding agent working in Warden. Keep agent identity, role behavior, and personal workflow preferences outside the repo in the agent environment config.

## Instruction order

- Read this file before changing repo files.
- Before editing a subproject, read the nearest nested `AGENTS.md`.
- Nested guidance overrides root guidance for that subtree.
- Use nearby `map.md` files for orientation only.
- Do not treat `map.md` as a task plan, issue tracker, implementation diary, or current-work source of truth.

## Repository boundaries

Warden is a federated monorepo.

- `./warden`
  - Root bootstrap shim only.
  - May require `HOME`, choose/normalize `WARDEN_HOME`, move/re-exec from canonical `WARDEN_HOME` after consent, ensure `mise` after consent, export `run-warden/bin` on `PATH`, then exec `run-warden/bin/warden`.
  - Must not grow product workflows.

- `run-warden/`
  - Owns post-bootstrap command workflows.
  - Owns runner dispatch, doctor checks, shell integration, Pi agent environment lifecycle commands, and Pi launch plumbing.

- `pi-warden/`
  - Container for independently installable/testable Pi Agent packages.
  - Package code belongs under `pi-warden/<package>/`, never directly under `pi-warden/`.

- `nix-warden/`
  - Future NixOS/system-configuration area.
  - Treat as skeleton-only unless nested guidance or the task explicitly says otherwise.

- `dev-warden/`
  - Future developer-environment area.
  - Treat as skeleton-only unless nested guidance or the task explicitly says otherwise.

## Safety invariants

Preserve Warden's first-run promise:

- Safe by default.
- Consent-driven for invasive actions.
- No surprise overwrites.
- Clear failure messages.
- Easy rollback where practical.

Rules:

- Never silently overwrite unknown user files or unrelated Warden state.
- Ask consent before external installers, repo moves, or shell startup-file mutation.
- Preserve non-interactive safety: no TTY or declined consent must fail cleanly unless an explicit environment opt-in allows the action.
- Empty target `WARDEN_HOME` may be removed before a move.
- Non-empty unrelated target `WARDEN_HOME` must fail with a clear message.
- Preserve MIT license text.

## Runner and shell rules

- Keep delegated dispatch in `run-warden/bin/warden`.
- Put reusable shell behavior in `run-warden/lib/*.sh`.
- Put shell-specific snippets in `run-warden/shell/`.
- Keep bash/zsh shell integration reversible with `# warden begin` and `# warden end` guarded blocks.
- Keep fish integration reversible with managed `conf.d/plugin-warden.fish` and `functions/warden.fish` files.
- Shell integration must require consent before mutating startup files.

## Pi agent environment rules

- Pi agent environment lifecycle commands belong in `run-warden/`.
- Pi package implementation belongs in `pi-warden/<package>/`.
- Do not confuse Warden-managed Pi agent environments with local `pi-warden` package development.
- Pi agent installs must remain isolated under `WARDEN_AGENTS/<name>` or `${XDG_CONFIG_HOME:-$HOME/.config}/pi-agents/<name>`.
- `warden pi <name> ...` must run agent-local Pi with `PI_CODING_AGENT_DIR` and `PILENS_DATA_DIR` pointed inside that agent directory.

## Testing

Use mise tasks for development-only test suites:

    mise run test
    mise run test:root
    mise run test:run-warden
    mise run test:nix-warden
    mise run test:pi-warden
    mise run test:dev-warden

Expectations:

- Add or update Bats coverage for new root bootstrap behavior.
- Add or update Bats coverage for new `run-warden` command surfaces.
- Use temporary `HOME`, temporary clone fixtures, and isolated agent dirs where relevant.
- Keep subproject test suites independently runnable.
- Run the narrowest relevant test first.
- Run broader tests when a change crosses boundaries.
- If tooling is unavailable, report exactly what could not be run and why.

## Scope and docs

- Do not implement `nix-warden` or `dev-warden` product behavior during bootstrap or runner groundwork.
- Do not put package manifests, package source, package tests, or package build systems directly under `pi-warden/`.
- Do not mutate root `./warden` or `run-warden/` from package work unless the task explicitly scopes that boundary change.
- Keep cross-component interfaces explicit.

Update durable docs only when existing guidance becomes stale:

- `README.md` for human-facing usage, setup, commands, and project explanation.
- `AGENTS.md` for agent-facing rules, commands, conventions, and safety boundaries.
- Nested `AGENTS.md` for subtree-specific rules.
- `map.md` for durable folder orientation and architecture navigation.
- ADRs only for decisions that are hard to reverse, surprising, or likely to be re-litigated.

Do not add active task state, issue tracking, speculative TODO forests, or implementation diaries to `README.md`, `AGENTS.md`, or `map.md`.
