---
name: warden-tdd
description: Implement one grilled Warden work packet slice with strict test-first workflow.
argument-hint: [work packet.md path]
license: MIT
---

# Warden TDD

Implement one approved Warden work packet test-first. Use this after `/skill:warden-grill` has tightened the packet.

Do not implement runner workflows, agent lifecycle commands, subagents, model override cascades, broad orchestration, or work outside the packet slice.

## Packet argument

- Treat `$1` as the user's packet path argument, not as a skill-file-relative reference.
- Require an existing file with basename `packet.md`.
- Accept absolute paths and relative paths.
- Resolve relative paths from current working directory first.
- If cwd-relative candidate does not exist, resolve from Git repository root.
- Do not resolve `$1` against this skill directory unless user supplied that exact absolute path.
- If no valid packet path is provided, stop and ask user to call `/skill:warden-tdd <path-to-packet.md>`.

## Required first reads

1. Read the resolved packet end-to-end before editing any target file.
2. Read repository and package guidance required by the packet's work area.
3. Inspect current `git status --short` before edits.
4. Record preexisting dirty paths. Protect them as user work unless packet explicitly names them and user intent is clear.

## Packet quality gate

Before implementation, confirm packet has:

- one small vertical slice;
- concrete acceptance behavior;
- narrow automated test strategy, or clear reason no automated test fits;
- manual verification steps;
- safety and files-not-to-touch guidance;
- docs decision clarity;
- work area narrow enough to implement without crossing unrelated owners.

Do not require a magic grilled marker or exact status text. Judge packet quality from content.

If scope, acceptance, tests, manual verification, safety, docs, or ownership are missing, unresolved, contradictory, or too broad, stop. Ask user to run `/skill:warden-grill <packet>` or tighten the packet. Do not edit the packet as part of this skill.

If code exploration reveals packet contradiction, missing decision, or needed scope change, stop and ask user. Do not rewrite packet and continue.

## TDD workflow

1. Choose the smallest automated check that can fail for the packet's acceptance behavior.
2. Update or add only that failing check.
3. Run the narrow test command from the packet or nearest package guidance.
4. Confirm failure for expected reason.
5. Implement the smallest code/docs change needed for that slice.
6. Run the narrow test again.
7. Run broader tests only when packet or package guidance requires them.
8. Manually verify the packet's human-visible checks.

Keep edits inside the packet work area and outside files-not-to-touch. Avoid unrelated dirty files. Ask before touching any preexisting dirty path not clearly in scope.

Use external research only when packet or implementation depends on current upstream APIs, dependency behavior, OS/platform behavior, licensing, security guidance, external services, or third-party docs. Prefer official sources.

## Output

Respond in this shape:

```md
# Warden TDD Result

## Result

## Files changed

## Tests run

## Tests skipped + reasons

## Manual verification

## Next safe step
```

Report only commands actually run. If a command was skipped or unavailable, state exact reason.
