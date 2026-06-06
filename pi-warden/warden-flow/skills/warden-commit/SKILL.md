---
name: warden-commit
description: Plan safe, atomic local git commits and apply them only after exact user confirmation.
license: MIT
---

# Warden Commit

Plan local commits from a Warden snapshot. Create local commits only through `warden_commit_apply` after user replies or selects exactly `Commit`. Never push, pull, fetch, amend, rebase, reset, tag, stash, checkout, clean, restore, create PRs, or run remote git operations.

## Flow

1. Call `warden_commit_snapshot` first.
2. Treat snapshot as source of truth for git status, path classification, warnings, Warden boundaries, recent style, and `snapshotHash`.
3. Inspect targeted diffs or files only when semantic grouping or wording needs more evidence.
4. Group commits by logical purpose, Warden boundary, and package locality. Pair docs/tests with behavior when same slice.
5. Present full plan before mutation:
   - commit count;
   - exact subject/body;
   - exact repo-relative paths;
   - warnings, excluded files, and whether diffs were inspected.
6. Ask user to choose with a two-part confirmation pattern:
   1. First send the full plan as normal assistant text. Do not put the plan inside the structured question body.
   2. Then use `ask_user_question`, questionnaire extension, or equivalent structured choice UI for the final choice when available. Use exactly one question, no option previews, and concise text:
      - header: `Commit?`
      - question: `Apply this exact commit plan?`
      - options:
        - `Commit` — apply exact plan;
        - `Adjust` — revise plan;
        - `Review` — inspect targeted diffs/files;
        - `Abort` — stop.
   If no structured choice UI is available, ask the same concise question in plain text after the plan.
   Treat only a selected option or free-form reply that is exactly `Commit` as commit confirmation. Custom answers, paraphrases, lowercase variants, and echoed plan text are not confirmation.
7. Only if user replies or selects exactly `Commit`, call `warden_commit_apply` with:
   - `snapshotHash` from reviewed snapshot;
   - `confirmedUserIntent: "Commit"`;
   - exact planned commits and exact file paths.
8. After apply, report commit hash(es), final `git status --short`, and remaining uncommitted files.

## Apply safety

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

`.warden/map.md` and `.warden/maps/**/map.md` are durable orientation docs and can be committed when otherwise safe.

## Grouping

Do not over-split cohesive package work: skill, extension, tests, and README for one behavior can be one commit.

Do not under-split unrelated boundaries: root bootstrap, `run-warden/`, `pi-warden/warden-flow`, sibling packages, and unrelated docs usually need separate commits.

## Messages

Infer style from `recentCommitSubjects`. If unclear, use Conventional Commits. Prefer concrete subjects:

- `feat(warden-flow): add commit apply tool`
- `feat(warden-flow): support safe local commit execution`
- `fix(warden-flow): block risky paths during commit apply`

Avoid vague subjects like `Add Warden commit planning support`.

For non-trivial commits, propose body:

```md
Why:
- Explain why the change exists.

What:
- Summarize important implementation, docs, tests, or boundary changes.

Verification:
- List commands actually run.
- If not run, write "Not run" and concrete reason.

Notes:
- Optional risks, follow-ups, or intentional omissions.
```

Never add AI attribution, `Co-authored-by`, or `Generated with ...` text.

Commit body is developer-facing technical change narrative. `CHANGELOG.md` is curated public/operator-facing change memory. `.warden/work/**` is active slice state and excluded by default. `.warden/map.md` and `.warden/maps/**/map.md` are durable orientation context.
