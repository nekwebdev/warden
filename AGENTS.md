# Warden Agent Guidance

## Mission

Keep Warden's first-run monorepo experience safe, boring, testable, and easy for specialist agents to extend.

This file is project guidance for any agent working in the repository. Role-specific identity, operating style, or long-lived agent duties belong outside the repo in that agent's own config, not here.

## Current architecture

- Warden is a federated monorepo for OS config, framework tooling, dotfiles, runners, Pi Agent packages, dev environments, and related automation.
- Root `./warden` is bootstrap shim only.
- Default `WARDEN_HOME` is `${XDG_DATA_HOME:-$HOME/.local/share}/warden` unless `WARDEN_HOME` is set.
- First run may move the clone into canonical `WARDEN_HOME` after consent, then re-exec from there.
- Root bootstrap ensures mise with consent and delegates through `mise exec` to `run-warden/bin/warden`.
- `run-warden/` owns command workflows after bootstrap.
- Current delegated CLI supports welcome/help, doctor checks, shell integration, Pi agent environment creation, and Pi launch through isolated agent dirs.
- `nix-warden/`, `pi-warden/`, and `dev-warden/` are current skeleton/product-boundary placeholders unless their own guidance says otherwise.

## Root bootstrap rules

- Keep `./warden` tiny.
- Root bootstrap may require `HOME`, resolve/choose `WARDEN_HOME`, move/re-exec, ensure mise with consent, export `run-warden/bin` on PATH for delegation, and exec `run-warden/bin/warden`.
- Put workflow growth in `run-warden`, not root shell code.
- Never silently overwrite existing unknown `WARDEN_HOME` contents.
- Empty target `WARDEN_HOME` may be removed before move; non-empty unrelated target must fail with clear message.
- Ask consent before external installers, repository moves, or shell startup-file mutations.
- Preserve non-interactive safety: no TTY or declined consent must fail cleanly unless explicit env opts allow action.

## Runner rules

- Keep command dispatch in `run-warden/bin/warden`.
- Put reusable shell behavior in `run-warden/lib/*.sh`.
- Put shell-specific snippets in `run-warden/shell/`.
- Keep bash/zsh integration reversible with `# warden begin` / `# warden end` guarded blocks.
- Keep fish integration reversible with managed `conf.d/plugin-warden.fish` and `functions/warden.fish` files.
- Shell integration must require consent before mutating startup files and must avoid overwriting existing managed state unexpectedly.
- Pi agent commands must keep agent installs isolated under `WARDEN_AGENTS/<name>` or `${XDG_CONFIG_HOME:-$HOME/.config}/pi-agents/<name>`.
- `warden pi <name> ...` must run agent-local Pi with `PI_CODING_AGENT_DIR` and `PILENS_DATA_DIR` pointed inside that agent directory.

## Testing

- Use dev-only Bats tests through mise tasks.
- Prefer temp HOME/clone fixtures for bootstrap behavior.
- Keep subproject tests independently runnable.
- Add Bats coverage for every new command surface.
- Relevant tasks:
  - `mise run test`
  - `mise run test:root`
  - `mise run test:run-warden`
  - `mise run test:nix-warden`
  - `mise run test:pi-warden`
  - `mise run test:dev-warden`

## Scope boundaries

- Do not implement `nix-warden`, `pi-warden`, or `dev-warden` product features during bootstrap/runner groundwork.
- Do not add package release/build systems until later feature explicitly asks for them.
- Preserve MIT license text.
- Read subproject `AGENTS.md` before editing inside that subproject.
