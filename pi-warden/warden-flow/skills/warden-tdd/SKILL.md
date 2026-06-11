---
name: warden-tdd
description: Implement one grilled Warden work packet slice with strict test-first workflow.
argument-hint: [packet.md path]
disable-model-invocation: true
license: MIT
---

# Warden TDD

## When to use

Use when the user provides one existing Warden `packet.md` that is ready for one safe, test-first implementation slice.

## Outcome

- Ready packet implemented through RED → GREEN → TRIANGULATE → REFACTOR.
- `packet.md` updated only with compact `## TDD Evidence`.
- Checks, manual verification, files changed, and next safe step reported.
- Unsafe or under-specified packets stopped before target-file edits.

## Argument handling

Treat the skill argument as the packet path. Require an existing file named `packet.md`.

Accept absolute paths and relative paths. Resolve relative paths from current working directory first, then Git repository root. Never resolve against this skill directory unless the user supplied that exact absolute path.

If no valid packet path is provided, stop and report `/skill:warden-tdd <path-to-packet.md>` as the next safe command.

Use the resolved path for first read, scope checks, evidence updates, reporting, and next-step references.

## Non-goals

Do not implement runner workflows, agent lifecycle commands, subagents, model override cascades, broad orchestration, or work outside the packet slice.

Do not rewrite packet scope, acceptance behavior, safety guidance, docs decisions, files-not-to-touch, or ownership guidance while continuing TDD. If those need changes, stop and send the packet back to `/skill:warden-grill` unless the user explicitly changes the task to packet revision.

## Execution tracking

When the harness exposes a plan or todo tool, mirror the top-level `## Procedure` steps in an ephemeral task list before starting. Use the tool name and schema advertised by the harness.

Track progress in the harness only. Do not create repo task files or durable work artifacts. Keep exactly one task in progress; mark each task complete immediately when its step finishes.

## Safety rules

- Read the resolved packet end-to-end before editing any target file.
- Read repository and package guidance required by the packet's work area before editing target files.
- Inspect `git status --short` and record preexisting dirty paths before editing target files.
- Treat preexisting dirty paths as user work unless the packet explicitly names them and user intent is clear.
- Request a user decision through the active user-input workflow before touching any preexisting dirty path not clearly in scope.
- Keep edits inside packet work area and outside files-not-to-touch.
- Use maps only as orientation; verify repo facts before relying on them.
- Do not edit `.warden/map.md` or `.warden/maps/**/map.md`.
- Never claim tests, builds, manual checks, or verification ran unless they actually ran.

## Packet readiness

Before implementation, confirm the packet has:

- one small vertical slice;
- concrete acceptance behavior;
- narrow automated test strategy, or clear reason no automated test fits;
- manual verification steps;
- safety and files-not-to-touch guidance;
- docs decision clarity;
- work area narrow enough to avoid unrelated owners.

Do not require a magic grilled marker or exact status text. Judge readiness from content.

Stop before target-file edits when scope, acceptance, tests, manual verification, safety, docs, or ownership are missing, unresolved, contradictory, or too broad.

## Context and evidence

Use the packet as the primary task source. Use repository files, required guidance, package manifests, scripts, existing tests, nearby source/docs, and current `git status --short` as supporting evidence.

Use external research only when implementation depends on current upstream APIs, dependency behavior, OS/platform behavior, licensing, security guidance, external services, or third-party docs. Prefer official or primary sources. Do not browse to rediscover local repo facts.

Test commands come from the packet first, then nearest package guidance, then repo guidance. If commands conflict, prefer nearest applicable guidance and report the choice.

Append or update only `## TDD Evidence` in `packet.md` as work proceeds.

## Procedure

### Step 1: Resolve and gate

1. Resolve and read the packet end-to-end.
2. Read required repo/package guidance.
3. Inspect `git status --short` and record preexisting dirty paths.
4. Apply `## Safety rules` and `## Packet readiness`.
5. Stop before target-file edits if the packet is not one safe implementable slice.

### Step 2: Inspect

1. Inspect only enough code, docs, and tests to choose the smallest verification surface.
2. Stop and request a user decision through the active user-input workflow if repo evidence contradicts the packet or requires a scope decision.

### Step 3: RED

1. Choose the smallest automated check that can fail for the packet's acceptance behavior.
2. Add or update only that failing check.
3. Run the narrow command from the packet or nearest guidance.
4. Confirm failure for the expected reason.
5. Record command plus expected failure in `## TDD Evidence`.

If the packet clearly explains no automated test fits, do not invent a fake test. Record the reason in `## TDD Evidence`, then use required existing validation or manual checks.

### Step 4: GREEN

1. Implement the smallest valid code/docs change for the acceptance behavior.
2. Run the narrow check again.
3. Confirm it passes.
4. Record command/result in `## TDD Evidence`.

### Step 5: TRIANGULATE

1. Add one focused contrast, edge, or example when first green could be overfit, acceptance has a boundary, or a second example proves general behavior.
2. Run it red, make it green, and record the example plus result.
3. If triangulation adds no value or broadens scope, record that decision instead.

### Step 6: REFACTOR

1. With checks green, inspect changed surface for duplication, unclear names, poor seams, or avoidable coupling.
2. Refactor only to improve design without changing behavior.
3. Rerun the narrow check and record the result.
4. If no refactor is needed, record why.

### Step 7: Validate and report

1. Repeat only for additional acceptance behavior already inside the packet slice.
2. Run broader tests only when the packet or guidance requires them, or when changed surface affects shared assumptions.
3. Manually verify the packet's human-visible checks and record the outcome in `## TDD Evidence`.
4. Report using `## Output format`.

## Review checklist

Before final response, confirm:

- packet and required guidance were read before target edits;
- preexisting dirty paths were recorded and protected;
- edits stayed inside packet work area and outside files-not-to-touch;
- packet scope was not silently revised;
- `packet.md` edits were limited to `## TDD Evidence`;
- RED happened before implementation when automated testing fit;
- narrow check passed after implementation;
- triangulation and refactor were done or skipped with recorded reasons;
- broader tests and manual verification ran, or skipped with exact reasons;
- result reports only commands/checks actually run.

## Stop conditions

Stop without target-file edits when:

- no valid `packet.md` path was provided;
- packet quality gates fail;
- ownership, safety, docs, tests, or manual verification expectations are unresolved;
- repo evidence contradicts the packet;
- requested changes cross forbidden boundaries;
- preexisting dirty paths would be touched without clear scope and user intent;
- tests fail for unexpected reasons that need packet or user decisions.

## Output format

Every final or stopped response must include these exact tracker field lines:

```text
Tracker status: success | failure | aborted
Packet name: <slug>
Packet path: .warden/work/<slug>/packet.md
Summary: Put a one-line summary
```

Use `success` only when the packet slice is correctly implemented or intentionally validated with accepted no-code evidence. Use `failure` when blocked, under-specified, tests fail, or implementation is incomplete. Use `aborted` when the user stops the workflow.

Respond in this shape:

```md
# Warden TDD Result

Tracker status: success | failure | aborted
Packet name: <slug>
Packet path: .warden/work/<slug>/packet.md
Summary: Put a one-line summary

## Result

## Files changed

## Tests run

## Tests skipped + reasons

## Manual verification

## Next safe step

If changes are required after manual verification:

`/skill:warden-grill <resolved-packet-path>`

If packet is correctly implemented:

`/skill:warden-close <resolved-packet-path>`
```

For stopped work, use the same shape and put the blocker in `## Result`.
