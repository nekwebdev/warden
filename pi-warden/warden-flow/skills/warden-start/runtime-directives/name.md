# Warden Start Name Selection

Leading `warden-start` control flags are package-parsed before this turn.

- `--name <slug>` sets packet slug only; use the directive's deduced packet type.
- `--branch <type>/<slug>` sets packet type and slug from branch syntax.
- `--name` and `--branch` are mutually exclusive.
- Only leading flags are control syntax. Flag-looking tokens after rough intent are goal prose.
- Branch type must be one of `feature`, `bugfix`, `hotfix`, `release`, `docs`, `test`, or `chore`.
- Slugs use lowercase letters, numbers, and single dashes only; no slashes, underscores, uppercase, leading dashes, trailing dashes, or repeated dashes.

Use package-computed packet type, slug, branch name, cleaned rough intent, and prompt skip decisions from this directive. Do not re-parse flag prose or ask another slug/type prompt when the directive says to skip it.
