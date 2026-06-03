# nix-warden

`nix-warden` is the future NixOS and system-configuration package for Warden.

Current status: skeleton only. This groundwork slice creates the directory, test boundary, and agent guidance without implementing NixOS product behavior.

Canonical active path after bootstrap:

```sh
$WARDEN_HOME/nix-warden
```

## Dev test

```sh
mise run test:nix-warden
```
