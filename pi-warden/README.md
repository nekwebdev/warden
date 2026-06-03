# pi-warden

`pi-warden` is the future Pi Agent package, extension, and tooling area for Warden.

Current status: skeleton only. This groundwork slice creates the directory, test boundary, and agent guidance without implementing Pi Agent package behavior.

The `warden agents new` and `warden pi <name> ...` agent-environment bootstrap workflow is owned by `run-warden`; it installs the registry package `@earendil-works/pi-coding-agent` into per-agent directories and is not a local `pi-warden` package install.

## Dev test

```sh
mise run test:pi-warden
```
