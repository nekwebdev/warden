# nix-warden Agent Guidance

`nix-warden` is the future NixOS/system-configuration package.

Current status: skeleton only.

## Rules

- Do not implement NixOS product behavior in bootstrap groundwork.
- Preserve `$WARDEN_HOME/nix-warden` as the canonical active config path.
- Keep tests independently runnable from the subproject task.

## Tests

```sh
mise run test:nix-warden
```
