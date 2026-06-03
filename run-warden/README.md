# run-warden

`run-warden` owns Warden command workflows after root bootstrap completes. Its delegated executable is `bin/warden`.

The root `./warden` script stays tiny: it normalizes `WARDEN_HOME`, handles safety/consent gates, activates mise, and delegates to `run-warden/bin/warden`. Welcome output, doctor checks, shell integration, and future workflow commands belong in `run-warden`.

## Dev test

```sh
mise run test:run-warden
```
