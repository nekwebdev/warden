---
name: warden-close
description: Close an accepted Warden work packet by validating closure, writing a final handoff, and deciding changelog/map impact.
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
- If no valid packet path is provided, stop and ask user to call `/skill:warden-close <path-to-packet.md>`.
- If input is rough intent only, do not shape it into a packet; recommend `/skill:warden-start`.
- If packet still needs scope, acceptance, test, or implementation decisions, do not close it; recommend `/skill:warden-grill <resolved-packet-path>`.
- Use resolved packet path for reads, closure checks, sibling `handoff.md`, and final next-step commands.

</argument-handling>

<scope-gates>

Close only accepted Warden work packets.

- Close means user tested current implementation and considers it acceptable.
- A direct `/skill:warden-close <packet.md path>` invocation is enough to treat manual review as accepted unless user's message says otherwise.
- Stop with `Not ready` when packet, implementation, acceptance, docs, tests, boundaries, or manual review are incomplete but another grill/TDD loop can resolve them.
- Stop with `Blocked` when closure cannot safely determine outcome because required evidence is missing, repo state is unsafe, packet path is invalid, dirty state is ambiguous, or closure would require crossing forbidden boundaries.
- Do not treat rough intent as closure input.
- Do not implement code, stage changes, commit changes, or refresh maps.

Use one verdict:

```text
Closed
Not ready
Blocked
```

Verdict meanings:

- `Closed` — packet acceptance behavior is satisfied, user/manual review is accepted, automated checks are honestly recorded, boundaries are clean enough, and closure notes were written.
- `Not ready` — work is close but needs another grill/TDD loop because acceptance, tests, docs, boundaries, manual review, or packet/implementation alignment is incomplete.
- `Blocked` — closure cannot safely determine outcome because required evidence is missing, repo state is unsafe, packet path is invalid, dirty state is ambiguous, or closure would require crossing forbidden boundaries.

</scope-gates>

<safety>

Default allowed edits:

- Create or update only sibling `handoff.md` next to resolved `$1`.
- Update root `CHANGELOG.md` only when the changelog rule requires it.

Default forbidden edits:

- Do not edit `$1` unless user explicitly asks for packet correction.
- Do not edit maps.
- Do not implement code.
- Do not stage or commit changes.
- Do not create `verify.md`, `validate.md`, `review.md`, or extra closure artifacts.

Expected work artifact layout:

```text
.warden/work/<slug>/packet.md
.warden/work/<slug>/handoff.md
```

`packet.md` is the active work contract. `handoff.md` is the final closure record. There is no `verify.md` or `validate.md`; `warden-close` is validation and closure step.

Never invent automated test results, command output, manual checks, commits, map refreshes, changelog updates, or external research that are not present in conversation, repo evidence, recent tool output, or commands actually run.

</safety>

<context-sources>

Before closing, read:

1. resolved `$1` end-to-end;
2. relevant repo and package guidance required by packet work area;
3. current `git status --short`;
4. relevant recent commit subjects or diffs when needed to understand what changed;
5. README, AGENTS, CHANGELOG, maps, tests, or source files only when needed to validate packet claims, docs impact, changelog impact, or map impact.

Use maps as orientation only:

- Maps are durable orientation context, not task state.
- Map information may be stale.
- Verify repo facts before relying on map content.
- Only `/skill:warden-map` updates `.warden/map.md` and `.warden/maps/**/map.md`.
- If map freshness matters, recommend scoped `/skill:warden-map` refresh.
- Do not edit map files from this skill.

Use external research only when final closure depends on current external facts, such as:

- current upstream APIs;
- dependency behavior;
- package manager behavior;
- OS or platform behavior;
- licensing;
- security guidance;
- external services;
- third-party documentation.

Prefer official or primary sources. Do not browse to rediscover local repo facts.

If external research affects close decision, record researched claim, source or source type, and decision impact in `handoff.md`.

</context-sources>

<workflow>

1. Resolve and read `$1` end-to-end.
2. Read required repo/package guidance and inspect `git status --short`.
3. Confirm packet/implementation alignment:
   - packet still describes what was actually built;
   - current slice is complete or intentionally stopped;
   - no unresolved packet contradictions remain.
4. Confirm acceptance behavior:
   - acceptance behavior is concrete;
   - acceptance behavior is satisfied;
   - no acceptance criteria remain unresolved;
   - user close invocation counts as manual acceptance unless contradicted.
5. Record automated tests and checks:
   - commands or checks actually run;
   - whether each command/check passed or failed;
   - skipped checks with exact reasons.
6. Perform boundary check:
   - changed files are inside packet work area or explicitly justified;
   - files-not-to-touch were not changed;
   - no forbidden owner boundary was crossed silently;
   - unrelated dirty files and pre-existing dirty state are clearly identified.
7. Decide durable docs impact:
   - README is for human/operator usage, setup, commands, and project explanation.
   - AGENTS is for role-neutral agent editing rules and boundaries.
   - `.warden/map.md` and `.warden/maps/**/map.md` are durable orientation only.
   - `.warden/work/<slug>/packet.md` is active task state.
   - `.warden/work/<slug>/handoff.md` is final closure state.
   - ADRs are only for pivotal, expensive-to-reverse, surprising, or likely-to-be-reargued choices.
8. Decide changelog impact:
   - Add one concise bullet under root `CHANGELOG.md` -> `Unreleased` only if slice changed user/operator behavior, public package behavior, command surface, safety behavior, workflow expectations, package boundaries, public APIs, or operational behavior.
   - If slice only changed internal tests, refactors, prose wording, or private implementation details, do not update changelog.
   - If `CHANGELOG.md` is absent, do not create one unless repo guidance explicitly says to.
   - Record changelog verdict and reason in `handoff.md`.
9. Decide map impact:
   - `none` — no durable orientation impact.
   - `scoped-refresh` — package/workflow boundaries, new skills, command surfaces, safety rules, verification surfaces, or package-local orientation changed.
   - `root-refresh` — top-level repo boundaries or cross-component orientation changed.
   - Do not edit maps; if refresh is needed, write suggested command in `handoff.md`.
10. Decide commit readiness:
    - Do not stage or commit.
    - If closed and no map refresh is needed, next safe step is usually `/skill:warden-commit`.
    - If closed and map refresh is recommended, next safe step is usually `/skill:warden-map <scope>` before `/skill:warden-commit`.
    - If not ready, next safe step is usually `/skill:warden-grill <resolved-packet-path>`.
11. Write sibling `handoff.md` only when verdict is `Closed`.
12. Respond using `<output-format>`.

For `Not ready` or `Blocked`, do not create or update `handoff.md` unless user explicitly asks to preserve failed close notes. Return blocker and next command instead.

</workflow>

<review-checks>

Before final output, verify:

- `$1` resolved to an existing `packet.md`;
- packet was read before closure decisions;
- relevant guidance was read when needed;
- current git state was inspected;
- no code implementation was performed;
- no map files were edited;
- no `verify.md` or `validate.md` was created;
- no tests/checks are claimed unless actually run or present in reliable prior output;
- changelog update happened only if required;
- `handoff.md` was written only for `Closed`;
- next safe step is exact and does not imply push or remote git work.

Close check failures:

- If packet no longer matches implementation, return `Not ready` and recommend `/skill:warden-grill <resolved-packet-path>`.
- If acceptance is vague or untestable, return `Not ready`.
- If user feedback says anything is still wrong, return `Not ready` and recommend `/skill:warden-grill <resolved-packet-path>`.
- If dirty state is ambiguous or unrelated work is mixed in, return `Blocked` and name blocker exactly.

</review-checks>

<output-format>

When writing `handoff.md`, use this shape:

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

Section guidance:

- `Outcome`: what was completed, in plain language.
- `Acceptance evidence`: how packet acceptance behavior was satisfied.
- `Tests and checks`: commands/checks actually run; skipped checks with exact reasons.
- `Manual acceptance`: user's acceptance signal or manual test summary.
- `Files changed`: concise repo-relative paths or grouped summary.
- `Commits / checkpoints`: recent local checkpoint commit hashes/subjects if relevant; do not invent.
- `Boundary check`: whether changes stayed inside packet scope and files-not-to-touch.
- `External research`: use `None; repo-local close.` when no external research affected closure.
- `Durable docs decision`: README/AGENTS/ADR/doc decisions.
- `Changelog decision`: `updated` or `not needed`, with reason.
- `Map impact`: `none`, `scoped-refresh`, or `root-refresh`, with suggested command when needed.
- `Remaining risks`: honest residual risks, or `None known.`
- `Next safe step`: exact next command.

Respond in this shape:

```md
# Warden Close Result

Status: Closed | Not ready | Blocked

## Result

## Handoff

## Tests and checks

## Manual acceptance

## Changelog decision

## Map impact

## Files changed

## Next safe step
```

For `Closed`, include written `handoff.md` path.

For `Not ready`, next safe step should usually be:

```text
/skill:warden-grill <resolved-packet-path>
```

For `Blocked`, next safe step should name the smallest unblock action.

Never claim commit, push, map refresh, tests, or manual verification happened unless it actually happened.

</output-format>
