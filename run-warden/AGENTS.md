# run-warden Agent Guidance

`run-warden` owns Warden commands after root bootstrap delegates to `bin/warden` through mise.

## Rules

- Keep command dispatch in `bin/warden`.
- Put reusable behavior in `lib/*.sh`.
- Put shell-specific activation snippets in `shell/`.
- Keep bash/zsh integration reversible with `# warden begin` / `# warden end` guarded blocks; keep fish integration reversible with managed `conf.d/plugin-warden.fish` and `functions/warden.fish` files.
- Keep consent gates before shell startup-file mutation.
- Avoid moving bootstrap-location logic back into root `./warden` unless it is part of normalization/delegation.

## Tests

Run:

```sh
mise run test:run-warden
```

Add Bats coverage for every new command surface.
