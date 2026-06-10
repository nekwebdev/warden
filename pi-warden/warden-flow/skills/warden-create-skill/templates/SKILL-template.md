---
name: <skill-name>
# Status: mandatory
# The stable skill identifier. Use lowercase letters, numbers, and hyphens.

description: <when this skill should be used>
# Status: mandatory
# Short activation-oriented summary used by the model or runner to decide when this skill applies.

argument-hint: <optional invocation hint>
# Status: optional
# Brief hint for accepted arguments, paths, modes, or freeform guidance.

# disable-model-invocation: true
# Status: optional / conditional
# Include only when the skill must be manually invoked, especially for mutation, commit, deploy, send, delete, publish, or apply workflows.

license: <license>
# Status: optional
# License metadata when the package or runner expects it.
---

# <Skill Title>

## Template use

Status: generator guidance

Use this file as a category palette for creating skills.

Generated `SKILL.md` output should keep only:

- mandatory frontmatter fields;
- mandatory sections with concrete content;
- optional sections relevant to the skill;
- default content blocks that apply to the skill.

Generated output should strip:

- `Status:` labels;
- placeholder text;
- comments;
- generator guidance;
- unused optional headings;
- examples that do not prevent real misuse.

## When to use

Status: mandatory

State the situation, user intent, or workflow moment that should trigger this skill.

## Outcome

Status: mandatory

State what the user, repo, artifact, service, or agent should have when the skill finishes.

## Inputs

Status: optional

List the arguments, files, tools, repo state, pasted text, external resources, or user context the skill uses.

## Argument handling

Status: optional

Explain how invocation arguments are parsed, resolved, defaulted, interpreted, or rejected.

Include this when paths, modes, freeform text, or trailing user input matter.

## Preconditions

Status: optional

List what must already be true before the skill can proceed safely.

Use this for required files, clean repo state, accepted plans, existing credentials, configured tools, prior workflow steps, or trusted project state.

## Modes

Status: optional

Describe distinct execution paths, such as plan/apply, create/update, read/write, inspect/fix, preview/write, or validate/close.

## Status and verdicts

Status: optional

Define named outcomes the skill may return, such as `Ready`, `Blocked`, `Not ready`, `Closed`, `No changes`, or `Failed`.

Use this when final status affects the next workflow step.

## Non-goals

Status: optional

Name adjacent work the skill must not absorb.

Use this to prevent roadmap creep, implementation during planning, docs edits during code work, remote operations during local workflows, or unrelated package changes.

## Acceptance criteria

Status: optional

Define observable behavior or evidence that proves the skill outcome is good enough.

Use this when the skill creates or validates implementation work, handoffs, packets, plans, docs, or test results.

## Rules

Status: optional

List compact must/must-not behavior that does not need a more specific section.

## Boundaries

Status: optional

Define allowed and forbidden files, folders, packages, tools, commands, ownership areas, side effects, or runtime environments.

## Artifact contract

Status: optional

Define named files or artifacts the skill reads, creates, updates, validates, or hands off.

Include path rules, required sections, ownership, and whether the artifact is durable reference, active task state, generated output, or final handoff.

## Lifecycle

Status: optional

Explain artifact or workflow state transitions, not the agent's step-by-step actions.

Use this when a skill participates in a chain such as draft -> review -> implement -> validate -> handoff -> commit, or when named states affect safety, reruns, or next steps.

## Execution tracking

Status: optional

Explain how the agent should expose progress while performing the workflow.

Use this for harness plan/todo tools, progress lists, status widgets, or other ephemeral tracking surfaces.

Default content for multi-step skills:

When the harness exposes a plan or todo tool, mirror the top-level `## Procedure` steps in an ephemeral task list before starting. Use the tool name and schema advertised by the harness.

Track progress in the harness only. Do not create repo task files or durable work artifacts. Keep exactly one task in progress; mark each task complete immediately when its step finishes.

## Workspace state

Status: optional

Explain how Git state, dirty files, staged changes, snapshots, generated files, or user work should be handled.

Default content for repository-mutating skills:

Before mutating repository files, inspect current workspace state and record preexisting dirty paths. Treat preexisting dirty paths as user work unless the skill explicitly owns them or the user clearly authorizes touching them.

## Context sources

Status: optional

Say where facts should come from and how to treat stale, uncertain, external, repo-local, generated, or user-provided information.

Default content for repository skills:

Use repository files, relevant guidance, and current tool output as primary evidence.

Default content for Warden map-aware skills:

Treat maps as orientation only; verify repo facts before relying on them.

## External facts policy

Status: optional

Define when external or current facts require web research, official docs, upstream source, package registry data, security advisories, or vendor documentation.

Use this to distinguish repo-local evidence from facts that may have changed outside the repository.

## Evidence policy

Status: optional

Define what the agent may claim, what requires proof, and what must never be invented.

Default content:

Never claim tests, builds, manual checks, commits, deployments, map refreshes, user approval, or external research happened unless they actually happened in this run or are present in reliable prior evidence.

## Tool contract

Status: optional

Document required tools, allowed tool use, forbidden tool use, and tool-specific safety contracts.

Use this for tools that are read-only, tools that are the only allowed mutation path, commands that may return nonzero on expected differences, or tools that must never be called before approval.

## Interaction model

Status: optional

Explain when to ask the user, when to inspect evidence instead, how questions should be structured, and how answers should affect the workflow.

Default content:

Ask the user only when safety, scope, requirements, or preference are blocked. If repository evidence can answer the question, inspect evidence before asking.

## Decision policy

Status: optional

Define how to make or challenge decisions, including dependency order, trade-off handling, terminology disputes, adversarial review, and final readiness checks.

Use this when the skill must pressure-test a plan, resolve design branches, or refine active work before implementation.

## Confirmation policy

Status: optional / conditional

Define what counts as user approval before mutation, commit, deploy, send, delete, publish, or apply actions.

Default content for approval-gated skills:

Approval must come after a visible plan and must clearly accept that exact action. Ambiguous, conditional, partial, or questioning replies are not approval.

## Terminology policy

Status: optional

Define canonical terms, rejected terms, naming constraints, and how to handle overloaded or domain-conflicting language.

Use this when misunderstood vocabulary can cause wrong files, wrong boundaries, or wrong acceptance behavior.

## Budgets and limits

Status: optional

Define limits for context size, artifact size, number of questions, number of generated files, scope count, runtime, retries, or external calls.

Use this when the skill can otherwise grow without a natural stopping point.

## Procedure

Status: mandatory

Give the ordered execution flow the agent should follow.

### Step 1: <phase name>

1. <ordered action>
2. <ordered action>

### Step 2: <phase name>

1. <ordered action>
2. <ordered action>

## Update policy

Status: optional

Define what the skill may write or mutate, whether changes are immediate or previewed, and what must never be changed.

## Verification policy

Status: optional

Define what checks, tests, manual verification, diff review, validation, or evidence review should happen before finishing.

## Review checklist

Status: optional

List final self-checks that must pass before the skill reports completion.

## Stop conditions

Status: optional

Define when the skill must halt, refuse, redirect, ask, or hand off instead of continuing.

## Idempotency and rerun behavior

Status: optional

Explain what should happen when the skill runs again after partial work, no-op work, stale artifacts, changed workspace state, or already-valid output.

Use this for skills that validate existing artifacts, refresh generated content, apply reviewed plans, or resume interrupted workflows.

## Handoff contract

Status: optional

Define what the next skill, agent, user, or system receives after this skill finishes.

Include exact follow-up commands, artifact paths, required evidence, and whether the handoff is optional or required.

## Output format

Status: optional

Provide the expected final response shape, artifact template, or report format.

Default content:

Report skipped checks with exact reasons. Do not imply commit, push, deploy, publish, map refresh, or follow-up work happened unless it did. End with one exact next safe step when applicable.

## Next step

Status: optional

Name the expected follow-up command, handoff, stopping point, or next safe action.

## Examples

Status: optional

Include high-signal examples only when they prevent common misuse.

## References

Status: optional

Point to bundled reference files when detail should live outside the main `SKILL.md`.
