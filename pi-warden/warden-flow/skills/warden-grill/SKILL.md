---
name: warden-grill
description: Grilling session that challenges your warden work packet against the existing domain model, sharpens terminology, and updates it inline as decisions crystallise. Use when user wants to stress-test a warden work packet, including manual feedback from a prior TDD/manual-review pass, against project language and evidence.
argument-hint: [work packet.md path, manual feedback]
disable-model-invocation: true
license: MIT
---

# Warden Grill

## When to use

Use when the user provides an existing Warden `packet.md` that needs pressure-testing before `/skill:warden-tdd`, including manual feedback from a prior TDD or manual-review pass.

Use `/skill:warden-start` when the input is rough intent instead of an existing packet.

## Outcome

- Packet updated inline as decisions crystallise.
- Manual feedback interrogated against packet, repo evidence, implementation evidence, tests, safety, and docs.
- One unresolved decision handled at a time, with a recommended answer.
- Final output only after packet is TDD-ready and final adversarial questions are complete.
- Unsafe or untestable packet stopped with exact blocker.

## Argument handling

Treat the first argument as the packet path. Treat all remaining argument text as optional manual feedback evidence for that packet.

Require an existing file named `packet.md`. Resolve absolute paths directly. Resolve relative paths from current working directory first, then Git repository root. Never resolve against this skill directory unless the user supplied that exact absolute path.

If no valid packet path is provided, stop and report `/skill:warden-grill <path-to-packet.md> [manual feedback]` as the next safe command.

If no manual feedback text is supplied, first request a user decision through the active user-input workflow on whether to start grilling or collect manual feedback. Use exactly these options: `Start grilling` and `Manual feedback on the packet`. If the user chooses `Manual feedback on the packet`, request that feedback through the active user-input workflow and wait before reviewing.

Use the resolved packet path and manual feedback for reads, inline updates, final output, and next-step command.

## Non-goals

Do not implement code, run TDD, create commits, edit maps, edit README, edit AGENTS, edit package docs, or edit source files unless the user explicitly redirects.

Do not shape rough intent into a packet; recommend `/skill:warden-start`.

## Execution tracking

When the harness exposes a plan or todo tool, mirror the top-level `## Procedure` steps in an ephemeral task list before starting. Use the tool name and schema advertised by the harness.

Track progress in the harness only. Do not create repo task files or durable work artifacts. Keep exactly one task in progress; mark each task complete immediately when its step finishes.

## Safety rules

- Default edit target is only the resolved packet.
- Treat implementation evidence as read-only.
- Request a user decision through the active user-input workflow before any file mutation outside the packet.
- Use maps only as orientation; verify repo facts before relying on them.
- Only `/skill:warden-map` updates `.warden/map.md` and `.warden/maps/**/map.md`.
- Use extra caution for shell execution, filesystem mutation, installers, network calls, auth/secrets, permissions, agent lifecycle, external tools, dependency loading, commit/apply behavior, map writing, and generated files.
- Recommend stronger verification or a smaller slice when risk is high.

## Context and evidence

Use repo guidance, relevant README files, maps, tests, code, docs, and diffs only as needed to verify packet claims or manual feedback. Maps are stale orientation hints unless verified. If map freshness matters, recommend scoped `/skill:warden-map` refresh.

Manual feedback evidence is first-class context. Compare it against packet acceptance, implementation evidence, tests, safety, and docs, then adjust the packet into the next smallest TDD-ready slice.

When feedback references current implementation behavior, inspect only enough code, tests, docs, or diffs to verify the claim before requesting user input.

Use external research only when packet or feedback depends on current upstream APIs, dependency behavior, package manager behavior, OS/platform behavior, licensing, security guidance, external service behavior, or third-party docs. Prefer official or primary sources.

## Decision policy

Be relentless but useful:

- challenge terminology that conflicts with maps, relevant `README.md`, or `AGENTS.md`;
- sharpen vague or overloaded terms by proposing a canonical term;
- use concrete edge scenarios to expose boundary mistakes;
- cross-reference live code when user claims how behavior works;
- surface packet/code/doc contradictions immediately;
- treat manual feedback as evidence to interrogate, not instructions to copy blindly.

Request one unresolved decision at a time through the active user-input workflow and wait for feedback. If repo evidence can answer a question, inspect evidence instead of requesting user input.

Walk dependency order: terminology, boundaries, acceptance, tests, safety, docs, then implementation slice.

## Procedure

### Step 1: Resolve and choose mode

1. Resolve and read the packet.
2. Reject rough intent and recommend `/skill:warden-start`.
3. Determine feedback mode from remaining argument text.
4. If no feedback exists, request `Start grilling` vs `Manual feedback on the packet` through the active user-input workflow and wait.
5. If manual feedback is chosen, request it through the active user-input workflow and wait before reviewing.

### Step 2: Gather evidence

1. Inspect repo evidence only when needed to verify packet claims or feedback.
2. Inspect before requesting user input when evidence can answer the question.
3. Use external research only under `## Context and evidence`.

### Step 3: Grill and update

1. Interrogate manual feedback against packet and implementation evidence when present.
2. Require one small vertical implementation pass.
3. Flag and shrink broad roadmaps, unrelated packages/runtimes, root + runner + package mixtures, docs/process work disguised as implementation, vague “improve everything” work, and unverifiable acceptance.
4. Request one blocker answer at a time, with your recommended answer, through the active user-input workflow.
5. Update the packet inline immediately when an aspect resolves; do not batch edits.
6. Continue until non-budget review checks pass or the packet cannot be made safe/testable.

### Step 4: Final adversarial round

1. Do not finalize when the packet first appears ready.
2. Request two to four additional substantive adversarial answers after readiness, one at a time, with your recommended answer, through the active user-input workflow.
3. Do not count startup mode choice, raw feedback collection, or earlier blocker questions as final adversarial questions.
4. Use final questions to hunt hidden weakness in terminology, boundaries, acceptance, test strategy, safety, durable docs, and manual verification.
5. If an answer reveals a blocker, update the packet, resolve the blocker, confirm readiness again, then continue remaining final questions.

### Step 5: Report

1. Finish only when all unresolved questions are answered and final adversarial round is complete.
2. Use `## Output format`.
3. Offer `/skill:warden-tdd <resolved-packet-path>` as next step.

## Review checklist

Before final output, verify:

- one vertical implementation pass with clear boundary and likely files;
- no mixed ownership unless explicitly justified;
- observable acceptance behavior;
- narrow automated tests where possible, with no invented commands;
- broad “run all tests” is not the sole strategy when narrower tests exist;
- human-visible manual verification, not only repeated automated tests;
- current external facts researched from primary sources when needed;
- maps treated as stale orientation unless verified;
- durable docs included only when acceptance or boundary clarity needs them;
- README, AGENTS, maps, and packet roles kept distinct;
- packet judged TDD-ready before final adversarial questions;
- final adversarial answers were requested through the active user-input workflow and received after readiness.

## Stop conditions

Stop when no valid `packet.md` was provided, input is rough intent, packet cannot become one small safe TDD slice, acceptance cannot be tested or manually verified, safety needs user decision or smaller scope, repo evidence contradicts packet, or user chooses to stop.

## Output format

Every final or stopped response must include the exact tracker field line:

```text
Tracker status: success | failure | aborted
```

Use `success` only when the packet is solid for TDD. Use `failure` when the packet is blocked, unsafe, not TDD-ready, or missing. Use `aborted` when the user stops the workflow. Do not emit a tracker `nextStep`; the extension owns next-step state.

During the loop, use the active user-input workflow for one next question with your recommended answer, or output a brief note that the packet was updated before the next question. Do not finalize when the packet first appears ready; request adversarial answers through the active user-input workflow first.

Only when no unresolved questions remain and the adversarial round is complete, use this final shape:

```md
# Warden Grill

Tracker status: success | failure | aborted
Verdict: Packet solid for TDD

## Slice check

## Acceptance check

## Verification check

## External research check

## Map check

## Durable-docs check

## Next safe step

`/skill:warden-tdd <resolved-packet-path>`
```
