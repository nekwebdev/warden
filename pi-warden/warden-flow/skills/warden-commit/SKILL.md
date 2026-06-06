---
name: warden-commit
description: Plan safe, atomic local git commits and apply them only after exact user confirmation.
argument-hint: [optional commit focus]
license: MIT
---

<argument-handling>

- Treat user input after `/skill:warden-commit` as optional commit focus, grouping preference, or message guidance.
- Do not treat user input as commit confirmation.
- Commit confirmation must come only after the visible commit plan and must be exactly `Commit`.

</argument-handling>

<scope-gates>

Plan local commits only.

- Group commits by logical purpose, Warden boundary, and package locality.
- Pair docs/tests with behavior when they belong to the same slice.
- Do not over-split cohesive package work: skill, extension, tests, and README for one behavior can be one commit.
- Do not under-split unrelated boundaries: root bootstrap, `run-warden/`, `pi-warden/warden-flow`, sibling packages, and unrelated docs usually need separate commits.
- If safe atomic grouping is unclear, inspect targeted diffs/files or ask before planning.

</scope-gates>

<safety>

Never push, pull, fetch, amend, rebase, reset, tag, stash, checkout, clean, restore, create PRs, or run remote git operations.

`warden_commit_snapshot` is read-only. `warden_commit_apply` is the only mutation path.

`warden_commit_apply` must receive:

- `snapshotHash` from the reviewed snapshot;
- `confirmedUserIntent: "Commit"`;
- exact planned commits and exact repo-relative file paths.

`warden_commit_apply` validates current snapshot hash before mutation, stages only exact paths with argv-based `git add -- <path>`, verifies staged set before `git commit`, and creates local commits with exact provided messages.

It refuses by default for:

- missing/wrong confirmation;
- changed snapshot hash;
- unknown paths;
- absolute, traversal, glob, or pathspec-like paths;
- duplicate paths;
- risky/excluded paths such as `.env*`, secret-looking paths, `dist/**`, `node_modules/**`, cache/build/runtime output, and `.warden/work/**`;
- mixed staged/unstaged files;
- pre-existing staged changes.

`.warden/map.md` and `.warden/maps/**/map.md` are durable orientation docs and can be committed when otherwise safe. `.warden/work/**` is active slice state and excluded by default.

Never add AI attribution, `Co-authored-by`, or `Generated with ...` text.

</safety>

<context-sources>

Use `warden_commit_snapshot` as source of truth for:

- git status;
- path classification;
- warnings and risky/excluded paths;
- Warden boundaries;
- recent commit style;
- `snapshotHash`.

Inspect targeted diffs or files only when semantic grouping, commit subject/body wording, or safety warnings need more evidence.

Infer message style from `recentCommitSubjects`. If unclear, use Conventional Commits.

Commit body is developer-facing technical change narrative. `CHANGELOG.md` is curated public/operator-facing change memory. `.warden/work/**` is active slice state and excluded by default. `.warden/map.md` and `.warden/maps/**/map.md` are durable orientation context.

</context-sources>

<workflow>

1. Call `warden_commit_snapshot` before planning.
2. Review snapshot warnings, excluded files, boundaries, status buckets, and recent commit subjects.
3. Inspect targeted diffs/files only when needed for semantic grouping or message quality.
4. Build atomic commit plan with exact repo-relative paths.
5. Send full visible plan as normal assistant text before asking for confirmation. Do not call `ask_user_question`, questionnaire extension, or structured choice UI before this plan is visible.
6. Ask for final choice exactly once after the visible plan:
   - Use `ask_user_question`, questionnaire extension, or equivalent structured choice UI when available.
   - Use exactly one question, no option previews, concise text:
     - header: `Commit?`
     - question: `Apply this exact commit plan?`
     - options:
       - `Commit` — apply exact plan;
       - `Abort` — stop.
   - If no structured choice UI is available, ask the same concise question in plain text.
   - After any valid structured choice or plain-text reply, do not ask the same confirmation question again.
7. Treat only a selected option or free-form reply that is exactly `Commit` as confirmation. Custom answers, paraphrases, lowercase variants, and echoed plan text are not confirmation.
8. Only after exact `Commit`, call `warden_commit_apply` with reviewed `snapshotHash`, `confirmedUserIntent: "Commit"`, and exact planned commits/paths.
9. After apply, report commit hash(es), final `git status --short`, and remaining uncommitted files.

</workflow>

<review-checks>

Before asking for confirmation, verify plan includes:

- commit count;
- exact subject/body for every commit;
- exact repo-relative paths for every commit;
- warnings and excluded files from snapshot;
- whether diffs/files were inspected;
- reason for grouping when multiple paths or boundaries are involved.

Message checks:

- Prefer concrete subjects, for example:
  - `feat(warden-flow): add commit apply tool`
  - `feat(warden-flow): support safe local commit execution`
  - `fix(warden-flow): block risky paths during commit apply`
- Avoid vague subjects like `Add Warden commit planning support`.
- For non-trivial commits, propose body with `Why`, `What`, `Verification`, and optional `Notes`.
- Verification must list commands actually run. If not run, write `Not run` and concrete reason.

</review-checks>

<output-format>

Use this plan shape before confirmation:

```md
# Warden Commit Plan

Snapshot: <snapshotHash>

## Commits

1. `<subject>`

Body:
<exact body or "(none)">

Paths:
- `<repo-relative-path>`

Why this grouping:
- <concise rationale>

## Warnings / excluded files

- <warnings or "None">

## Diff inspection

- <what was inspected or "Snapshot only">
```

Then ask: `Apply this exact commit plan?` with `Commit` and `Abort` choices.

After apply, use:

````md
# Warden Commit Result

Created:
- `<hash>` `<subject>`

Final status:
```text
<git status --short>
```

Remaining uncommitted files:
- <path or "None">
````

</output-format>
