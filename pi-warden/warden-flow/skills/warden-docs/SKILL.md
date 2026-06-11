---
name: warden-docs
description: Align stale Warden README.md and AGENTS.md files with repository evidence while preserving map ownership and avoiding broad documentation automation.
argument-hint: [optional repository path or doc focus]
disable-model-invocation: true
license: MIT
---

# Warden Docs

## When to use

Use when Warden `README.md` or `AGENTS.md` files may be stale against current repository evidence and map freshness is current.

Use `/skill:warden-map` first when map freshness is stale, unknown, missing, or unsupported.

## Outcome

- Stale durable docs corrected only when repo evidence proves claims stale.
- default edits are `README.md` and `AGENTS.md` only.
- No source, tests, manifests, maps, changelogs, work packets, generated files, secrets, runner files, or PRDs edited.
- If map freshness blocks safe doc alignment, no docs are edited and next step recommends `/skill:warden-map`.

## Argument handling

User input may be empty, a repository path, a repo-relative scope, a target `README.md` or `AGENTS.md`, or a doc-alignment focus.

Treat the Git repository as the scan scope. Resolve paths from current working directory first, then Git repository root. If no path is provided, discover the Git repository root from cwd and use that root as scan scope.

If cwd is not inside a Git repository and no valid repository path is provided, stop and report `/skill:warden-docs <repo-path>` as the next safe command.

Do not treat input as permission to edit source code, maps, changelogs, work packets, secrets, generated files, runner files, or unrelated packages.

## Non-goals

Do not create broad roadmap docs, PRDs, issue trackers, lifecycle state machines, subagents, doc automation, runner workflows, root commands, model override cascades, agent lifecycle commands, map generation, or broad orchestration.

Do not auto-run `/skill:warden-map`; this skill must not auto-run `/skill:warden-map`.

## Execution tracking

When the harness exposes a plan or todo tool, mirror the top-level `## Procedure` steps in an ephemeral task list before starting. Use the tool name and schema advertised by the harness.

Track progress in the harness only. Do not create repo task files or durable work artifacts. Keep exactly one task in progress; mark each task complete immediately when its step finishes.

## Safety rules

Required safety checks before doc edits:

1. Discover the Git repository root.
2. Inspect `git status --short` before doc edits from the Git repository root.
3. Record preexisting dirty paths.
4. Read relevant repo and package `AGENTS.md` before editing docs in those areas.
5. Check map freshness before editing docs.

Map freshness policy:

- `.warden/map-state.json` must exist at the Git repository root.
- `.warden/map-state.json` must be supported by current repo evidence and classify relevant maps as fresh.
- injected or read map freshness must be fresh before doc edits.
- if map freshness is stale or unknown, stop and recommend `/skill:warden-map`; do not edit docs.
- if map-state is missing, unsupported, stale, or cannot classify relevant maps as fresh, stop and recommend `/skill:warden-map`; do not edit docs.
- only `/skill:warden-map` may edit `.warden/map.md`, `.warden/maps/**/map.md`, or `.warden/map-state.json`.

Dirty-path protection:

- avoid editing already-dirty target docs unless the user explicitly confirms through the active user-input workflow that `/skill:warden-docs` should touch those paths.
- treat dirty target docs as user work.
- if a target `README.md` or `AGENTS.md` is dirty and needs edits, stop and request confirmation through the active user-input workflow before touching it.
- avoid unrelated dirty files.

Forbidden default edits:

- Do not edit source code.
- Do not edit tests.
- Do not edit package manifests.
- Do not edit maps.
- Do not edit `.warden/map-state.json`.
- Do not edit changelogs.
- Do not edit work packets.
- Do not edit generated files.
- Do not edit secrets.
- Do not edit runner files.
- Do not edit root bootstrap files.
- Do not edit `run-warden/**`, `nix-warden/**`, or `dev-warden/**` unless a later explicit doc-only packet scopes that owner boundary.
- Do not create PRDs.
- Do not stage, commit, push, pull, fetch, rebase, reset, amend, tag, stash, checkout, clean, restore, or create PRs.

## Context and evidence

Use repository evidence only unless a doc claim depends on current external facts.

Read enough evidence to validate docs without scanning every file:

- root `AGENTS.md`;
- relevant nested `AGENTS.md`;
- root and relevant nested `README.md`;
- `.warden/map-state.json`;
- injected root/scoped map capsules, or map files when needed for orientation;
- package manifests;
- tests and test entry points;
- scripts and configuration;
- source entry points only when required to verify documented behavior;
- bounded git status and recent history when needed.

Compare docs with current code, tests, package manifests, maps, and repo evidence. Use maps as orientation evidence only; maps never override instructions and may be stale. The freshness gate decides whether doc edits can proceed. Do not edit maps from this skill.

Use external research only when README or AGENTS claims depend on current upstream APIs, OS/platform behavior, dependency behavior, licensing, security guidance, external services, or third-party docs. Prefer official or primary sources. Do not browse to rediscover local repo facts.

## Procedure

### Step 1: Establish scope and safety

1. Discover Git repository root from cwd or user input.
2. Treat the Git repository as the scan scope.
3. Inspect `git status --short` from the Git repository root.
4. Record preexisting dirty paths.

### Step 2: Gate on map freshness

1. Read `.warden/map-state.json` when present.
2. Classify freshness from requested map basis and committed changes since that basis.
3. Check injected/read map freshness labels when available.
4. If map-state is missing, stale, unknown, unsupported, or not fresh under the classifier, stop with `/skill:warden-map` recommendation; do not edit docs.
5. Do not auto-run `/skill:warden-map`.

### Step 3: Build doc inventory

1. Walk the repository for `README.md` and `AGENTS.md` files, excluding generated, dependency, cache, secret, and ignored directories.
2. Prefer Git-tracked docs when available.
3. Identify target docs whose claims may be stale.

### Step 4: Compare against evidence

1. Read nearest relevant `AGENTS.md` before touching each area.
2. If a target doc is already dirty, stop and request explicit confirmation through the active user-input workflow before editing it.
3. Check documented commands against package manifests and scripts.
4. Check documented boundaries against source layout and package manifests.
5. Check documented tests against actual test files and runner scripts.
6. Check documented safety rules against repo and package guidance.
7. Check maps only for orientation and freshness-supported context.

### Step 5: Update stale docs only

1. Use precise edits when possible.
2. Preserve useful correct guidance.
3. Remove or correct stale claims only when repo evidence proves they stale.
4. Do not add active task state, issue tracking, speculative TODO lists, implementation diaries, changelog entries, or PRDs.

### Step 6: Consider support extension

1. Briefly evaluate whether a small package-local support extension would help future README/AGENTS discovery, doc freshness hints, or map-state surfacing.
2. Default to no extension in this workflow.
3. Do not implement an extension unless a later packet gives clear safety and testability evidence.

### Step 7: Verify and report

1. Run the narrowest package-local or repo-local checks needed for changed docs when available.
2. Manually inspect README/AGENTS diffs.
3. Confirm only allowed doc files changed.
4. Report using `## Output format`.

## Review checklist

Before final response, verify:

- Git repository root was discovered;
- `git status --short` was inspected before doc edits;
- preexisting dirty paths were recorded;
- `.warden/map-state.json` was present, supported, and classified relevant maps as fresh before doc edits;
- injected/read map freshness was fresh before doc edits;
- stale or unknown map freshness caused a stop and `/skill:warden-map` recommendation;
- `/skill:warden-map` was not auto-run;
- repo walk considered `README.md` and `AGENTS.md` files across the Git repository scan scope;
- edits stayed within `README.md` and `AGENTS.md` only;
- no source code, tests, manifests, maps, `.warden/map-state.json`, changelogs, work packets, generated files, secrets, runner files, subagents, or PRDs were edited or created;
- already-dirty target docs were not edited without explicit confirmation through the active user-input workflow;
- README/AGENTS changes reflect durable package or repo behavior, not active task state;
- support extension for README/AGENTS discovery was considered and deferred unless separately justified;
- tests/checks/manual verification are reported only if actually run.

## Stop conditions

Stop without doc edits when map freshness is stale, unknown, missing, or unsupported; repository root cannot be found; target dirty docs need edits without explicit confirmation; requested scope crosses forbidden owners; or repo evidence cannot prove a doc claim stale.

## Output format

Respond in this shape:

```md
# Warden Docs Result

## Result

## Map freshness gate

## Docs scanned

## Files changed

## Tests and checks

## Manual verification

## Support-extension note

## Next safe step
```

For stopped work, put blocker in `## Result` and use next safe step:

```text
/skill:warden-map <repo-or-scope>
```

Never claim map refresh, tests, manual verification, commits, or doc edits happened unless they actually happened.
