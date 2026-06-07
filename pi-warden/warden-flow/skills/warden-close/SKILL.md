---
name: warden-close
description: Close an accepted Warden work packet by validating closure, creating or validating final handoff.md, and deciding changelog/map impact.
argument-hint: [packet.md or handoff.md path]
license: MIT
---

<argument-handling>

- Treat `$1` as the user's packet or handoff path argument, not as a skill-file-relative path.
- Accept an existing `packet.md` or `handoff.md` path.
- Accept absolute paths and relative paths.
- Resolve relative paths from current working directory first.
- If cwd-relative path does not exist, resolve from Git repository root.
- Do not resolve `$1` against this skill directory unless user supplied that exact absolute path.
- If `$1` resolves to `packet.md`, use sibling `handoff.md` as the closure handoff path.
- If `$1` resolves to `handoff.md`, use sibling `packet.md` as the packet path when it exists.
- If `$1` is missing, invalid, or not named `packet.md` or `handoff.md`, stop and ask user to call `/skill:warden-close <path-to-packet.md-or-handoff.md>`.
- If input is rough intent only, do not shape it into a packet; recommend `/skill:warden-start`.
- If packet still needs scope, acceptance, test, or implementation decisions, do not close it; recommend `/skill:warden-grill <resolved-packet-path>`.
- Use resolved paths for reads, closure checks, sibling `handoff.md`, and final next-step commands.

</argument-handling>

<scope-gates>

Close only accepted Warden work packets.

- Close means the final closure record accurately documents outcome, acceptance evidence, tests/checks, manual acceptance, changed files, boundary decisions, durable docs decisions, changelog decision, map impact, remaining risks, and next safe step.
- If `handoff.md` exists, validate it against the packet, current repo evidence, and available conversation/tool evidence.
- If `handoff.md` is missing and closure evidence is sufficient, create it to document closure.
- A direct `/skill:warden-close <packet-or-handoff>` invocation counts as manual acceptance only when packet and repo evidence also support closure, unless user's message says otherwise.
- Stop with `Not ready` when implementation, acceptance, tests, docs, or closure evidence still needs another grill/TDD/close loop.
- Stop with `Blocked` when closure cannot safely determine outcome because paths are invalid, required evidence is missing, repo state is unsafe, dirty state is ambiguous, or validation would cross forbidden boundaries.
- Do not treat rough intent as closure input.
- Do not implement code, refresh maps, stage changes, commit changes, or run remote git operations.

Use one verdict:

```text
Closed
Not ready
Blocked
```

Verdict meanings:

- `Closed` — `handoff.md` exists after the skill run and accurately records closure evidence and next safe step.
- `Not ready` — another `/skill:warden-grill`, `/skill:warden-tdd`, or `/skill:warden-close` loop can resolve missing acceptance, tests, docs, or implementation alignment.
- `Blocked` — closure cannot safely validate or create a handoff because required evidence is missing, repo state is unsafe, paths are invalid, or owner boundaries are unclear.

</scope-gates>

<safety>

Default allowed edits:

- Create missing sibling `handoff.md` next to resolved `packet.md`.
- Update existing sibling `handoff.md` only when validation finds stale, incomplete, or inaccurate closure content.
- Update root `CHANGELOG.md` only when the changelog rule requires it and no existing handoff already records a correct changelog decision.

Default forbidden edits:

- Do not edit `packet.md` unless user explicitly asks for packet correction.
- Do not edit source, tests, package docs, README, AGENTS, or maps.
- Do not create `verify.md`, `validate.md`, `review.md`, marker files, or extra closure artifacts.
- Do not stage, commit, push, pull, fetch, rebase, reset, amend, tag, stash, checkout, clean, restore, or create PRs.

Expected work artifact layout:

```text
.warden/work/<slug>/packet.md
.warden/work/<slug>/handoff.md
```

`packet.md` is the active work contract. `handoff.md` is the final closure record. There is no `verify.md` or `validate.md`; `warden-close` is the validation and closure step.

Never invent automated test results, command output, manual checks, commits, map refreshes, changelog updates, external research, or acceptance evidence that are not present in conversation, repo evidence, recent tool output, or commands actually run.

</safety>

<context-sources>

Before closing, read:

1. resolved `packet.md` when it exists;
2. resolved or sibling `handoff.md` when it exists;
3. relevant repo and package guidance required by the packet work area;
4. current `git status --short`;
5. relevant diffs, recent commit subjects, README, AGENTS, CHANGELOG, maps, tests, or source files only when needed to validate handoff claims, docs impact, changelog impact, or map impact.

Use maps as orientation only:

- Maps are durable orientation context, not task state.
- Map information may be stale.
- Verify repo facts before relying on map content.
- Only `/skill:warden-map` updates `.warden/map.md` and `.warden/maps/**/map.md`.
- If map freshness matters, recommend scoped `/skill:warden-map` refresh.
- Do not edit map files from this skill.

Use external research only when final closure depends on current external facts, such as current upstream APIs, dependency behavior, package manager behavior, OS or platform behavior, licensing, security guidance, external services, or third-party documentation.

Prefer official or primary sources. Do not browse to rediscover local repo facts. If external research affects the close decision, record researched claim, source or source type, and decision impact in `handoff.md`.

</context-sources>

<workflow>

1. Resolve `$1` to `packet.md` or `handoff.md`, then derive the sibling path.
2. Read existing `packet.md` and/or `handoff.md` end-to-end.
3. Read required repo/package guidance and inspect `git status --short`.
4. Validate packet/implementation alignment when packet exists:
   - packet describes accepted work;
   - current slice is complete or intentionally stopped;
   - no unresolved packet contradictions remain.
5. Validate or gather closure evidence:
   - acceptance behavior is concrete and satisfied;
   - manual acceptance is present or implicit from invocation plus supporting packet/repo evidence;
   - tests/checks are recorded honestly;
   - skipped checks include exact reasons;
   - changed files and dirty state are described accurately.
6. Validate boundary and safety decisions:
   - changed files stay inside packet work area or are justified;
   - files-not-to-touch were not changed;
   - unrelated dirty files and pre-existing state are clearly identified;
   - no forbidden owner boundary was crossed silently.
7. Validate durable docs, changelog, and map decisions:
   - README/AGENTS/ADR decisions are recorded when relevant;
   - changelog update is present only when required;
   - map impact is `none`, `scoped-refresh`, or `root-refresh`, with suggested `/skill:warden-map` command when needed.
8. If `handoff.md` exists and passes validation, leave it unchanged.
9. If `handoff.md` is missing or stale but closure can be determined, create or update it using `<output-format>`.
10. Decide next safe step:
    - usually `/skill:warden-commit` when closed and no map refresh is needed;
    - `/skill:warden-map <scope>` before commit when map refresh is recommended;
    - `/skill:warden-grill <packet>` or `/skill:warden-tdd <packet>` when not ready;
    - smallest unblock action when blocked.
11. Respond using `<output-format>`.

For `Not ready` or `Blocked`, do not create or update `handoff.md` unless user explicitly asks to preserve failed close notes. Return blocker and next command instead.

</workflow>

<review-checks>

Before final output, verify:

- `$1` resolved to an existing `packet.md` or `handoff.md`;
- packet and/or handoff were read before closure decisions;
- relevant guidance was read when needed;
- current git state was inspected;
- no code implementation was performed;
- no map files were edited;
- no `verify.md`, `validate.md`, `review.md`, or marker file was created;
- no tests/checks are claimed unless actually run or present in reliable prior output;
- existing `handoff.md` was left unchanged when valid;
- missing or stale `handoff.md` was written only when closure evidence was sufficient;
- next safe step is exact and does not imply push or remote git work.

Close check failures:

- If packet no longer matches implementation or handoff, return `Not ready` and recommend `/skill:warden-grill <resolved-packet-path>`.
- If acceptance is vague, untestable, or contradicted by user feedback, return `Not ready`.
- If dirty state is ambiguous or unrelated work is mixed in, return `Blocked` and name blocker exactly.
- If only a `handoff.md` path exists and sibling `packet.md` is absent, validate from handoff plus repo evidence; block only if required packet evidence is necessary and missing.

</review-checks>

<output-format>

When creating or updating `handoff.md`, use this shape:

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

- `Close status`: use `Closed`.
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

## Validation evidence

## Tests and checks

## Manual acceptance

## Changelog decision

## Map impact

## Files changed

## Next safe step
```

For `Closed`, include `handoff.md` path and whether it was unchanged, created, or updated.

For `Not ready`, next safe step should usually be:

```text
/skill:warden-grill <resolved-packet-path>
```

For `Blocked`, next safe step should name the smallest unblock action.

Never claim commit, push, map refresh, tests, manual verification, or handoff edits happened unless it actually happened.

</output-format>
