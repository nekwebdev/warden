---
name: warden-tdd
description: Implement one grilled Warden work packet slice with strict test-first workflow.
argument-hint: [packet.md path]
license: MIT
---

<argument-handling>

- Treat `$1` as the user's packet path argument, not as a skill-file-relative path.
- Require an existing file with basename `packet.md`.
- Accept absolute paths and relative paths.
- Resolve relative paths from current working directory first.
- If cwd-relative path does not exist, resolve from Git repository root.
- Do not resolve `$1` against this skill directory unless user supplied that exact absolute path.
- If no valid packet path is provided, stop and ask user to call `/skill:warden-tdd <path-to-packet.md>`.
- Use resolved packet path for first read, scope checks, result reporting, and any final next-step reference.

</argument-handling>

<scope-gates>

Implement one approved Warden work packet slice after `/skill:warden-grill` has tightened it.

Before implementation, confirm packet has:

- one small vertical slice;
- concrete acceptance behavior;
- narrow automated test strategy, or clear reason no automated test fits;
- manual verification steps;
- safety and files-not-to-touch guidance;
- docs decision clarity;
- work area narrow enough to implement without crossing unrelated owners.

Do not require a magic grilled marker or exact status text. Judge packet quality from content.

Stop without editing target files when scope, acceptance, tests, manual verification, safety, docs, or ownership are missing, unresolved, contradictory, or too broad. Ask user to run `/skill:warden-grill <packet>` or tighten the packet.

Do not implement runner workflows, agent lifecycle commands, subagents, model override cascades, broad orchestration, or work outside the packet slice.

</scope-gates>

<safety>

Required first reads before editing any target file:

1. Read the resolved packet end-to-end.
2. Read repository and package guidance required by the packet's work area.
3. Inspect current `git status --short`.
4. Record preexisting dirty paths.

Protect preexisting dirty paths as user work unless packet explicitly names them and user intent is clear. Ask before touching any preexisting dirty path not clearly in scope.

Keep edits inside packet work area and outside files-not-to-touch. Avoid unrelated dirty files.

If code exploration reveals packet contradiction, missing decision, or needed scope change, stop and ask user. Do not rewrite the packet and continue. Do not edit the packet as part of this skill unless user explicitly changes task to packet revision.

Never claim tests, builds, or manual verification ran unless commands/checks actually ran.

</safety>

<context-sources>

Use the packet as the primary task source. Use repository evidence to verify and implement it:

- repo and package `AGENTS.md` guidance;
- relevant `README.md` files;
- package manifests and scripts;
- existing tests and test utilities;
- nearby source/docs named or implied by the packet;
- current `git status --short` for dirty-path safety.

Use maps only as stale orientation hints. Verify repo facts before relying on map content. Do not edit `.warden/map.md` or `.warden/maps/**/map.md` from this skill.

Use external research only when packet or implementation depends on current upstream APIs, dependency behavior, OS/platform behavior, licensing, security guidance, external services, or third-party docs. Prefer official or primary sources. Do not browse to rediscover local repo facts.

Test commands come from the packet first, then nearest package guidance, then repo guidance. If commands conflict, prefer nearest applicable guidance and report the choice.

</context-sources>

<workflow>

1. Resolve and read `$1` end-to-end.
2. Read required repo/package guidance and inspect `git status --short`.
3. Apply `<scope-gates>`. Stop if packet is not implementable as one safe slice.
4. Inspect only enough code/docs/tests to choose the smallest verification surface.
5. Test-first pass:
   - Choose the smallest automated check that can fail for the packet's acceptance behavior.
   - Add or update only that failing check.
   - Run the narrow test command from packet or nearest guidance.
   - Confirm failure for the expected reason.
6. If packet clearly explains no automated test fits, do not invent a fake test. Note the reason, then use existing validation/manual checks required by packet or guidance.
7. Implement the smallest code/docs change needed for the slice.
8. Run the narrow test again and confirm it passes.
9. Run broader tests only when packet or package guidance requires them, or when changed surface affects shared assumptions.
10. Manually verify the packet's human-visible checks.
11. Report result using `<output-format>`.

</workflow>

<review-checks>

Before final response, verify:

- packet was read before target edits;
- relevant guidance was read before target edits;
- preexisting dirty paths were recorded and protected;
- edits stayed within packet work area;
- files-not-to-touch were not changed;
- unresolved packet contradictions caused a stop instead of silent scope changes;
- failing check was added/updated before implementation when automated testing fit;
- failure reason was expected before implementation;
- narrow test passed after implementation;
- broader tests were run when required, or skipped with exact reason;
- manual verification ran, or skipped with exact reason;
- result reports only commands/checks actually run;
- next safe step does not imply commit/push unless user asks.

</review-checks>

<output-format>

Respond in this shape:

```md
# Warden TDD Result

## Result

## Files changed

## Tests run

## Tests skipped + reasons

## Manual verification

## Next safe step

If changes are required after manual verification:

`/skill:warden-grill <resolved-packet-path>`

If packet is corrrectly implemented:

`/skill:warden-close <resolved-packet-path>`

```

Report only commands actually run. If a command was skipped or unavailable, state exact reason.

For stopped work, use the same shape and put blocker in `## Result`, with next safe step such as `/skill:warden-grill <resolved-packet-path>`.

</output-format>
