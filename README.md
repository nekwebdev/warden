# warden

Warden is a federated monorepo for a complete operating-environment workflow: OS config, framework tooling, dotfiles, runners, Pi Agent packages, dev environments, and related automation.

The primary experience is the whole monorepo: clone anywhere, run `./warden`, and let bootstrap normalize the clone into canonical `WARDEN_HOME`. Each `*-warden` subproject stays independently testable and packageable over time.

## Bootstrap quick start

```sh
git clone <repo-url> warden
cd warden
./warden
```

On first run, `./warden`:

1. Shows default `WARDEN_HOME`.
2. Moves the clone into `WARDEN_HOME` after consent.
3. Refuses to overwrite unrelated existing target directories.
4. Installs mise with consent when missing using `curl https://mise.run | sh`.
5. Delegates to `run-warden` through `mise exec`.
6. Prints welcome output.

Default `WARDEN_HOME`:

```sh
${XDG_CONFIG_HOME:-$HOME/.config}/warden
```

Use a custom home:

```sh
WARDEN_HOME=/path/to/warden ./warden
```

## NixOS active location

After bootstrap, the owner/operator NixOS config anchor is:

```sh
$WARDEN_HOME/nix-warden
```

`nix-warden` is skeleton-only in this groundwork slice; actual NixOS product behavior comes later.

## Commands

```sh
./warden              # bootstrap if needed, then show welcome
./warden doctor       # readiness checks
./warden shell status # show shell integration state
./warden shell install
./warden shell remove
./warden shell snippet bash|zsh|fish
```

Shell integration writes reversible guarded blocks only after consent:

```sh
# warden begin
...
# warden end
```

## Dev tests

Tests are for development, not required for first-time bootstrap users.

```sh
mise run test
mise run test:root
mise run test:run-warden
mise run test:nix-warden
mise run test:pi-warden
mise run test:dev-warden
```

The root suite uses Bats with temp HOME/clone fixtures to verify bootstrap movement, no-overwrite safety, doctor output, and shell integration. Subproject suites are independently runnable smoke tests.

## Subproject boundaries

- `run-warden/` owns command workflows after root bootstrap.
- `nix-warden/` will own NixOS/system configuration.
- `pi-warden/` will own Pi Agent package work.
- `dev-warden/` will own developer-environment work.

Current groundwork does not implement product features for `nix-warden`, `pi-warden`, or `dev-warden`.

## Agent guidance

Read `AGENTS.md` at repo root and within each subproject before editing. Guidance files define bootstrap boundaries, test expectations, and product-scope exclusions.

## License

MIT. See `LICENSE`.
