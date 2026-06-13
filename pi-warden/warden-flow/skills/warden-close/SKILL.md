---
name: warden-close
description: Close an accepted Warden work packet by validating closure, creating or validating final handoff.md, and deciding changelog/map impact.
argument-hint: [packet.md or handoff.md path]
disable-model-invocation: true
license: MIT
---

# Warden Close

## When to use

Use when accepted Warden work needs final closure, or when an existing `handoff.md` should be validated before commit planning.

Use `/skill:warden-grill` or `/skill:warden-tdd` when scope, acceptance, tests, manual verification, docs, or implementation alignment still need work.

## Outcome

- `Closed`: `handoff.md` exists and accurately records closure evidence plus next safe step.
- `Not ready`: another grill, TDD, or close loop can resolve missing acceptance, tests, docs, or implementation alignment.
- `Blocked`: closure cannot safely decide because evidence is missing, repo state is unsafe, paths are invalid, or owner boundaries are unclear.

If `handoff.md` exists, validate it against the packet, repo evidence, and available conversation/tool evidence. If `handoff.md` is missing and closure evidence is sufficient, create it.

## Argument handling

Treat the skill argument as an existing `packet.md` or `handoff.md` path, not a skill-file-relative path.

Accept absolute paths and relative paths. Resolve relatives from current working directory first, then Git repository root. Never resolve against this skill directory unless the user supplied that exact absolute path.

If the path is `packet.md`, use sibling `handoff.md` as the closure path. If the path is `handoff.md`, use sibling `packet.md` when it exists.

If the argument is missing, invalid, or not named `packet.md` or `handoff.md`, stop and report `/skill:warden-close <path-to-packet.md-or-handoff.md>` as the next safe command.

If input is rough intent, recommend `/skill:warden-start`. If packet needs scope, acceptance, test, or implementation decisions, recommend `/skill:warden-grill <resolved-packet-path>`.

## Status and verdicts

Use one verdict: `Closed`, `Not ready`, or `Blocked`.

A direct `/skill:warden-close <packet-or-handoff>` invocation counts as manual acceptance only when packet and repo evidence also support closure, unless the user's message says otherwise.

## Non-goals

Do not implement code, refresh maps, stage changes, commit changes, run remote git operations, or treat rough intent as closure input.

Do not create `verify.md`, `validate.md`, `review.md`, marker files, or extra closure artifacts. `warden-close` is the validation and closure step.

## Execution tracking

When the harness exposes a plan or todo tool, mirror the top-level `## Procedure` steps in an ephemeral task list before starting. Use the tool name and schema advertised by the harness.

Track progress in the harness only. Do not create repo task files or durable work artifacts. Keep exactly one task in progress; mark each task complete immediately when its step finishes.

## Safety rules

Allowed edits:

- create missing sibling `handoff.md` next to resolved `packet.md`;
- update existing sibling `handoff.md` only when stale, incomplete, or inaccurate;
- update root `CHANGELOG.md` only when the changelog rule requires it and no valid handoff already records the decision.

Forbidden edits/actions:

- do not edit `packet.md` unless the user explicitly asks for packet correction through the active user-input workflow;
- do not edit source, tests, package docs, README, AGENTS, or maps;
- do not stage, commit, push, pull, fetch, rebase, reset, amend, tag, stash, checkout, clean, restore, or create PRs.

Expected artifact layout:

```text
.warden/work/<slug>/packet.md
.warden/work/<slug>/handoff.md
```

Never invent test results, command output, manual checks, commits, map refreshes, changelog updates, external research, or acceptance evidence. Use only conversation, repo evidence, recent tool output, or commands actually run.

Request a user decision through the active user-input workflow when closure would need an out-of-policy edit, ambiguous mutation, or owner-boundary choice.

## Context and evidence

Before closing, read packet/handoff evidence that exists, relevant repo/package guidance, and `git status --short`.

Inspect diffs, recent commits, README, AGENTS, CHANGELOG, maps, tests, or source only when needed to validate handoff claims, docs impact, changelog impact, or map impact.

Use maps as orientation only. Verify repo facts before relying on map content. Only `/skill:warden-map` updates `.warden/map.md` and `.warden/maps/**/map.md`; do not edit maps from this skill. If map freshness matters, recommend scoped `/skill:warden-map` refresh.

Use external research only when final closure depends on current external facts: upstream APIs, dependency/package-manager behavior, OS/platform behavior, licensing, security, external services, or third-party docs. Prefer official or primary sources. If research affects closure, record claim, source/source type, and decision impact in `handoff.md`.

## Procedure

### Step 1: Resolve and read

1. Resolve the argument to `packet.md` or `handoff.md`; derive sibling path.
2. Read existing packet and/or handoff end-to-end.
3. Read required guidance and inspect `git status --short`.
4. Stop with `Blocked` on invalid paths, unsafe repo state, or ambiguous dirty state.

### Step 2: Validate closure evidence

1. Confirm packet describes accepted work when packet exists.
2. Confirm current slice is complete or intentionally stopped.
3. Confirm no unresolved packet contradictions remain.
4. Confirm acceptance behavior is concrete and satisfied.
5. Confirm manual acceptance is present or implicit from invocation plus supporting evidence.
6. Confirm tests/checks are honest and skipped checks include exact reasons.
7. Confirm changed files and dirty state are accurate.

### Step 3: Validate boundaries and impact

1. Confirm changed files stay inside packet work area or are justified.
2. Confirm files-not-to-touch were not changed.
3. Identify unrelated dirty files and pre-existing state.
4. Record durable docs decision for README/AGENTS/ADR/doc work.
5. Record changelog decision: `updated` or `not needed`, with reason.
6. Record map impact: `none`, `scoped-refresh`, or `root-refresh`, with suggested `/skill:warden-map` command when needed.

### Step 4: Handle handoff

1. Leave valid existing `handoff.md` unchanged.
2. Create missing `handoff.md` when closure evidence is sufficient.
3. Update stale `handoff.md` when closure evidence is sufficient.
4. For `Not ready` or `Blocked`, do not create/update `handoff.md` unless the user requests failed-close notes through the active user-input workflow.

### Step 5: Report next step

1. Use `/skill:warden-commit` when closed and no map refresh is needed.
2. Use `/skill:warden-map <scope>` before commit when map refresh is recommended.
3. Use `/skill:warden-grill <packet>` or `/skill:warden-tdd <packet>` when not ready.
4. Use the smallest unblock action when blocked.
5. Respond with `## Output format`.

## Handoff format

When creating or updating `handoff.md`, use this shape:

```md
# Warden Handoff: <slice title>

## Close status

Closed

## Outcome

## Acceptance evidence

## Tests and checks

## Manual acceptance

## Files changed

## Commits / checkpoints

## Boundary check

## External research

## Durable docs decision

## Changelog decision

## Map impact

## Remaining risks

## Next safe step
```

Guidance: record completed outcome, acceptance evidence, commands/checks actually run, skipped checks with exact reasons, manual acceptance, changed paths, relevant local checkpoints, boundary check, external research or `None; repo-local close.`, durable-docs decision, changelog decision, map impact, remaining risks or `None known.`, and one exact next command.

## Review checklist

Before final output, verify:

- argument resolved to existing `packet.md` or `handoff.md`;
- packet and/or handoff were read before closure decisions;
- relevant guidance was read when needed;
- current git state was inspected;
- no code implementation was performed;
- no map files were edited;
- no extra closure artifacts were created;
- no tests/checks are claimed unless actually run or present in reliable prior output;
- valid existing `handoff.md` was left unchanged;
- missing or stale `handoff.md` was written only when closure evidence was sufficient;
- next safe step is exact and does not imply push or remote git work.

## Stop conditions

Return `Not ready` when packet no longer matches implementation or handoff, acceptance is vague/untestable, user feedback contradicts acceptance, or another grill/TDD/close loop can resolve missing closure evidence.

Return `Blocked` when dirty state is ambiguous, unrelated work is mixed in, paths are invalid, owner boundaries are unclear, required evidence is missing, or validation would cross forbidden boundaries.

If only a `handoff.md` path exists and sibling `packet.md` is absent, validate from handoff plus repo evidence; block only if required packet evidence is necessary and missing.

## Output format

Every final response must include the exact tracker field line:

```text
Tracker status: success | failure | aborted
Packet name: <slug>
Packet path: .warden/work/<slug>/packet.md
Status: Closed | Not ready | Blocked
Summary: Put a one-line summary
Maps: none | scoped-refresh | root-refresh
Maps scope: none | <repo-relative-scope> | root
```

Use `success` only when `Status: Closed`. Use `failure` when `Status: Not ready` or `Status: Blocked`. Use `aborted` when the user stops the workflow.

Respond in this shape:

```md
# Warden Close Result

Tracker status: success | failure | aborted
Packet name: <slug>
Packet path: .warden/work/<slug>/packet.md
Status: Closed | Not ready | Blocked
Summary: Put a one-line summary
Maps: none | scoped-refresh | root-refresh
Maps scope: none | <repo-relative-scope> | root

## Result

## Handoff

## Validation evidence

## Tests and checks

## Manual acceptance

## Changelog decision

## Map impact

## Files changed

## Next safe step
```

For `Closed`, include `handoff.md` path and whether it was unchanged, created, or updated. Offer:

```text
/skill:warden-commit
```

For `Not ready`, next safe step should usually be:

```text
/skill:warden-grill <resolved-packet-path>
```

For `Blocked`, next safe step should name the smallest unblock action.

Never claim commit, push, map refresh, tests, manual verification, or handoff edits happened unless it actually happened.
