# Warden Start Prompt Selection

Use package-computed selection metadata before drafting packet path or asking slug/type/branch questions.

Current branch context matching `<type>/<slug>` with a valid type and slug is authoritative: set packet type from prefix, slug from suffix, skip slug confirmation, and skip create/switch branch prompt. If the branch has a valid type prefix but invalid slug, stop clearly before writing a packet.

On `main` or unrelated branches, deduce packet type from goals using the current `warden worktree` type set: `feature`, `bugfix`, `hotfix`, `release`, `docs`, `test`, `chore`. Do not show a type menu.

Use directive prompt skip decisions exactly. If the directive says not to skip a prompt, keep normal `warden-start` interaction behavior. If it says to skip a prompt, do not ask that prompt again.

Slug format: lowercase letters, numbers, and single dashes only; no slashes, underscores, uppercase, leading dashes, trailing dashes, or repeated dashes.
