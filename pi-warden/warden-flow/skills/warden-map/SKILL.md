---
name: warden-map
description: Create or refresh a project-agnostic Warden repository map. Use when the user wants a durable map that reduces repeated repo discovery, explains repository structure, boundaries, entry points, verification surfaces, and recent evolution from git history when available.
license: MIT
---

# Warden Map

Create or refresh the repository's Warden map files:

```text
.warden/map.md
.warden/maps/<repo-relative-scope>/map.md
```

Canonical map root:

- First discover the Git repository root from the current cwd.
- When cwd is inside a Git repository, read and write maps only under `<git-root>/.warden/**`.
- If invoked from a nested cwd with no explicit path, map the Git repository root. If a repo-relative scope is requested, map that scope while still writing under `<git-root>/.warden/**`.
- Do not write `.warden/map.md` or `.warden/maps/**` under a nested cwd unless that cwd is itself a separate Git repository.
- If cwd is not inside a Git repository, do not pretend there is a canonical map root. Fail clearly unless explicit standalone path behavior is already supported by available repo evidence.
- Do not use Warden home paths or environment-specific roots.

The map is not a task plan, issue tracker, or implementation artifact. It is durable orientation context for future agents and humans. Optimize for reducing repeated repo discovery.

## Principles

- Be project-agnostic. Do not assume language, framework, package manager, task runner, deployment model, or architecture style.
- Infer only from repository evidence: durable docs, manifests, configuration, source layout, tests, scripts, generated-file markers, and git history when present.
- Prefer one clear root map plus scoped map files for major repository boundaries.
- Keep injected capsules concise; full detail belongs below the capsule.
- Treat maps as navigation and orientation reference. They are not task plans, issue trackers, implementation artifacts, PRDs, workflow state, or release notes.
- Keep transient dirty working-tree state out of injected capsules; the extension injects live git dirty context separately.
- Maps do not override system, developer, user, or repo instructions.
- Preserve safety: do not overwrite unrelated user content. If an existing map has manual notes, preserve them or ask before replacing.

## Input

User input may be empty, a repository path, a specific scope, or a request such as "map this repo". If no path is given and cwd is inside a Git repository, map the Git repository root, not a nested cwd. If no Git repository is available, fail clearly unless the requested path supports explicit standalone mapping.

If the user asks for a narrow scope, interpret it relative to the Git repository root when available, update the root map only as needed, and create/update scoped map files for that scope under the canonical map root.

## Required Output Paths

Root map:

```text
<git-root>/.warden/map.md
```

Scoped maps, when useful:

```text
<git-root>/.warden/maps/<repo-relative-scope>/map.md
```

Examples of scope paths are package roots, app/service roots, plugin or extension roots, major modules, or directories with distinct ownership/conventions. Do not create scoped maps for every directory.

## Injection Capsule Contract

Every map file MUST contain exactly one injectable capsule:

```md
<!-- warden-map:inject:start -->
## Agent Quick Context

- Purpose:
- Boundaries:
- Safe edits:
- Verification:
- Sharp edges:
<!-- warden-map:inject:end -->
```

Capsule budget:

- Root capsule target: ~3 KB, hard max 8 KB.
- Scoped capsule target: ~1.5 KB, hard max 4 KB.
- No long file lists or large code blocks in capsules.
- Include only facts future agents commonly need before deciding where to look next.

The extension auto-injects only capsule content. Full map body stays on disk for explicit reading.

## Discovery Budget

Default to a two-pass read.

First pass:

- Root `AGENTS.md`.
- Root `README.md`.
- Relevant nested `AGENTS.md`.
- Relevant nested `README.md`.
- Existing `<git-root>/.warden/map.md` when inside a Git repository.
- Relevant `<git-root>/.warden/maps/**/map.md` when inside a Git repository.
- `CHANGELOG.md` if present.
- Manifests, task files, test entry points, and obvious package boundaries.

Second pass:

- Read only files needed to resolve unclear boundaries, entry points, verification commands, state/secrets/generated-file locations, or sharp edges.

Do not read every file. Do not summarize every file. Prefer representative paths over exhaustive inventories.

## Relationship to Durable Docs

- `README.md` is the user/operator orientation surface.
- `AGENTS.md` is the editing and safety guidance surface.
- `CHANGELOG.md`, when present, is the curated notable-change surface.
- `map.md` is the navigation and repo-orientation surface.

Do not duplicate these files wholesale. Do not write changelog entries from this skill. Do not create or rewrite `README.md` or `AGENTS.md` unless the user explicitly asked.

## Refresh Modes

Default mode is scoped refresh.

- Capsule refresh: update only `## Agent Quick Context` when the body is still accurate.
- Scoped refresh: update the requested scope and root map only where cross-references changed.
- Full remap: update root and scoped maps only when the user asks or repo structure changed materially.

Do not full-remap by default.

## Full Map Body Budget

- Root map body target: 6-12 KB.
- Root map body hard max: 20 KB unless user asks for a deep map.
- Scoped map body target: 3-8 KB.
- Scoped map body hard max: 12 KB unless the scope is unusually complex.
- If a map would exceed the target, compress sections instead of appending detail.
- Prefer links and representative paths over exhaustive listings.

Do not change runtime capsule budgets from this skill; keep body budget separate from injected capsule budget.

## Git and Changelog Use

- Use git history only to understand structure, active areas, recent moves, and stale documentation risk.
- Use `CHANGELOG.md`, when present, as a curated notable-change source.
- Do not duplicate commit history.
- Do not maintain release notes in maps.
- `Recent Evolution` should explain orientation-relevant changes only.

Inspect individual historical diffs only if needed to understand a boundary or architectural decision. If git is unavailable, state that git history was unavailable.

## Flow

### 1. Establish Scope

- Discover the Git repository root from cwd, or fail clearly if no Git repository is available and no explicit standalone path behavior applies.
- Identify repository root or requested repo-relative scope.
- Choose refresh mode. Default to scoped refresh.
- Read existing `<git-root>/.warden/map.md` and relevant `<git-root>/.warden/maps/**/map.md` if present.
- Read repository guidance files and high-signal docs at root and likely package/module boundaries within the discovery budget.
- Inspect top-level tree and ignore obvious generated/vendor/cache output unless those directories are architecturally meaningful.

### 2. Build Evidence Inventory

Collect enough evidence to answer:

- What is this repository for?
- What are its major boundaries?
- Where are runtime, command, library, UI, service, extension, or integration entry points?
- Where do configuration, state, generated files, and secrets live?
- How does verification work, based only on files/docs/config found in this repo?
- Which files or directories are risky to mutate?
- Which conventions should future agents copy?

Do not list every file. Summarize patterns and cite representative paths.

### 3. Inspect Git and Changelog When Present

If git metadata is available, use bounded history to understand orientation-relevant changes:

- Current branch and short commit.
- Recent commit subjects, capped to the most relevant recent window.
- Changed-path clusters over recent history.
- Structural moves/renames if obvious.
- Areas that appear active, stable, deprecated, or skeletal.

Use git status to understand current work, but do not make transient dirty state part of evergreen quick context. Keep current dirty working-tree state out of capsules. Use dirty working-tree state only in the body when it explains uncertainty. Rely on the extension's live git context for current dirty state.

Use `CHANGELOG.md`, when present, as curated context for notable changes. Do not copy changelog prose into the map.

### 4. Choose Map Scopes

Propose scoped maps only where they reduce future discovery:

- Package/app/service roots.
- Plugin/extension roots.
- Major modules with distinct rules.
- Boundaries with their own tests, manifests, docs, or ownership.
- Areas repeatedly touched in recent git history.

Avoid scope spam. Prefer fewer high-signal scoped maps.

If more than five scoped maps look useful, default to:

- root map
- the requested scope
- up to three high-signal component/package maps

List deferred candidate scopes in `## Open Questions` or the final summary. Ask before writing more than five scoped maps unless the user explicitly requested broad mapping.

### 5. Write Root Map

Use this structure unless repository evidence demands a better one:

```md
# Warden Map

Reviewed: YYYY-MM-DD
Scope: repository root
Evidence basis: <short list>
Git basis: <branch>@<short-sha> or unavailable

<!-- warden-map:inject:start -->
## Agent Quick Context

- Purpose:
- Boundaries:
- Safe edits:
- Verification:
- Sharp edges:
<!-- warden-map:inject:end -->

## Repository Purpose

## Top-Level Map

| Path | Role | Notes |
|---|---|---|

## Entry Points and Runtime Flow

## Major Boundaries

## Configuration, State, and Generated Files

## Verification Surfaces

## Extension and Integration Points

## Recent Evolution from Git History

## Scoped Maps

| Scope | Map | Why it exists |
|---|---|---|

## Agent Operating Notes

## Open Questions
```

### 6. Write Scoped Maps

Use this structure for each scoped map:

```md
# Warden Map: <scope>

Reviewed: YYYY-MM-DD
Scope: <repo-relative path>
Evidence basis: <short list>
Git basis: <branch>@<short-sha> or unavailable
Parent map: .warden/map.md

<!-- warden-map:inject:start -->
## Agent Quick Context

- Purpose:
- Boundaries:
- Safe edits:
- Verification:
- Sharp edges:
<!-- warden-map:inject:end -->

## Scope Purpose

## Local Structure

## Local Entry Points

## Local Conventions

## Dependencies and Integration Points

## Verification for This Scope

## Safe Edit Notes

## Recent Evolution from Git History

## Open Questions
```

Metadata rules:

- Do not update only the review date or git basis if no map content changed.
- Keep evidence basis short: durable docs, manifests, tests, entry points, representative paths, and bounded git/changelog context.
- Use local date for `Reviewed` only when content changed.

### 7. Update Existing Maps Safely

When map files already exist:

- Read them first.
- Preserve useful correct content.
- Keep exactly one capsule marker pair.
- Remove stale claims only when evidence proves they are stale.
- Preserve manual notes unless user asks for regeneration.
- Use precise edits when possible; rewrite only if structure is broken or user requested full regeneration.
- Compress bloated sections before appending more detail.

### 8. Map Health Check

Before finishing, verify:

- Each written map has exactly one inject marker pair.
- Capsule is within target budget.
- Body is within target budget or intentionally deep.
- Stale claims were removed or corrected.
- README/AGENTS/CHANGELOG were not duplicated.
- No task plan, TODO list, issue list, or implementation sequence was added.

### 9. Present Summary

After writing, report:

- Root map path.
- Scoped map paths created/updated.
- Key unresolved questions or deferred candidate scopes.
- Whether git history or `CHANGELOG.md` informed the map.
- Whether any map capsule or body exceeds budget.

Do not continue into implementation planning unless the user asks.
