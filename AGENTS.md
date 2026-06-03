# Warden Agent Guidance

## Mission

Keep Warden's first-run monorepo experience safe, boring, and testable.

## Root bootstrap rules

- Keep `./warden` tiny.
- Root bootstrap may normalize `WARDEN_HOME`, move/re-exec, ensure mise with consent, and delegate to `run-warden`.
- Put workflow growth in `run-warden`, not root shell code.
- Never silently overwrite existing unknown `WARDEN_HOME` contents.
- Ask consent before external installers or shell startup-file mutations.

## Testing

- Use dev-only Bats tests through mise tasks.
- Prefer temp HOME/clone fixtures for bootstrap behavior.
- Keep subproject tests independently runnable.

## Scope boundaries

- Do not implement `nix-warden`, `pi-warden`, or `dev-warden` product features in bootstrap groundwork.
- Do not add package release/build systems until a later feature explicitly asks for them.
- Preserve MIT license text.
