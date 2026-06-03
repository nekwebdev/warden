# run-warden

`run-warden` owns Warden command workflows after root bootstrap completes. Its delegated executable is `bin/warden`.

The root `./warden` script stays tiny: it normalizes `WARDEN_HOME`, handles safety/consent gates, activates mise, and delegates to `run-warden/bin/warden`. Welcome output, doctor checks, shell integration, Pi agent environment bootstrap, and future workflow commands belong in `run-warden`.

## Pi agent commands

```sh
warden agents new [name]
warden pi <name> ...
```

`agents new` installs the registry Pi coding-agent package into the selected agent directory's local `npm/node_modules`. `pi` runs that local executable with `PI_CODING_AGENT_DIR` and `PILENS_DATA_DIR` pointed inside the agent directory.

## Dev test

```sh
mise run test:run-warden
```
