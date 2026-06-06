# nix-warden

`nix-warden/` is Warden's future NixOS and system-configuration area.

Current scope: skeleton only. It preserves the canonical config location and smoke-test surface for future system-configuration work; no NixOS product workflow is implemented here yet.

Canonical future active path after bootstrap:

```sh
$WARDEN_HOME/nix-warden
```

## Development tests

```sh
mise run test:nix-warden
```
