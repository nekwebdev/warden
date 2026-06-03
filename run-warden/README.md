# run-warden

`run-warden` owns Warden command workflows after root bootstrap completes.

The root `./warden` script stays tiny: it normalizes `WARDEN_HOME`, handles safety/consent gates, activates mise, and delegates here. Welcome output, doctor checks, shell integration, and future workflow commands belong in `run-warden`.

## Dev test

```sh
mise run test:run-warden
```
