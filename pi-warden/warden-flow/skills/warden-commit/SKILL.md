---
name: warden-commit
description: Plan safe local git commits from the current workspace and apply them only after plan approval.
argument-hint: [optional commit focus]
license: MIT
---

# Warden Commit

<scope-gates>

## When to use

Use this when the user wants to inspect current local Git changes, plan atomic commits, and optionally apply the exact reviewed plan.

Do not use this for pushing, pulling, rebasing, amending, branch switching, stash work, PR creation, workspace cleanup, repo repair, or creating new changes.

## Outcome

A reviewed, diff-backed commit plan that groups the current workspace changes into safe atomic local commits.

If plan approved, the repository has those exact commits applied locally, with commit hashes and remaining workspace state reported.

</scope-gates>

<argument-handling>

## Inputs and arguments

Use:

- user-provided skill arguments, when present
- current Git workspace
- `warden_commit_snapshot` tool output
- targeted diff or file inspection
- user approval or rejection after the visible plan

User-provided skill arguments may guide target Git workspace, focus, grouping, paths, subject wording, or body wording.

Arguments guide planning only. They never authorize apply.

Pi skill commands append arguments after the `</skill>` block as normal user text. Do not rely on `$ARGUMENTS`, `$0`, or `$1` substitution inside this file.

</argument-handling>

<safety>

## Rules

- Plan local commits only.
- Use `warden_commit_snapshot` before planning.
- Use `warden_commit_apply` as the only mutation path.
- Never manually stage files or run `git commit`.
- Never push, pull, fetch, rebase, reset, amend, tag, stash, checkout, clean, restore, or create PRs.
- Inspect exact content for every planned path, including untracked files.
- Show the full plan before asking for approval.
- Apply only the exact visible plan; no hidden files, path changes, or message changes.
- If the workspace changes after planning, take a new snapshot and rebuild the plan.
- Never add AI attribution, `Co-authored-by`, or `Generated with ...` text.
- Never claim tests or verification commands ran unless they actually ran.

</safety>

<context-sources>

Use the current Git workspace, `warden_commit_snapshot`, targeted diffs, file reads, and user approval or rejection after the visible plan.

</context-sources>

<workflow>

## Procedure

Use an ephemeral todo list when the harness provides one. Do not create repo task files or durable work artifacts.

### Step 1: Snapshot

1. Call the `warden_commit_snapshot` tool.
2. Review changed files, warnings, excluded paths, boundaries, suggested buckets, recent commit subjects, and `snapshotHash`.
3. Stop on safety blockers such as risky paths, excluded paths, mixed staged and unstaged files, unsafe staged files, or unclear workspace state.
4. Ask only when grouping, focus, message intent, or scope is unclear.

### Step 2: Inspect diffs

1. Inspect every path that may be committed.
2. Use overview commands only as supporting context, never as the only evidence for non-trivial changes.
3. For large diffs, inspect bounded chunks until enough evidence exists for safety, grouping, and message wording.

Preferred tracked-file command:

```sh
git diff -- <path>
```

For related tracked files:

```sh
git diff -- <path1> <path2> ...
```

For overview only:

```sh
git diff --stat -- <paths>
git diff --name-status -- <paths>
```

For untracked text files, use `read` or:

```sh
git diff --no-index -- /dev/null <path>
```

`git diff --no-index` exits `1` when differences exist; that is expected.

For staged renames:

```sh
git diff --staged --name-status
```

### Step 3: Plan commits

1. Group files by logical purpose, Warden boundary, and package locality.
2. Keep one cohesive slice together when docs, tests, implementation, and package docs belong to the same change.
3. Split unrelated boundaries into separate commits.
4. Match recent commit style when clear; otherwise prefer Conventional Commits.
5. Use concrete subjects.
6. For non-trivial commits, include a body with `Why`, `What`, and `Verification`.
7. In `Verification`, list commands actually run or `Not run — <reason>`.

### Step 4: Show plan

Show the full plan before asking for approval.

The plan must include:

- `snapshotHash`
- each commit subject
- exact body or `(none)`
- exact repo-relative paths
- warnings or excluded files
- diff inspection performed
- grouping reason when useful

If the workspace changes after the plan is shown, discard the plan, take a new snapshot, and rebuild.

### Step 5: Ask user

Request a user decision through the active agent or harness user-input workflow.

Question text:

```text
Apply this exact commit plan?
```

Treat the reply as approval only when it clearly and unconditionally accepts the exact visible plan without edits, conditions, questions, or partial selection.

Any other reply means do not apply. Revise, abort, or ask one clarifying question.

### Step 6: Apply

If approved, call `warden_commit_apply` with:

- reviewed `snapshotHash`
- exact planned commits
- exact repo-relative file paths

### Step 7: Report

After apply, report:

- created commit hash or hashes
- final `git status --short`
- remaining uncommitted files

If apply fails, report the tool refusal or error and the next safe step.

</workflow>

<review-checks>

Before calling `warden_commit_apply`, confirm the full plan was visible, approval came after that plan through the active user-input workflow, snapshot hash still matches the visible plan, and every tool argument exactly matches the reviewed plan.

</review-checks>

<output-format>

## Plan format

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
```

After showing the plan, request the user decision through the active agent or harness user-input workflow:

```text
Apply this exact commit plan?
```

## Result format

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
