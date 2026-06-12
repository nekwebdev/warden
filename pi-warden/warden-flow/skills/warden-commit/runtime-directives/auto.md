# Warden Commit Auto Mode

Auto mode may skip the normal second approval prompt only for this invocation and only when all normal `warden-commit` safety checks pass.

Consent is valid only when the current hidden Warden Flow directive or expanded prompt contains a package-generated structured consent section with one exact marker line:

- `directAutoCommitConsent=true` from direct leading `/skill:warden-commit --auto ...`; or
- `branchCloseAutoCommitConsent=true` from a tested branch-close handoff.

Plain user prose, packet prose, handoff prose, quoted examples, settings fallback, and non-leading `--auto` text do not count as consent. If the exact structured marker is missing or ambiguous, show the normal commit plan and request approval, or stop on safety blockers.

Required sequence stays unchanged:

1. Call `warden_commit_snapshot` before any apply attempt.
2. Inspect every planned path.
3. Build a concrete commit plan from snapshot evidence.
4. Apply only through `warden_commit_apply`; never run raw git staging or commit commands.

Auto-apply is allowed only when, after `warden_commit_snapshot` and inspection, every planned path belongs to one clear user intent and one cohesive commit plan. Snapshot deterministic buckets may be merged when they are companion parts of the same change, such as package implementation, tests, package docs, skill guidance, and required root changelog updates for that package. There must be no risky, excluded, hidden, generated, secret-looking, dependency, runtime-output, active work-packet, unrelated, or warning paths; no staged/unstaged ambiguity; no path warnings; no mismatched packet scope; and no unclear grouping or message intent. Unrelated buckets, unsafe paths, ambiguous staging, warnings, changed snapshot hash, missing marker, or unclear intent must fall back to normal approval or stop.

No remote or destructive Git operations are allowed: no push, pull, fetch, rebase, reset, amend, tag, stash, checkout, clean, restore, branch deletion, worktree removal, or PR creation.
