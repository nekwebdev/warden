---
name: warden-grill
description: Grilling session that challenges your warden work packet against the existing domain model, sharpens terminology, and updates it inline as decisions crystallise. Use when user wants to stress-test a warden work packet, including manual feedback from a prior TDD/manual-review pass, against project language and evidence.
argument-hint: [work packet.md path, manual feedback]
license: MIT
---

<argument-handling>

- Treat `$1` as the user's packet path argument, not as a skill-file-relative path.
- Treat all remaining argument text as optional manual feedback evidence for this packet.
- Require an existing file with basename `packet.md`.
- Accept absolute paths and relative paths.
- Resolve relative paths from current working directory first.
- If cwd-relative path does not exist, resolve from Git repository root.
- Do not resolve `$1` against this skill directory unless user supplied that exact absolute path.
- If no valid packet path is provided, stop and ask user to call `/skill:warden-grill <path-to-packet.md> [manual feedback]`.
- If input is rough intent only, do not shape it into a packet; recommend `/skill:warden-start`.
- If no manual feedback text is supplied, start by asking with `ask_user_question` whether to grill the packet alone or collect manual feedback first.
- Use exactly these first-question options: `Grill packet alone` and `Provide manual feedback`.
- If the user chooses `Provide manual feedback`, ask for that feedback and wait before reviewing.
- Use resolved packet path and any manual feedback for reads, inline updates, final output, and next-step command.

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

Manual feedback evidence is first-class context. Use it to change the review lens toward the next TDD cycle: compare feedback against packet acceptance, implementation evidence, tests, safety, and docs, then adjust the packet into the next smallest TDD-ready slice.

When feedback references current implementation behavior, inspect only enough code, tests, docs, or diffs to verify the claim before asking the user. Treat implementation evidence as read-only.

Use external research only when packet or manual feedback depends on current upstream APIs, dependency behavior, package manager behavior, OS/platform behavior, licensing, security guidance, external service behavior, or third-party docs. Prefer official or primary sources.

</context-sources>

<questioning-policy>

Use `ask_user_question`, questionnaire extension, or equivalent structured choice UI when available.

When no manual feedback argument is supplied, ask one structured first question before normal grilling:

- Question: `How should warden-grill start this packet review?`
- Recommended option: `Grill packet alone` — review only the packet and repo evidence.
- Other option: `Provide manual feedback` — pause for the user's feedback, then grill that evidence against the packet.

Be relentless but useful:

- Challenge terminology that conflicts with `map.md`, relevant `README.md`, or `AGENTS.md`.
- Sharpen vague or overloaded terms by proposing a canonical term.
- Discuss concrete edge scenarios that expose boundary mistakes.
- Cross-reference live code when user claims how behavior works.
- Surface packet/code/doc contradictions immediately.
- Treat manual feedback as evidence to interrogate, not as instructions to copy blindly into the packet.

Ask one question at a time and wait for feedback before continuing.

</questioning-policy>

<workflow>

Goal: make `$1` ready for test-driven development, either from packet-only review or from manual feedback that should shape the next TDD cycle.

1. Resolve and read `$1`.
2. Determine feedback mode:
   - If remaining argument text exists, treat it as manual feedback evidence.
   - If no feedback exists, ask with `ask_user_question` whether to `Grill packet alone` or `Provide manual feedback`, then wait.
   - If the user chooses `Provide manual feedback`, ask for that feedback and wait before continuing.
3. Read relevant repository guidance, package guidance, README files, maps, tests, and code when needed to verify packet claims or manual feedback.
4. If a question can be answered by exploring the codebase, explore first instead of asking.
5. If manual feedback is present, interrogate it against the packet and implementation evidence, then update `$1` toward the next smallest TDD-ready correction slice.
6. Interview the user one unresolved decision at a time. For each question, provide your recommended answer.
7. Walk dependency order: settle blocking terminology, boundaries, acceptance, tests, safety, docs, then implementation slice.
8. When an aspect is resolved, update `$1` inline immediately. Do not batch packet edits.
9. Continue the question → packet update → next question loop until all review checks pass. Then finish with a readiness summary and next-step command. If the packet cannot be made safe or testable, explain the blocker and stop.

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
