# pi-warden Agent Guidance

`pi-warden` is the future Pi Agent package, extension, and tooling area.

Current status: skeleton only.

## Rules

- Do not implement Pi Agent package behavior in bootstrap groundwork.
- Keep this subproject independently testable.
- Add product code only when a later feature explicitly scopes it.
- `warden agents new` / `warden pi <name> ...` is a `run-warden` workflow that installs the registry Pi package into per-agent directories; it is not the agent-environment bootstrap for `pi-warden` and not a local `pi-warden` package install.

## Tests

```sh
mise run test:pi-warden
```
