---
name: warden-start
description: Start a lean Warden dev cycle by turning rough intent into one small, testable work packet.
argument-hint: [rough intent or packet.md path]
disable-model-invocation: true
license: MIT
---

# Warden Start

## When to use

Use when the user has messy intent, a narrow change request, an existing rough `packet.md`, or work that needs splitting into one small testable Warden slice.

Use this as the entry point for a lean Warden dev cycle, for example: `/skill:warden-start add warden-grill`.

## Outcome

- One lean work packet exists at `<git-root>/.warden/work/<slug>/packet.md`, or packet markdown is shown when preview/dry-run/no-edit/blocked safety applies.
- Packet has one vertical slice, concrete acceptance behavior, narrow verification, manual verification, boundaries, non-goals, and next safe step.
- Broad or unsafe work is split, reduced, or rejected.
- Late fine-tuning checkpoint completed and answers incorporated before final output.

## Argument handling

User input may be messy intent, a narrow change request, an existing rough packet path, or a request to split/reduce work.

Do not require a polished plan. Shape messy intent into one safe slice. If input points to an existing `packet.md`, tighten that packet instead of creating a new path unless unsafe.

If input is rough intent, choose a short lowercase slug from user intent using hyphens. Report packet paths as `.warden/work/<slug>/packet.md`, relative to Git repository root.

Canonical packet root:

- discover Git repository root from current cwd first;
- create or update packets only under `<git-root>/.warden/work/**` when cwd is inside a Git repository;
- if invoked from nested cwd with no explicit path, write under Git repository root, not nested cwd;
- do not write `.warden/work/**` under nested cwd unless that cwd is itself a separate Git repository;
- if cwd is not inside a Git repository, fail clearly unless explicit standalone path behavior is supported by repo evidence;
- do not use Warden home paths or environment-specific roots.

## Non-goals

Do not create PRDs, issue trackers, lifecycle state machines, broad roadmaps, implementation diaries, or ADRs by default.

Add an ADR only when the decision is pivotal, expensive to reverse, surprising, or likely to be reargued.

Do not put task state in `README.md`, `AGENTS.md`, or map files. Do not edit `.warden/map.md` or `.warden/maps/**/map.md`; only `/skill:warden-map` updates maps. Do not continue into implementation.

## Execution tracking

When the harness exposes a plan or todo tool, mirror the top-level `## Procedure` steps in an ephemeral task list before starting. Use the tool name and schema advertised by the harness.

Track progress in the harness only. Do not create repo task files or durable work artifacts. Keep exactly one task in progress; mark each task complete immediately when its step finishes.

## Safety rules

Default behavior when file-editing tools are available:

- create or update `<git-root>/.warden/work/<slug>/packet.md`;
- create `<git-root>/.warden/work/<slug>/` first when needed;
- output packet markdown instead of writing only when the user asks for preview/dry run, environment cannot edit files, or implementation safety is blocked.

Slice rules:

- prefer one small vertical slice with concrete acceptance behavior;
- keep packet lean enough for a coding agent to execute next;
- include narrow automated test strategy where possible;
- include manual verification even when automated tests exist;
- identify clear work area, likely files, and files not to touch;
- make non-goals explicit;
- end with a next safe step for a coding agent;
- split or reject broad requests spanning unrelated boundaries, owners, packages, or runtimes.

Request early clarification through the active user-input workflow only when implementation safety, canonical path, or boundary choice is truly blocked. Otherwise state assumptions and continue until the late fine-tuning checkpoint.

## Context and evidence

Use local repository evidence for repo facts: structure, commands, tests, boundaries, docs, and implementation behavior. Inspect enough repo evidence, maps, and docs to make safe boundary assumptions; do not over-research.

Maps are orientation only; they are not task plans, issue trackers, or implementation artifacts. Map information may be stale. Use capsules as hints only. If map freshness matters, recommend `/skill:warden-map` for the relevant scope. If packet depends on current repo facts, instruct the coding agent to inspect repository files before editing.

Use external research only when packet depends on facts outside the repository or facts likely to have changed: current upstream APIs, dependency behavior, package manager behavior, OS/platform behavior, licensing, security guidance, or external services. Prefer official or primary sources. Do not browse to rediscover local repo facts. If research affects the packet, record what needed research, source/source type, decision impact, and whether implementation should verify again before editing.

## Runtime directives

Matching Warden Flow runtime directives are invocation-scoped guidance. They may change interaction mechanics for this turn, but never override safety rules, stop conditions, files-not-to-touch, or higher-priority instructions.

## Interaction model

After draft packet passes review checks and before final output, run a late fine-tuning checkpoint through the active user-input workflow.

Once the packet appears ready, request at least two fine-tuning questions through the active user-input workflow before finalizing. Do not skip this checkpoint because assumptions feel obvious.

Each question should include a recommended answer and 2-4 concise options when answer choices fit. Aim questions at slice boundaries, acceptance wording, files not to touch, test/manual verification emphasis, and deferred non-goals.

Incorporate answers into `packet.md`, then re-run review checks.

## Procedure

### Step 1: Resolve root and mode

1. Resolve canonical Git repository root and packet path.
2. Determine whether the user wants a new packet, an existing packet tightened, or a broad request split/rejected.
3. Stop or request user input through the active user-input workflow only when path, safety, or boundary choice is blocked.

### Step 2: Gather bounded evidence

1. Inspect enough repo evidence, maps, and docs to make safe boundary assumptions.
2. Use external research only under `## Context and evidence`.
3. Avoid exhaustive repository scanning.

### Step 3: Shape one slice

1. Choose one small vertical slice.
2. State assumptions instead of blocking unless implementation safety is truly blocked.
3. Make explicit non-goals and files not to touch.
4. Split or reject broad requests that cross unrelated boundaries, owners, packages, or runtimes.

### Step 4: Draft packet

Create or refine packet markdown using the exact section set in `## Packet format`.

### Step 5: Fine-tune before finalizing

1. Once the packet appears ready, request at least two fine-tuning questions in one checkpoint through the active user-input workflow.
2. Wait for answers.
3. Incorporate answers into `packet.md`.
4. Re-run review checks.

### Step 6: Write and report

1. Write packet to `<git-root>/.warden/work/<slug>/packet.md` unless preview/dry-run/no-edit/blocked safety applies.
2. Respond with `# Warden Start Result`.
3. Offer `/skill:warden-grill <repo-root>/.warden/work/<slug>/packet.md` as next action.

## Packet format

Create or refine packet markdown with this exact section set:

```md
# <Slice Title>

## Intent

## Non-goals

## Current slice

## Acceptance behavior

## Work area

## Likely files

## Files not to touch

## Test strategy

## Manual verification

## Boundary notes

## Map freshness notes

## External research notes

## Decisions

## Next safe step
```

Section guidance:

- `Intent`: one-paragraph rough goal in user language.
- `Non-goals`: explicit exclusions and deferred adjacent work.
- `Current slice`: one vertical behavior slice, not a roadmap.
- `Acceptance behavior`: observable outcomes, concrete enough to test.
- `Work area`: narrow repo/package boundary for edits.
- `Likely files`: probable files to inspect or edit; mark uncertain entries.
- `Files not to touch`: protected boundaries, maps, generated files, secrets, unrelated packages.
- `Test strategy`: narrow automated checks where possible; say when none fit.
- `Manual verification`: human-visible check or command output to inspect.
- `Boundary notes`: primary agent, expected cwd, owned work area, handoffs, package locality, and rejected cross-boundary work.
- `Map freshness notes`: map hints used, stale-risk, and whether `/skill:warden-map` is recommended.
- `External research notes`: research need, source/source type, decision impact, and reverify-before-editing call; use `None; repo-local slice.` when no external research is needed.
- `Decisions`: assumptions and chosen splits; keep brief.
- `Next safe step`: first concrete action for the coding agent.

## Review checklist

Before finishing, verify packet has:

- one small vertical slice, not a roadmap;
- concrete observable acceptance behavior;
- explicit non-goals;
- narrow work area and likely files;
- files not to touch, including protected boundaries, maps, generated files, secrets, and unrelated packages;
- automated test strategy where possible, or clear reason none fits;
- manual verification with human-visible check or command output to inspect;
- boundary notes covering primary agent, expected cwd, owned work area, handoffs, package locality, and rejected cross-boundary work;
- map freshness notes, including stale-risk and whether `/skill:warden-map` is recommended;
- external research notes, using `None; repo-local slice.` when no external research is needed;
- assumptions and chosen splits under `Decisions`;
- first concrete coding-agent action under `Next safe step`;
- at least two packet-ready fine-tuning questions requested through the active user-input workflow and answers incorporated.

For prose-only `SKILL.md` or docs edits, prefer manual read/verification over markdown prose assertion tests. Reserve automated tests for runtime behavior, package contracts, or existing tested invariants.

## Stop conditions

Stop or preview without writing when canonical root cannot resolve, packet path would escape `<git-root>/.warden/work/**`, implementation safety is blocked, user requested dry run/preview, environment cannot edit files, or the request cannot be reduced to one safe slice.

## Output format

Every final response must include the exact tracker field line:

```text
Tracker status: success | failure | aborted
```

Use `success` only when a real `packet.md` path is ready for the next Warden Flow step. Use `failure` when blocked, preview-only, or no usable packet path exists. Use `aborted` when the user stops the workflow. Do not emit a tracker `nextStep`; the extension owns next-step state.

Respond in this shape:

```md
# Warden Start Result

Tracker status: success | failure | aborted
Packet path:
Packet action:

## Summary

## Assumptions

## Boundary call

## Packet

<packet markdown or written-file note>

## Next action
```

When packet file is written, keep `## Packet` to a written-file note unless the user asks to see full content. When writing is skipped for preview, dry run, no file-editing tools, or blocked safety, put full packet markdown in `## Packet`.

Offer next action: `/skill:warden-grill <repo-root>/.warden/work/<slug>/packet.md`.
