---
name: warden-commit
description: Plan safe local git commits from the current workspace and apply them only after plan approval.
argument-hint: [optional commit focus]
disable-model-invocation: true
license: MIT
---

# Warden Commit

## When to use

Use when the user wants current local Git changes inspected, grouped into atomic commits, and optionally committed locally after reviewing the exact plan.

## Outcome

- Without approval: a diff-backed commit plan, no mutation.
- With approval: the exact reviewed plan committed locally, with commit hashes and remaining workspace state reported.
- When unsafe: a clear blocker and next safe step.

## Argument handling

User-provided arguments may guide workspace focus, path scope, grouping, subject wording, or body wording.

Arguments never authorize applying commits. Only an invocation-scoped hidden Warden Flow auto directive with an exact package-generated structured consent marker may authorize skipping the second approval prompt, and only after all normal snapshot and safety checks pass.

Pi skill command arguments arrive after the `</skill>` block as user text. Do not rely on `$ARGUMENTS`, `$0`, or `$1` substitution inside this file.

## Non-goals

Do not implement changes, clean the workspace, repair the repo, create PRs, write changelogs, create task artifacts, or perform remote/destructive Git operations.

## Execution tracking

When the harness exposes a plan or todo tool, mirror the top-level `## Procedure` steps in an ephemeral task list before starting. Use the tool name and schema advertised by the harness.

Track progress in the harness only. Do not create repo task files or durable work artifacts. Keep exactly one task in progress; mark each task complete immediately when its step finishes.

## Safety rules

- Use `warden_commit_snapshot` before planning.
- Inspect exact content for every planned path, including untracked files.
- Show the full plan before requesting approval through the active user-input workflow.
- Use `warden_commit_apply` as the only mutation path.
- Never manually stage files or run `git commit`.
- Never push, pull, fetch, rebase, reset, amend, tag, stash, checkout, clean, restore, or create PRs.
- Apply only the exact visible plan: same `snapshotHash`, subjects, bodies, and repo-relative paths.
- If workspace state changes after planning, discard the plan, take a new snapshot, and rebuild.
- Exclude risky, excluded, hidden, generated, secret-looking, dependency, runtime-output, active work-packet, or unrelated paths unless snapshot evidence and user intent make them safe.
- Never add AI attribution, `Co-authored-by`, or `Generated with ...` text.
- Never claim tests, checks, approval, commits, or manual verification happened unless they actually happened in this run or are present in reliable prior evidence.

## Context and evidence

Use `warden_commit_snapshot` for changed files, warnings, excluded paths, boundaries, suggested buckets, recent commit subjects, and `snapshotHash`.

Use targeted diffs and file reads for semantic grouping, safety, and commit message wording. Use overview diffs only as supporting context, never as sole evidence for non-trivial changes.

Infer commit message style from recent commit subjects in the snapshot. If unclear, fall back to `feat|fix|chore|docs|refactor|test(scope): short text` style.

## Tool contract

`warden_commit_snapshot` is read-only. It does not authorize mutation.

`warden_commit_apply` may run only after the user clearly approves the exact visible plan. Call it with only:

- reviewed `snapshotHash`;
- exact planned commits;
- exact repo-relative file paths.

Useful inspection commands:

```sh
git diff -- <path>
git diff -- <path1> <path2> ...
git diff --stat -- <paths>
git diff --name-status -- <paths>
git diff --staged --name-status
```

For untracked text files, use `read` or:

```sh
git diff --no-index -- /dev/null <path>
```

`git diff --no-index` exits `1` when differences exist; that is expected.

## Approval policy

For non-auto mode, print the full plan as a normal assistant response first, then request a user decision through the active user-input workflow. For valid auto mode, build the same full plan, skip the second approval prompt only when every auto safety condition passes, and include the exact applied plan in the result. Do not put the plan inside the user-input prompt.

Question text:

```text
Apply this exact commit plan?
```

Approval must clearly and unconditionally accept the exact visible plan, unless valid auto consent applies. Ambiguous, conditional, partial, edited, or questioning replies are not approval. If not approved and no valid auto consent applies, revise, abort, or request one clarifying answer through the active user-input workflow; do not apply.

## Procedure

### Step 1: Snapshot

1. Call `warden_commit_snapshot`.
2. Review changed files, warnings, excluded paths, Warden boundaries, suggested buckets, recent commit subjects, and `snapshotHash`.
3. Stop on safety blockers or unclear workspace state.

### Step 2: Inspect

1. Inspect every path that may be committed.
2. For large diffs, inspect bounded chunks until grouping, safety, and message wording are supported by evidence.
3. Request user input through the active user-input workflow only when grouping, focus, message intent, or scope remains unclear after inspection.

### Step 3: Plan

1. Group files by logical purpose, Warden boundary, and package locality.
2. Keep one cohesive slice together when docs, tests, implementation, and package docs belong to the same change.
3. Split unrelated boundaries into separate commits.
4. Use the snapshot's recent commit subjects as the first source for subject style.
5. If recent subjects do not show a clear style, fall back to `feat|fix|chore|docs|refactor|test(scope): short text`.
6. Use concrete subjects.
7. For non-trivial commits, include a body with `Why`, `What`, and `Verification`.
8. In `Verification`, list commands actually run or `Not run — <reason>`.

### Step 4: Review

Show or record the full plan with:

- `snapshotHash`;
- each commit subject;
- exact body or `(none)`;
- exact repo-relative paths;
- warnings or excluded files;
- diff inspection performed;
- grouping reason when useful.

### Step 5: Request approval or validate auto consent

Request `Apply this exact commit plan?` through the active user-input workflow unless valid auto consent applies. Do not apply unless approval is clear and unconditional, or the current hidden Warden Flow auto directive has a valid package-generated consent marker and its auto-apply safety conditions pass.

### Step 6: Apply

If approved or valid auto consent applies, call `warden_commit_apply` with the reviewed `snapshotHash`, exact planned commits, and exact repo-relative file paths.

### Step 7: Report

Report created commit hashes, final `git status --short`, remaining uncommitted files, or the exact blocker/tool refusal.

## Review checklist

Before calling `warden_commit_apply`, confirm:

- snapshot ran;
- every planned path was inspected;
- full plan was visible to the user, or valid auto mode will include the exact applied plan in the result;
- approval came after the visible plan, or valid auto consent applies;
- approval clearly accepted the exact visible plan, or valid auto consent applies;
- tool arguments exactly match the reviewed plan;
- no excluded, risky, hidden, generated, or unrelated paths are included;
- no manual staging or `git commit` command was used.

## Stop conditions

Stop without applying when:

- snapshot reports blockers;
- workspace state is unclear or changed after planning;
- planned paths are unsafe or uninspected;
- grouping or message intent remains unclear;
- approval is missing or ambiguous and no valid auto consent applies;
- `warden_commit_apply` refuses the plan.

## Output format

### Plan

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
- <concise rationale or "Single logical change.">

## Warnings / excluded files

- <warnings or "None">

## Diff inspection

- <commands, files, or chunks inspected>

## Next step

Request approval through the active user-input workflow with `Apply this exact commit plan?`, or apply through `warden_commit_apply` when valid auto consent applies and every auto safety condition passed.
```

### Result

````md
# Warden Commit Result

Status: Applied | Planned | Blocked

## Result

## Created

- `<hash>` `<subject>`

## Final status

```text
<git status --short>
```

## Remaining uncommitted files

- <path or "None">

## Next safe step
````
