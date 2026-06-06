---
name: warden-grill
description: Grilling session that challenges your warden work packet against the existing domain model, sharpens terminology, and updates it inline as decisions crystallise. Use when user wants to stress-test a warden work packet against their project's language and documented decisions.
argument-hint: [work packet.md path]
license: MIT
---

<checks>
- Treat $1 as the user's packet path argument, not as a skill-file-relative reference.
- Accept absolute paths and relative paths. Resolve relative paths from the current working directory first, then from the Git repository root if the cwd-relative candidate does not exist. Do not resolve $1 against this skill directory unless the user provided that exact absolute path.
- After resolving $1, check that the resolved path exists and has basename `packet.md`. If not, error out and ask to call the skill with a `packet.md` path as an argument.
- Use the resolved packet path for reads, inline updates, and the final next-step command.
- If input is rough intent only, do not shape it into a packet; recommend `/skill:warden-start`
- Require one small vertical implementation pass.
- Flag broad roadmaps, multiple unrelated packages/runtimes, root + runner + package mixtures, docs/process work disguised as implementation, and vague “improve everything” work.
</checks>

<what-to-do>

Interview me relentlessly about every aspect of this warden $1 work packet until we reach a shared understanding and $1 is ready for test driven develpment. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time, waiting for feedback on each question before continuing.

If a question can be answered by exploring the codebase, explore the codebase instead.
  
</what-to-do>

<supporting-info>

## Asking questions

Use `ask_user_question`, questionnaire extension, or equivalent structured choice UI when available

## Domain awareness

Use `<repo root>/.warden/map/<slug>/map.md` guidance files.

Map handling:
   - maps are orientation only; they are not task state, implementation diaries, issue trackers, release notes, or PRDs.
   - map information may be stale.
   - Only `/skill:warden-map` updates map files: `.warden/map.md` and `.warden/maps/**/map.md`.
   - Other skills may read map capsules as hints but must verify repo facts before relying on them.
   - If map freshness matters, recommend a scoped `/skill:warden-map` refresh.

## During the session

Do not edit files by default. Do not implement code.
Be relentless but useful. Test whether the packet can survive implementation pressure.
Surface packet/code/doc contradictions, especially mismatches between packet claims, live files, package guidance, README behavior, map hints, and tests.
Probe edge scenarios: wrong cwd, stale maps, missing package guidance, unavailable tooling, broad likely files, cross-boundary edits, risky shell/network/install behavior, and untestable acceptance.

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in `map.md` or relevant `README.md` or `AGENTS.md`, call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y — which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account' — do you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible — which is right?"

### External research

External/current facts use web research when packet depends on current upstream APIs, dependency behavior, package manager behavior, OS/platform behavior, licensing, security guidance, external service behavior, or third-party docs. Prefer official or primary sources for external technical facts.

### Update $1 inline

When an aspect is resolved, update $1 right there. Don't batch these up — capture them as they happen.

Treat $1 as the work packet an implementation agent will use to implement with test driven development. Respect current sections and only expand when relevant because of a grill step decision.

## Final review checks

1. Acceptance behavior
   - Require observable behavior.
   - Flag vague acceptance, “works correctly” with no observable result, or acceptance that cannot be tested or manually verified.
2. Test strategy
   - Require narrow automated tests where possible.
   - Flag missing tests, invented commands without repo evidence, broad “run all tests” as only strategy when narrower tests exist, and claims that tests passed without actual commands.
3. Manual verification
   - Require a human-visible check.
   - Flag no manual verification, checks that only repeat automated tests, or no command output/behavior to inspect.
4. Safety and security
   - Apply extra caution for shell execution, filesystem mutation, installers, network calls, auth/secrets, permissions, agent lifecycle, external tool invocation, dependency loading, commit/apply behavior, map writing, and generated files.
   - Recommend stronger verification or a smaller slice when risk is high.
5. Durable docs
   - Add docs work to packet only when acceptance or boundary clarity needs it; adjust the packet accordingly.
   - README is for human/operator usage, setup, commands, and project explanation.
   - AGENTS is for role-neutral agent editing rules and boundaries.
   - `.warden/map.md` and `.warden/maps/**/map.md` are durable orientation only.
   - $1 is active task state.

## Output

Use this exact shape. Keep concise. Prefer specific fixes over abstract criticism.

```md
# Warden Grill

## Slice check

## Acceptance check

## Verification check

## External research check

## Map check

## Durable-docs check

```

Offer next step with `/skill:warden-tdd $1`

</supporting-info>
