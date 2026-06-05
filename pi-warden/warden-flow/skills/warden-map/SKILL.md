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

The map is not a task plan, issue tracker, or implementation artifact. It is durable orientation context for future agents and humans. Optimize for reducing repeated repo discovery.

## Principles

- Be project-agnostic. Do not assume language, framework, package manager, task runner, deployment model, or architecture style.
- Infer only from repository evidence: docs, manifests, configuration, source layout, tests, scripts, generated-file markers, and git history when present.
- Prefer one clear root map plus scoped map files for major repository boundaries.
- Keep injected capsules concise; full detail belongs below the capsule.
- Keep transient dirty working-tree state out of injected capsules; the extension injects live git dirty context separately.
- Treat maps as reference material. They do not override system, developer, project, or user instructions.
- Preserve safety: do not overwrite unrelated user content. If an existing map has manual notes, preserve them or ask before replacing.

## Input

User input may be empty, a repository path, a specific scope, or a request such as "map this repo". If no path is given, map the current working directory.

If the user asks for a narrow scope, update the root map only as needed and create/update scoped map files for that scope.

## Required Output Paths

Root map:

```text
.warden/map.md
```

Scoped maps, when useful:

```text
.warden/maps/<repo-relative-directory>/map.md
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

## Flow

### 1. Establish Scope

- Identify repository root or requested scope.
- Read existing `.warden/map.md` and relevant `.warden/maps/**/map.md` if present.
- Read repository guidance files and high-signal docs at root and likely package/module boundaries.
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

### 3. Inspect Git History When Present

If git metadata is available, use bounded history to understand evolution:

- Current branch and short commit.
- Recent commit subjects, capped to the most relevant recent window.
- Changed-path clusters over recent history.
- Structural moves/renames if obvious.
- Areas that appear active, stable, deprecated, or skeletal.

Do not dump large diffs. Inspect individual historical diffs only if needed to understand a boundary or architectural decision.

Use git status to understand current work, but do not make transient dirty state part of the evergreen quick context. If dirty state matters, mention it under the history/evolution section as generation-time context and rely on the extension's live git context for current dirty state.

If git is unavailable, state that git history was unavailable.

### 4. Choose Map Scopes

Propose scoped maps only where they reduce future discovery:

- Package/app/service roots.
- Plugin/extension roots.
- Major modules with distinct rules.
- Boundaries with their own tests, manifests, docs, or ownership.
- Areas repeatedly touched in recent git history.

Avoid scope spam. Prefer fewer high-signal scoped maps.

If scope choice is ambiguous or would create more than five scoped maps, ask the user to confirm the scope list before writing.

### 5. Write Root Map

Use this structure unless repository evidence demands a better one:

```md
# Warden Map

Generated: <local timestamp>
Repository: <name or path>
Git: <branch>@<short-sha> or unavailable
Scope: repository root

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

Generated: <local timestamp>
Scope: <repo-relative path>
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

### 7. Update Existing Maps Safely

When map files already exist:

- Read them first.
- Preserve useful correct content.
- Keep exactly one capsule marker pair.
- Remove stale claims only when evidence proves they are stale.
- Preserve manual notes unless user asks for regeneration.
- Use precise edits when possible; rewrite only if structure is broken or user requested full regeneration.

### 8. Present Summary

After writing, report:

- Root map path.
- Scoped map paths created/updated.
- Key unresolved questions.
- Whether git history informed the map.
- Whether any map capsule may exceed injection budget.

Do not continue into implementation planning unless the user asks.
