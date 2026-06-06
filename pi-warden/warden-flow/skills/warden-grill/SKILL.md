---
name: warden-grill
description: Grilling session that challenges your warden work packet against the existing domain model, sharpens terminology, and updates it inline as decisions crystallise. Use when user wants to stress-test a warden work packet against their project's language and documented decisions.
argument-hint: [work packet.md path]
license: MIT
---

<argument-handling>

- Treat `$1` as the user's packet path argument, not as a skill-file-relative path.
- Require an existing file with basename `packet.md`.
- Accept absolute paths and relative paths.
- Resolve relative paths from current working directory first.
- If cwd-relative path does not exist, resolve from Git repository root.
- Do not resolve `$1` against this skill directory unless user supplied that exact absolute path.
- If no valid packet path is provided, stop and ask user to call `/skill:warden-grill <path-to-packet.md>`.
- If input is rough intent only, do not shape it into a packet; recommend `/skill:warden-start`.
- Use resolved packet path for reads, inline updates, final output, and next-step command.

</argument-handling>

<scope-gates>

Require one small vertical implementation pass. Flag and shrink:

- broad roadmaps;
- multiple unrelated packages or runtimes;
- root + runner + package mixtures;
- docs/process work disguised as implementation;
- vague “improve everything” work;
- acceptance that cannot be tested or manually verified.

</scope-gates>

<safety>

Default edits: update only resolved `$1`. Do not implement code. Do not edit maps, README, AGENTS, package docs, or source files unless user explicitly redirects.

Apply extra caution for shell execution, filesystem mutation, installers, network calls, auth/secrets, permissions, agent lifecycle, external tool invocation, dependency loading, commit/apply behavior, map writing, and generated files. Recommend stronger verification or smaller slice when risk is high.

</safety>

<context-sources>

Use maps as orientation only:

- Root map: `<repo root>/.warden/map.md`.
- Scoped maps: `<repo root>/.warden/maps/<repo-relative-scope>/map.md`.
- Map information may be stale; verify repo facts before relying on it.
- Only `/skill:warden-map` updates `.warden/map.md` and `.warden/maps/**/map.md`.
- If map freshness matters, recommend scoped `/skill:warden-map` refresh.

Use external research only when packet depends on current upstream APIs, dependency behavior, package manager behavior, OS/platform behavior, licensing, security guidance, external service behavior, or third-party docs. Prefer official or primary sources.

</context-sources>

<questioning-policy>

Use `ask_user_question`, questionnaire extension, or equivalent structured choice UI when available.

Be relentless but useful:

- Challenge terminology that conflicts with `map.md`, relevant `README.md`, or `AGENTS.md`.
- Sharpen vague or overloaded terms by proposing a canonical term.
- Discuss concrete edge scenarios that expose boundary mistakes.
- Cross-reference live code when user claims how behavior works.
- Surface packet/code/doc contradictions immediately.

Ask one question at a time and wait for feedback before continuing.

</questioning-policy>

<workflow>

Goal: make `$1` ready for test-driven development.

1. Resolve and read `$1`.
2. Read relevant repository guidance, package guidance, README files, maps, tests, and code when needed to verify packet claims.
3. If a question can be answered by exploring the codebase, explore first instead of asking.
4. Interview the user one unresolved decision at a time. For each question, provide your recommended answer.
5. Walk dependency order: settle blocking terminology, boundaries, acceptance, tests, safety, docs, then implementation slice.
6. When an aspect is resolved, update `$1` inline immediately. Do not batch packet edits.
7. Continue the question → packet update → next question loop until all review checks pass. Then finish with a readiness summary and next-step command. If the packet cannot be made safe or testable, explain the blocker and stop.

</workflow>

<review-checks>

Before final output, verify:

1. Slice
   - One vertical implementation pass.
   - Clear boundary and likely files.
   - No mixed ownership unless explicitly justified.
2. Acceptance
   - Observable behavior.
   - No “works correctly” without concrete result.
3. Automated tests
   - Narrow tests where possible.
   - No invented commands without repo evidence.
   - Broad “run all tests” not sole strategy when narrower tests exist.
4. Manual verification
   - Human-visible check.
   - Not only repeating automated tests.
5. External research
   - Current external facts researched from primary sources when needed.
6. Maps
   - Map hints treated as stale orientation unless verified.
7. Durable docs
   - Add docs work only when acceptance or boundary clarity needs it.
   - README is for human/operator usage, setup, commands, and project explanation.
   - AGENTS is for role-neutral agent editing rules and boundaries.
   - `.warden/map.md` and `.warden/maps/**/map.md` are durable orientation only.
   - `$1` is active task state.

</review-checks>

<output-format>

During the loop, output only one next question with your recommended answer, or a brief note that `$1` was updated before the next question.

Only when no unresolved questions remain, use this final shape. Keep concise. Prefer specific fixes over abstract criticism.

```md
# Warden Grill

Status: Packet solid for TDD

## Slice check

## Acceptance check

## Verification check

## External research check

## Map check

## Durable-docs check
```

Offer next step with `/skill:warden-tdd <resolved-packet-path>`.

</output-format>
