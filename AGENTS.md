# Warden Agent Guidance

Repository-wide guidance for any coding agent working in Warden. Keep agent identity, role behavior, and personal workflow preferences outside the repo in agent environment config.

## Instruction order

- Read this file before changing repo files.
- Route by touched subtree below, then read each relevant nested `AGENTS.md` before edits.
- If a package or nested area has another `AGENTS.md`, read the nearest one too.
- Nested guidance overrides root guidance for that subtree.
- Use nearby `map.md` files for orientation only.
- Do not treat `map.md` as a task plan, issue tracker, implementation diary, or current-work source of truth.
- Do not invent missing `AGENTS.md` files; use the nearest existing guidance when no nested file exists.

## Subproject router

When a task touches these paths or concerns, read the matching nested guidance:

- `run-warden/`: command dispatch, doctor checks, shell integration, Pi agent environment lifecycle, Pi launch plumbing, runner tests.
- `pi-warden/`: Pi Agent packages, package-area docs/tests, skills, extensions, prompts, themes; for package edits, also read `pi-warden/<package>/AGENTS.md`.
- `nix-warden/`: NixOS or system-configuration work.
- `dev-warden/`: developer-environment work.

For cross-subproject work, read every relevant nested `AGENTS.md` before editing.

## Repository boundaries

Warden is a federated monorepo.

- `./warden` stays a small bootstrap shim: require `HOME` when needed, choose/normalize `WARDEN_HOME`, move/re-exec from canonical `WARDEN_HOME` after consent, ensure `mise` after consent, export `run-warden/bin` on `PATH`, then exec `run-warden/bin/warden`; it must not grow product workflows.
- `run-warden/` owns post-bootstrap command workflows and Warden-managed Pi agent environments.
- `pi-warden/` is a package container; package code lives under `pi-warden/<package>/`, never directly under `pi-warden/`.
- `nix-warden/` is the NixOS/system-configuration boundary; treat as skeleton unless nested guidance or the task says otherwise.
- `dev-warden/` is the developer-environment boundary; treat as skeleton unless nested guidance or the task says otherwise.

Keep cross-component interfaces explicit. Do not move behavior across boundaries unless the task explicitly scopes that change.

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

## Testing

Use mise tasks for development-only test suites:

```sh
mise run test
mise run test:root
mise run test:run-warden
mise run test:nix-warden
mise run test:pi-warden
mise run test:dev-warden
```

Expectations:

- Run the narrowest relevant test first.
- Run broader tests when a change crosses boundaries.
- Add or update focused coverage for new behavior in the touched subtree.
- Add or update Bats coverage for new root bootstrap behavior.
- Use temporary `HOME`, temporary clone fixtures, and isolated agent dirs where relevant.
- Keep subproject test suites independently runnable.
- If tooling is unavailable, report exactly what could not be run and why.
- Do not claim verification unless the command actually ran.

## Scope and docs

- Do not add product behavior to `nix-warden/` or `dev-warden/` as bootstrap, runner, or package collateral.
- Do not put package manifests, package source, package tests, or package build systems directly under `pi-warden/`.
- Keep Warden-managed Pi agent lifecycle behavior in `run-warden/`; keep Pi package implementation in `pi-warden/<package>/`.
- Do not mutate another subtree unless the task explicitly scopes that cross-boundary contract.

Update durable docs only when existing guidance becomes stale:

- `README.md` for human-facing usage, setup, commands, and project explanation.
- `AGENTS.md` for agent-facing rules, commands, conventions, and safety boundaries.
- Nested `AGENTS.md` for subtree-specific rules.
- `map.md` for durable folder orientation and architecture navigation.
- ADRs only for decisions that are hard to reverse, surprising, or likely to be re-litigated.

Do not add active task state, issue tracking, speculative TODO forests, or implementation diaries to `README.md`, `AGENTS.md`, or `map.md`.
