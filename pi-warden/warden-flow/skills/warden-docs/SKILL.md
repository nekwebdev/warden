---
name: warden-docs
description: Align stale Warden README.md and AGENTS.md files with repository evidence while preserving map ownership and avoiding broad documentation automation.
argument-hint: [optional repository path or doc focus]
license: MIT
---

<argument-handling>

User input may be empty, a repository path, a repo-relative scope, a target `README.md` or `AGENTS.md`, or a doc-alignment focus.

- Treat the Git repository as the scan scope.
- Resolve paths from current working directory first, then from the Git repository root.
- If no path is provided, discover the Git repository root from cwd and use that root as the scan scope.
- If cwd is not inside a Git repository and no valid repository path is provided, stop and ask user to run `/skill:warden-docs <repo-path>` from inside the target repository.
- Do not treat input as permission to edit source code, maps, changelogs, work packets, secrets, generated files, runner files, or unrelated packages.

</argument-handling>

<scope-gates>

Align stale durable docs only:

```text
README.md
AGENTS.md
```

- Walk the repository for `README.md` and `AGENTS.md` files.
- Compare those docs with current code, tests, package manifests, maps, and repo evidence.
- Update stale docs only when repo evidence proves the claim is stale.
- Default edits are `README.md` and `AGENTS.md` only.
- Do not edit files outside `README.md` and `AGENTS.md` during the default workflow.
- Do not create broad roadmap docs, PRDs, issue trackers, lifecycle state machines, subagents, or doc automation.
- Do not implement runner workflows, root commands, model override cascades, agent lifecycle commands, map generation, or broad orchestration.
- Do not auto-run `/skill:warden-map`.
- If repo map freshness is stale or unknown, stop before doc edits and recommend `/skill:warden-map` for the repo or relevant scope.

</scope-gates>

<safety>

Required safety checks before doc edits:

1. Discover the Git repository root.
2. Inspect `git status --short` before doc edits from the Git repository root.
3. Record preexisting dirty paths.
4. Read relevant repo and package `AGENTS.md` before editing docs in those areas.
5. Check map freshness before editing docs.

Map freshness policy:

- `.warden/map-state.json` must exist at the Git repository root.
- `.warden/map-state.json` must be supported by current repo evidence and classify relevant maps as fresh.
- Injected or read map freshness must be fresh before doc edits.
- If injected/read map freshness is stale or unknown, stop and recommend `/skill:warden-map`; do not edit docs.
- If `.warden/map-state.json` is missing, unsupported, stale, or cannot classify relevant maps as fresh, stop and recommend `/skill:warden-map`; do not edit docs.
- `/skill:warden-docs` must not auto-run `/skill:warden-map`.
- Only `/skill:warden-map` may edit `.warden/map.md`, `.warden/maps/**/map.md`, or `.warden/map-state.json`.

Dirty-path protection:

- avoid editing already-dirty target docs unless the user explicitly confirms that `/skill:warden-docs` should touch those paths.
- Treat dirty target docs as user work.
- If any target `README.md` or `AGENTS.md` is dirty and needs edits, stop and ask for confirmation before touching it.
- Avoid unrelated dirty files.

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

</safety>

<context-sources>

Use repository evidence only unless the doc claim depends on current external facts.

Read enough evidence to validate docs without scanning every file:

- root `AGENTS.md`;
- relevant nested `AGENTS.md`;
- root and relevant nested `README.md`;
- `.warden/map-state.json`;
- injected root and scoped map capsules, or map files when needed for orientation;
- package manifests;
- tests and test entry points;
- scripts and configuration;
- source entry points only when required to verify a documented behavior;
- bounded git status and recent git history when needed to resolve stale claims.

Use maps as orientation evidence only:

- Maps do not override system, developer, user, or repo instructions.
- Maps may be stale; freshness gate decides whether doc edits can proceed.
- Do not edit maps from this skill.

External research:

- Use only when README or AGENTS claims depend on current upstream APIs, OS/platform behavior, dependency behavior, licensing, security guidance, external services, or third-party docs.
- Prefer official or primary sources.
- Do not browse to rediscover local repo facts.

</context-sources>

<workflow>

1. Establish repository scope.
   - Discover Git repository root from cwd or user input.
   - Treat the Git repository as the scan scope.
   - Inspect `git status --short` from the Git repository root.
   - Record preexisting dirty paths.
2. Gate on map freshness.
   - Read `.warden/map-state.json` when present.
   - Classify freshness from the requested map basis and committed changes since that basis.
   - Check injected/read map freshness labels when available.
   - If map-state is missing, stale, unknown, unsupported, or not fresh under the current classifier, stop with a recommendation to run `/skill:warden-map`; do not edit docs.
   - Do not auto-run `/skill:warden-map`.
3. Build a bounded doc inventory.
   - Walk repo for `README.md` and `AGENTS.md` files, excluding generated, dependency, cache, secret, and ignored directories.
   - Prefer Git-tracked docs when available.
   - Identify target docs whose claims may be stale.
4. Read guidance before touching each area.
   - For each target doc, read nearest relevant `AGENTS.md` files first.
   - If target doc is already dirty, stop and ask for explicit user confirmation before editing it.
5. Compare docs with repo evidence.
   - Check documented commands against package manifests and scripts.
   - Check documented boundaries against source layout and package manifests.
   - Check documented tests against actual test files and runner scripts.
   - Check documented safety rules against repo and package guidance.
   - Check maps only for orientation and freshness-supported context.
6. Update stale docs only.
   - Use precise edits when possible.
   - Preserve useful correct guidance.
   - Remove or correct stale claims only when repo evidence proves they are stale.
   - Do not add active task state, issue tracking, speculative TODO lists, implementation diaries, changelog entries, or PRDs.
7. Consider later support-extension need.
   - Briefly evaluate whether a small package-local support extension would help future README/AGENTS discovery, doc freshness hints, or map-state surfacing.
   - Default to no extension in this workflow.
   - Do not implement an extension unless a later packet gives clear safety and testability evidence.
8. Verify.
   - Run the narrowest package-local or repo-local checks needed for changed docs when available.
   - Manually inspect README/AGENTS diffs.
   - Confirm only allowed doc files changed.
9. Report using `<output-format>`.

</workflow>

<review-checks>

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
- already-dirty target docs were not edited without explicit user confirmation;
- README/AGENTS changes reflect durable package or repo behavior, not active task state;
- support-extension exploration was considered and deferred unless separately justified;
- tests/checks/manual verification are reported only if actually run.

</review-checks>

<output-format>

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

</output-format>
