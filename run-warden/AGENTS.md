# run-warden Agent Guidance

`run-warden` owns Warden commands after root bootstrap delegates through mise.

## Rules

- Keep command dispatch in `bin/run-warden`.
- Put reusable behavior in `lib/*.sh`.
- Put shell-specific activation snippets in `shell/`.
- Keep shell integration reversible with `# warden begin` / `# warden end` guarded blocks.
- Keep consent gates before shell startup-file mutation.
- Avoid moving bootstrap-location logic back into root `./warden` unless it is part of normalization/delegation.

## Tests

Run:

```sh
mise run test:run-warden
```

Add Bats coverage for every new command surface.
